# @rakelabs/dpayments-sdk

**Add on-chain payments with built-in Kleros arbitration to your product. No blockchain expertise required.**

## What is this?

DPayments is a JavaScript / TypeScript library for holding payments between two parties using Ethereum smart contracts. Think of it as **a programmable payment with a built-in dispute system**:

- A **payer** sends funds (ETH or ERC20) into a smart contract.
- A **payee** claims the funds after a settlement time, or refunds voluntarily.
- If there's a disagreement, either party raises a **Kleros dispute**, where jurors decide the outcome.
- Rulings are enforced automatically on-chain.

> **This library never touches your users' money.** It prepares unsigned transactions. Your app hands them to the user's wallet (MetaMask, WalletConnect). The user signs and submits. Your server never holds private keys.

```
Your app  ──→  dpayments SDK  ──→  unsigned transaction  ──→  User's wallet  ──→  Blockchain
              (prepares it)       (just instructions)         (signs it)         (executes it)
```

## Installation

```bash
npm install @rakelabs/dpayments-sdk ethers
```

> Requires **ethers v6**. ethers v5 is not compatible.

## Payment lifecycle

The lifecycle covers payment, settlement, and optional dispute resolution.

## Quick start

```ts
import { DPayments } from '@rakelabs/dpayments-sdk';
import { BrowserProvider } from 'ethers';

const provider    = new BrowserProvider(window.ethereum);
await provider.send('eth_requestAccounts', []);
const signer      = await provider.getSigner();
const myAddress   = await signer.getAddress();

// One line. Chain and factory address are auto-detected.
const dpayments = await DPayments.fromProvider(provider, myAddress);
```

## Happy path: ETH payment in 4 steps

```ts
import { DPayments } from '@rakelabs/dpayments-sdk';
import { BrowserProvider } from 'ethers';

// ─── Setup ────────────────────────────────────────────────────────────────────

const provider    = new BrowserProvider(window.ethereum);
await provider.send('eth_requestAccounts', []);
const signer      = await provider.getSigner();
const payerWallet = await signer.getAddress();

const dpayments = await DPayments.fromProvider(provider, payerWallet);

const payeeAddress = '0xPAYEE_WALLET_ADDRESS';

// ─── Step 1: Create and fund the payment ─────────────────────────────────────
//
// prepareCreateEthPayment quotes the fee and builds the transaction.
// ETH is sent with the transaction: gross = net + fee.
// The payment is funded immediately on-chain.

const now      = BigInt(Math.floor(Date.now() / 1000));
const settleAt = now + 60n; // 60 seconds from now

const { tx: createTx, paymentId } = await dpayments.factory.prepareCreateEthPayment({
  netAmount:              ethers.parseEther("0.000001"),
  payeeAddress,
  settlementTimeUnixSec:  settleAt,
});

console.log('Create payment preview:', createTx.preview);

// ─── Step 2: Find the deployed payment ───────────────────────────────────────

const logs   = await dpayments.factory.getLogs(0, 'latest');
const ourLog = logs.find(e => e.paymentId === paymentId)!;
const payment = dpayments.dPayment(ourLog.paymentAddress);

// ─── Step 3: Wait for settlement, then payee claims ─────────────────────────

//   await payeeSigner.sendTransaction(payment.settle());

await new Promise(r => setTimeout(r, 61_000));
await signer.sendTransaction(payment.settle());
// → Settled
```

> The complete dispute lifecycle (rulings, appeals, and evidence) mirrors the Klescrow escrow pattern. See [docs/disputes.md](docs/disputes.md).

## Decoding revert errors

When a transaction reverts on-chain, MetaMask shows a raw hex code. `decodeDPaymentError` turns it into a readable error name.

```ts
import { decodeDPaymentError } from '@rakelabs/dpayments-sdk';

try {
  await signer.sendTransaction({ ...tx, value: BigInt(tx.value) });
} catch (err) {
  const decoded = decodeDPaymentError(err);

  if (decoded && 'error' in decoded) {
    // "InvalidState", "NotPayer", "BadEthValue" …
    showToast(`Transaction reverted: ${decoded.error}`);
    console.log('Args:', decoded.args); // { sent: 100n, expectedMin: 200n }
  } else if (decoded && 'raw' in decoded) {
    // Unrecognized revert: surface the hex
    console.warn('Unknown revert:', decoded.raw);
  }
  // decoded === null → not a contract revert (network error, user rejected, etc.)
}
```

Full reference: [docs/error-decoder.md](docs/error-decoder.md).

## Further reading

| Doc | Content |
|-----|---------|
| [docs/disputes.md](docs/disputes.md) | Raising disputes, evidence, appeals, and rulings |
| [docs/reference.md](docs/reference.md) | Every action, type, event topic, and common mistake |
| [docs/error-decoder.md](docs/error-decoder.md) | `decodeDPaymentError` reference and all error types |
| [docs/advanced.md](docs/advanced.md) | Transaction builder, reader, multicall, implementation selection |


## Smart Contract Disclosure

**This software deploys autonomous, immutable contracts. The author has zero administrative control over your balance or deployed contract. Every transaction includes a human-readable preview -- check it before signing to verify exactly what you are approving. Please be careful when transacting with others. Users interact with this software entirely at their own risk.**

---