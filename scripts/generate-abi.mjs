import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { keccak_256 } from '@noble/hashes/sha3';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = dirname(SCRIPT_DIR);
const SDK_DIR = dirname(dirname(PACKAGE_DIR));
const ABI_DIR = join(SDK_DIR, 'abi');
const OUTPUT_FILE = join(PACKAGE_DIR, 'src', 'abi.ts');

const FUNCTION_EVENT_SOURCES = new Map([
  ['PaymentFactory.json', 'all'],
  ['DisputablePayment.json', 'all'],
  ['MockERC20.json', new Set(['approve(address,uint256)'])],
  ['Multicall3.json', new Set(['aggregate3((address,bool,bytes)[])'])],
]);

const ERROR_SOURCES = [
  'PaymentFactory.json',
  'DisputablePayment.json',
  'MockERC20.json',
  'Multicall3.json',
];

const EVENT_TOPICS = {
  PAYMENT_CREATED:
    'PaymentCreated(bytes32,address,address,address,address,uint256,uint256,uint256)',
  PAYMENT_SETTLED: 'PaymentSettled(address,uint256)',
  DISPUTE_RAISED: 'DisputeRaised(uint256,address)',
  RESOLVED_TO_PAYEE: 'ResolvedToPayee(address,uint256)',
  REFUNDED_TO_PAYER: 'RefundedToPayer(address,uint256)',
  CONSUMED: 'Consumed()',
  EVIDENCE: 'Evidence(address,uint256,address,string)',
};

const BUILTIN_ERRORS = [
  {
    type: 'error',
    name: 'Error',
    inputs: [{ name: 'message', type: 'string' }],
  },
  {
    type: 'error',
    name: 'Panic',
    inputs: [{ name: 'code', type: 'uint256' }],
  },
];

function compareCodePoint(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function canonicalType(parameter) {
  if (!parameter.type.startsWith('tuple')) return parameter.type;

  const suffix = parameter.type.slice('tuple'.length);
  const components = parameter.components ?? [];
  return `(${components.map(canonicalType).join(',')})${suffix}`;
}

function canonicalSignature(entry) {
  return `${entry.name}(${(entry.inputs ?? []).map(canonicalType).join(',')})`;
}

function normalizeParameter(parameter, includeIndexed) {
  const normalized = {};
  if (parameter.name !== undefined) normalized.name = parameter.name;
  normalized.type = parameter.type;
  if (parameter.components !== undefined) {
    normalized.components = parameter.components.map((component) =>
      normalizeParameter(component, false),
    );
  }
  if (includeIndexed && parameter.indexed !== undefined) normalized.indexed = parameter.indexed;
  return normalized;
}

function normalizeEntry(entry) {
  const normalized = { type: entry.type };
  if (entry.name !== undefined) normalized.name = entry.name;
  if (entry.inputs !== undefined) {
    normalized.inputs = entry.inputs.map((input) =>
      normalizeParameter(input, entry.type === 'event'),
    );
  }
  if (entry.outputs !== undefined) {
    normalized.outputs = entry.outputs.map((output) => normalizeParameter(output, false));
  }
  if (entry.stateMutability !== undefined) normalized.stateMutability = entry.stateMutability;
  if (entry.anonymous !== undefined) normalized.anonymous = entry.anonymous;
  return normalized;
}

async function readArtifact(filename) {
  const artifactPath = join(ABI_DIR, filename);
  if (!existsSync(artifactPath)) throw new Error(`Missing ABI artifact: ${artifactPath}`);
  const artifact = JSON.parse(await readFile(artifactPath, 'utf8'));
  if (!Array.isArray(artifact.abi)) throw new Error(`${filename} does not contain an .abi array`);
  return artifact.abi;
}

function addEntry(entries, entry, artifactName) {
  const normalized = normalizeEntry(entry);
  const signature = canonicalSignature(normalized);
  const identity = `${normalized.type}:${signature}`;
  const definition = JSON.stringify(normalized);
  const existing = entries.get(identity);

  if (!existing) {
    entries.set(identity, { normalized, signature, artifacts: [artifactName], definition });
    return;
  }

  if (existing.definition !== definition) {
    throw new Error(
      `Conflicting ABI definitions for ${identity} from ${existing.artifacts.join(', ')} and ${artifactName}:\n` +
        `  ${existing.definition}\n` +
        `  ${definition}`,
    );
  }

  existing.artifacts.push(artifactName);
}

function hashSignature(signature) {
  const digest = keccak_256(new TextEncoder().encode(signature));
  return `0x${Buffer.from(digest).toString('hex')}`;
}

function selector(signature) {
  return `0x${hashSignature(signature).slice(2, 10)}`;
}

function checkSelectorCollisions(entries, type) {
  const bySelector = new Map();
  for (const entry of entries.values()) {
    if (entry.normalized.type !== type) continue;
    const value = selector(entry.signature);
    const previous = bySelector.get(value) ?? [];
    previous.push(entry.signature);
    bySelector.set(value, previous);
  }

  for (const [value, signatures] of bySelector) {
    if (signatures.length > 1) {
      throw new Error(
        `Selector collision for ${value} among ${type}s:\n` + signatures.map((s) => `  ${s}`).join('\n'),
      );
    }
  }
}

function findEvent(entries, signature) {
  const matches = [...entries.values()].filter(
    (entry) => entry.normalized.type === 'event' && entry.signature === signature,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Event registry entry ${signature} resolved to ${matches.length} ABI entries`,
    );
  }
  if (matches[0].normalized.anonymous === true) {
    throw new Error(`Event registry entry ${signature} is anonymous`);
  }
  return matches[0];
}

function render(entries) {
  const normalizedEntries = [...entries.values()]
    .sort((a, b) => {
      const typeOrder = compareCodePoint(a.normalized.type, b.normalized.type);
      if (typeOrder !== 0) return typeOrder;
      const signatureOrder = compareCodePoint(a.signature, b.signature);
      if (signatureOrder !== 0) return signatureOrder;
      return compareCodePoint(a.definition, b.definition);
    })
    .map((entry) => entry.normalized);

  const topics = Object.fromEntries(
    Object.entries(EVENT_TOPICS).map(([key, signature]) => [key, hashSignature(findEvent(entries, signature).signature)]),
  );

  return [
    '// Generated by scripts/generate-abi.mjs. Do not edit manually.',
    '',
    `export const ABI = ${JSON.stringify(normalizedEntries, null, 2)} as const;`,
    '',
    `export const PAYMENT_EVENT_TOPICS = ${JSON.stringify(topics, null, 2)} as const;`,
    '',
  ].join('\n');
}

async function generate() {
  const entries = new Map();

  for (const [filename, policy] of FUNCTION_EVENT_SOURCES) {
    for (const entry of await readArtifact(filename)) {
      if (entry.type !== 'function' && entry.type !== 'event') continue;
      if (policy !== 'all') {
        const signature = canonicalSignature(normalizeEntry(entry));
        if (!policy.has(signature)) continue;
      }
      addEntry(entries, entry, filename);
    }
  }

  for (const filename of ERROR_SOURCES) {
    for (const entry of await readArtifact(filename)) {
      if (entry.type === 'error') addEntry(entries, entry, filename);
    }
  }

  for (const entry of BUILTIN_ERRORS) addEntry(entries, entry, '<built-in>');

  checkSelectorCollisions(entries, 'function');
  checkSelectorCollisions(entries, 'error');
  return render(entries);
}

const generated = await generate();
if (process.argv.includes('--check')) {
  const current = await readFile(OUTPUT_FILE, 'utf8').catch(() => '');
  if (current !== generated) {
    console.error('src/abi.ts is stale. Run: npm run generate:abi');
    process.exitCode = 1;
  }
} else {
  await writeFile(OUTPUT_FILE, generated, 'utf8');
}
