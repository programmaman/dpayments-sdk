# Advanced

Power-user features not covered in the happy path.

## Using the transaction builder directly

The `PaymentTxBuilder` is the stateless core. It encodes calldata from typed parameters and returns a `PreparedTx`. Use it directly if you don't need the high-level `DPayments` facade.

```ts
import { PaymentTxBuilder } from '@rakelabs/dpayments-sdk';

const builder = new PaymentTxBuilder();

const cfg = { chainId: 11155111, factoryAddress: '0x...' };

// Create an ETH payment
const tx = builder.createEthPayment(cfg, {
  callerWallet:           '0xUSER...',
  paymentId:              '0x' + '22'.repeat(32),
  payeeAddress:           '0xPAYEE...',
  amount:                 1_000_000n,
  fee:                    25_000n,
  settlementTimeUnixSec:  BigInt(Math.floor(Date.now() / 1000) + 86400),
});

console.log(`total value: ${tx.value} wei`);

// Create an ERC20 payment (value = 0, payer approves separately)
const erc20Tx = builder.createErc20Payment(cfg, {
  callerWallet:           '0xUSER...',
  paymentId:              '0x' + '33'.repeat(32),
  payeeAddress:           '0xPAYEE...',
  tokenAddress:           '0xUSDC...',
  amount:                 1_000_000n,
  fee:                    25_000n,
  settlementTimeUnixSec:  BigInt(Math.floor(Date.now() / 1000) + 86400),
});
```

### Builder methods

| Method | Description |
|--------|-------------|
| `createEthPayment(cfg, params)` | ETH payment create tx. Value = gross. |
| `createErc20Payment(cfg, params)` | ERC20 payment create tx. Value = 0. |
| `settle(cfg, params)` | Payee claims after settlementTime. |
| `voluntaryRefund(cfg, params)` | Payee refunds before settlement. |
| `raiseDispute(cfg, params)` | Payer raises a Kleros dispute. |
| `submitEvidence(cfg, params)` | Submit evidence URI. |
| `appeal(cfg, params)` | Appeal a ruling. |
| `claim(cfg, params)` | Claim pull-payment fallback. |
| `erc20Approve(cfg, params)` | ERC20 approve for payment creation. |

With pinned implementation:

```ts
const tx = builder.createEthPayment(cfg, {
  ...params,
  impl: '0xPINNED_IMPL_ADDRESS',
});
```

## Using the reader directly

`PaymentReader` performs raw `eth_call` reads. Use it when you don't want the `DPayments` facade.

```ts
import { PaymentReader } from '@rakelabs/dpayments-sdk';
import { JsonRpcProvider } from 'ethers';

const reader = new PaymentReader(new JsonRpcProvider('...'));

const config = await reader.readFactory('0xFACTORY...');
const info   = await reader.readPayment('0xPAYMENT...');
const quote  = await reader.quoteGross('0xFACTORY...', 1_000_000n);
const addr   = await reader.predictPaymentAddress('0xFACTORY...', creator, req);
```

## Implementation selection

The factory supports multiple payment implementations. List and pin them:

```ts
// List all registered implementations
const impls = await dpayments.factory.listImplementations();
// → [{ address: '0x...', name: 'DisputablePayment v1' }, ...]

// Pin a specific implementation:
const dpayments = new DPayments({
  chainId:        11155111,
  factoryAddress: '0x...',
  provider,
  impl:            impls[0], // pin to the first registered impl
});

// Or pass to fromProvider:
const dpayments = await DPayments.fromProvider(provider, address, impls[1]);
```

## Multicall (batching)

Pass a `multicall` config to reduce RPC calls from 8+ parallel to 1 batched call for `readPayment`
and `readFactory`. Uses the Multicall3 contract at the configured address.

```ts
const dpayments = await DPayments.fromProvider(provider, address, undefined, {
  multicall: {
    address: '0xcA11bde05977b3631167028862bE2a173976CA11', // Multicall3 on mainnet
  },
});

// All subsequent readPayment / readFactory calls will use a single multicall batch.
const info = await dpayments.dPayment('0xPAYMENT...').read();
const config = await dpayments.factory.readConfig();
```

## Event log filtering

Use `PaymentEvents` to decode raw EVM logs:

```ts
import { PaymentEvents, TOPIC_PAYMENT_CREATED } from '@rakelabs/dpayments-sdk';

const events = new PaymentEvents();

const rawLogs = await provider.getLogs({
  address:   factoryAddress,
  topics:    [TOPIC_PAYMENT_CREATED],
  fromBlock: 0,
  toBlock:   'latest',
});

for (const log of rawLogs) {
  const decoded = events.tryDecodePaymentCreated({
    address: log.address,
    topics: log.topics as string[],
    data: log.data,
    transactionHash: log.transactionHash,
  });
  if (decoded) {
    console.log(`Payment ${decoded.paymentId} → ${decoded.paymentAddress}`);
    console.log(`  creator=${decoded.creator}  payee=${decoded.payee}  amount=${decoded.amount}`);
  }
}
```

## Evidence timeline

The `getEvidenceLogs` method enriches each evidence event with the block timestamp:

```ts
const timeline = await dPayment.getEvidenceLogs(0, 'latest');

for (const ev of timeline) {
  console.log(`${ev.submittedAt.toLocaleString()}`);
  console.log(`  Party:  ${ev.party}`);
  console.log(`  URI:    ${ev.evidenceUri}`);
  console.log(`  Block:  ${ev.blockNumber}`);
}
```

## PreparedTx previews

Every transaction includes a `preview` field with a structured fee breakdown and human-readable labels. Use it for wallet confirmation screens:

```ts
const { tx } = await dpayments.factory.prepareCreateEthPayment(params);

console.log(tx.preview);
// {
//   action: 'Create ETH Payment',
//   signer: 'payer',
//   description: 'Deploy a new payment contract and fund it with ETH.',
//   valueWei: '1025000',
//   fees: {
//     token: '0x0000…0000',
//     items: [
//       { label: 'Net amount', amountWei: '1000000' },
//       { label: 'Protocol fee', amountWei: '25000' },
//     ],
//     totalFeeWei: '1025000',
//   },
//   details: { 'Payment ID': '0x…', 'Payee': '0x…', 'Settlement time': '…' },
// }
```

## ID generation

Generate globally unique on-chain payment IDs:

```ts
import { IdGenerator } from '@rakelabs/dpayments-sdk';

// Random bytes32:
const id = IdGenerator.generateOnChainIdHex();
// → '0x7f83…a4b1'

// Human-friendly IDs for internal tracking:
const friendly = IdGenerator.generateFriendlyId('PAY-', 12);
// → 'PAY-8xK2mPq9RfTv'
```
