# @rakelabs/dpayments-sdk

Create disputable ETH or ERC20 payments from a TypeScript app. DPayments prepares unsigned transactions for payment creation, settlement, refunds, evidence, disputes, and appeals; your user's wallet remains responsible for signing and broadcasting.

The SDK never holds private keys and never takes custody of funds.

```text
Your app -> DPayments SDK -> unsigned transaction -> user wallet -> blockchain
```

## Install

```bash
npm install @rakelabs/dpayments-sdk ethers
```

Requirements:

- Node.js 20+
- ethers v6
- an EIP-1193 wallet provider, JSON-RPC provider, or compatible ethers provider

## What You Build With It

Use this package when a payer should fund a payment now, but the payee should only claim it after a settlement time:

- the payer creates and funds the payment,
- the payee settles after the settlement time,
- the payee can voluntarily refund the payer,
- the payer can raise a Kleros dispute before settlement if delivery fails,
- evidence and appeal transactions can be prepared from the same bound payment handle.

Every write method returns a `PreparedTx` with a `preview` field. Show that preview before asking a user to sign.

## Quick Start

```ts
import { BrowserProvider, ethers } from 'ethers';
import { DPayments } from '@rakelabs/dpayments-sdk';

const provider = new BrowserProvider(window.ethereum);
await provider.send('eth_requestAccounts', []);

const signer = await provider.getSigner();
const payerAddress = await signer.getAddress();

const dpayments = await DPayments.fromProvider(provider, payerAddress);

const settlementTime = BigInt(Math.floor(Date.now() / 1000)) + 3600n;
const { tx: createTx, paymentId } = await dpayments.factory.prepareCreateEthPayment({
  netAmount: ethers.parseEther('0.25'),
  payeeAddress: '0xPAYEE_ADDRESS',
  settlementTimeUnixSec: settlementTime,
});

console.log(createTx.preview);

const createResponse = await signer.sendTransaction({
  to: createTx.to,
  data: createTx.data,
  value: BigInt(createTx.value),
});
await createResponse.wait();

const created = (await dpayments.factory.getLogs(0, 'latest'))
  .find((event) => event.paymentId === paymentId);

if (!created) {
  throw new Error('Payment creation event was not found');
}

const payment = dpayments.dPayment(created.paymentAddress);
```

## Common Flows

### Settle

The payee settles after `settlementTimeUnixSec`.

```ts
const settleTx = payment.settle();
console.log(settleTx.preview);

await signer.sendTransaction({
  to: settleTx.to,
  data: settleTx.data,
  value: BigInt(settleTx.value),
});
```

### Refund

The payee can voluntarily refund before settlement.

```ts
const refundTx = payment.voluntaryRefund();
await signer.sendTransaction({
  to: refundTx.to,
  data: refundTx.data,
  value: BigInt(refundTx.value),
});
```

### Raise a Dispute

`prepareRaiseDispute()` reads the current Kleros arbitration cost and includes it as the transaction value.

```ts
const { tx: disputeTx, arbFeeWei } = await payment.prepareRaiseDispute();

console.log('Arbitration fee:', arbFeeWei.toString());
console.log(disputeTx.preview);

await signer.sendTransaction({
  to: disputeTx.to,
  data: disputeTx.data,
  value: BigInt(disputeTx.value),
});
```

### Submit Evidence

Evidence is usually an `ipfs://...` URI produced by `@rakelabs/evidence-publisher`.

```ts
const evidenceTx = payment.submitEvidence('ipfs://QmYourEvidenceDocument');
await signer.sendTransaction({
  to: evidenceTx.to,
  data: evidenceTx.data,
  value: BigInt(evidenceTx.value),
});
```

## ETH vs ERC20

For ETH payments, the SDK includes the required ETH value in the prepared transaction.

For ERC20 payments, use `prepareCreateErc20Payment(...)` with the token address and handle token allowance before creating the payment.

## Errors

Use `decodeDPaymentError` to turn raw revert data into a readable contract error.

```ts
import { decodeDPaymentError } from '@rakelabs/dpayments-sdk';

try {
  await signer.sendTransaction({
    to: tx.to,
    data: tx.data,
    value: BigInt(tx.value),
  });
} catch (err) {
  const decoded = decodeDPaymentError(err);
  if (decoded && 'error' in decoded) {
    console.error(decoded.error, decoded.args);
  }
}
```

## Documentation

| Document | Use it for |
| --- | --- |
| [docs/reference.md](docs/reference.md) | API reference, types, actions, events, and common mistakes |
| [docs/disputes.md](docs/disputes.md) | Dispute, evidence, ruling, and appeal lifecycle |
| [docs/error-decoder.md](docs/error-decoder.md) | Revert decoding details |
| [docs/advanced.md](docs/advanced.md) | Reader, transaction builder, multicall, and implementation selection |
| [docs/on-chain.md](docs/on-chain.md) | Contract-level behavior and event model |

## Safety Notes

- Always show `tx.preview` before requesting a signature.
- Store the payment contract address after creation; it is the canonical on-chain handle.
- Treat settlement times as Unix seconds.
- Check chain IDs and contract addresses before sending transactions.
- This software interacts with autonomous contracts. Users transact at their own risk.
