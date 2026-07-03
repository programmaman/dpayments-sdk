# Advanced Guide

This guide covers direct builders, readers, implementation pinning, multicall, event indexing, ERC20 sequencing, and wallet-library adapters.

## Choose the Right Layer

| Layer | Use when |
| --- | --- |
| `DPayments` facade | You want deployment lookup, prepare helpers, bound payment handles, and fewer manual steps. |
| `PaymentReader` | You only need chain reads. |
| `PaymentTxBuilder` | You already have fee/address data and only need calldata encoding. |
| `PaymentEvents` | You are indexing raw logs yourself. |

Most apps should use:

```ts
const dpayments = await DPayments.fromProvider(provider, walletAddress);
const { tx } = await dpayments.factory.prepareCreateEthPayment(params);
const payment = dpayments.dPayment('0xPAYMENT_ADDRESS');
```

## Explicit Config

```ts
const dpayments = new DPayments({
  chainId: 11155111,
  factoryAddress: '0xFACTORY_ADDRESS',
  provider,
  walletAddress,
  multicall: {
    address: '0xcA11bde05977b3631167028862bE2a173976CA11',
  },
});
```

Use explicit config for custom deployments, tests, backends, or when you need multicall and implementation pinning.

## ERC20 Creation Sequence

Use `prepareCreateErc20Payment()` for normal app code. It quotes the protocol fee, predicts the payment clone, and builds both transactions.

```ts
const {
  approveTx,
  createTx,
  paymentId,
  predictedAddress,
  gross,
} = await dpayments.factory.prepareCreateErc20Payment({
  tokenAddress: '0xTOKEN_ADDRESS',
  netAmount: 1_000_000n,
  payeeAddress: '0xPAYEE_ADDRESS',
  settlementTimeUnixSec: BigInt(Math.floor(Date.now() / 1000) + 86400),
});

await signer.sendTransaction({
  to: approveTx.to,
  data: approveTx.data,
  value: BigInt(approveTx.value),
});

await signer.sendTransaction({
  to: createTx.to,
  data: createTx.data,
  value: BigInt(createTx.value),
});
```

The ERC20 approval spender is the predicted payment clone, not the factory.

## Implementation Pinning

Factories can register multiple payment implementations. Pin an implementation when you need deterministic behavior across a product release.

```ts
const impls = await dpayments.factory.listImplementations();

const pinned = new DPayments({
  chainId: 11155111,
  factoryAddress: '0xFACTORY_ADDRESS',
  provider,
  walletAddress,
  impl: impls[0],
});
```

You can also resolve by name or address through `fromProvider()`:

```ts
const dpayments = await DPayments.fromProvider(
  provider,
  walletAddress,
  'DisputablePayment',
);
```

## Multicall Reads

Add Multicall3 to batch `readPayment()` and `readFactory()` internals.

```ts
const dpayments = await DPayments.fromProvider(
  provider,
  walletAddress,
  undefined,
  {
    address: '0xcA11bde05977b3631167028862bE2a173976CA11',
  },
);

const info = await dpayments.dPayment('0xPAYMENT_ADDRESS').read();
const config = await dpayments.factory.readConfig();
```

Only configure multicall for chains where the address is deployed.

## Direct Transaction Builder

`PaymentTxBuilder` is stateless. It does not quote fees, predict addresses, resolve deployments, or read chain state.

```ts
import { IdGenerator, PaymentTxBuilder } from '@rakelabs/dpayments-sdk';

const builder = new PaymentTxBuilder();
const cfg = { chainId: 11155111, factoryAddress: '0xFACTORY_ADDRESS' };

const tx = builder.createEthPayment(cfg, {
  callerWallet: '0xPAYER_ADDRESS',
  paymentId: IdGenerator.generateOnChainIdHex(),
  payeeAddress: '0xPAYEE_ADDRESS',
  amount: 1_000_000n,
  fee: 25_000n,
  settlementTimeUnixSec: BigInt(Math.floor(Date.now() / 1000) + 86400),
});
```

Builder methods:

| Method | Description |
| --- | --- |
| `createEthPayment(cfg, params)` | Build ETH create transaction. |
| `createErc20Payment(cfg, params)` | Build ERC20 create transaction. |
| `erc20Approve(cfg, params)` | Build ERC20 approval transaction. |
| `settle(cfg, params)` | Build payee settlement transaction. |
| `voluntaryRefund(cfg, params)` | Build payee refund transaction. |
| `raiseDispute(cfg, params)` | Build dispute transaction with supplied arbitration fee. |
| `submitEvidence(cfg, params)` | Build evidence submission transaction. |
| `appeal(cfg, params)` | Build appeal transaction with supplied appeal fee. |
| `claim(cfg, params)` | Build queued ETH claim transaction. |

## Direct Reader

```ts
import { JsonRpcProvider } from 'ethers';
import { PaymentReader } from '@rakelabs/dpayments-sdk';

const reader = new PaymentReader(new JsonRpcProvider(process.env.RPC_URL));

const config = await reader.readFactory('0xFACTORY_ADDRESS');
const payment = await reader.readPayment('0xPAYMENT_ADDRESS');
const quote = await reader.quoteGross('0xFACTORY_ADDRESS', 1_000_000n);
```

Use direct readers for dashboards, monitoring jobs, backends, and services that should never prepare transactions.

## Event Indexing

For common app history:

```ts
const byPayer = await dpayments.factory.getLogsByParty('payer', payerAddress);
const byPayee = await dpayments.factory.getLogsByPayee(payeeAddress);
const history = await dpayments.dPayment('0xPAYMENT_ADDRESS').getLogs();
```

For custom indexers:

```ts
import { PaymentEvents, PaymentTopics } from '@rakelabs/dpayments-sdk';

const events = new PaymentEvents();
const rawLogs = await provider.getLogs({
  address: factoryAddress,
  topics: [PaymentTopics.PAYMENT_CREATED],
  fromBlock: 0,
  toBlock: 'latest',
});

for (const log of rawLogs) {
  const decoded = events.tryDecodePaymentCreated({
    address: log.address,
    topics: log.topics,
    data: log.data,
    transactionHash: log.transactionHash,
  });
  if (decoded) {
    console.log(decoded.paymentId, decoded.paymentAddress);
  }
}
```

## Evidence Logs

Payment evidence logs are decoded but not timestamp-enriched.

```ts
const evidence = await dpayments.dPayment('0xPAYMENT_ADDRESS')
  .getEvidenceLogs(0, 'latest');

for (const event of evidence) {
  console.log(event.party, event.evidenceUri, event.transactionHash);
}
```

If you need timestamps, fetch block metadata for each event's block from your indexer or provider.

## Wallet Library Adapters

ethers v6:

```ts
await signer.sendTransaction({
  to: tx.to,
  data: tx.data,
  value: BigInt(tx.value),
});
```

wagmi / viem:

```ts
await sendTransaction(config, {
  to: tx.to as `0x${string}`,
  data: tx.data as `0x${string}`,
  value: BigInt(tx.value),
});
```

Account abstraction:

```ts
await smartAccount.sendUserOperation({
  target: tx.to,
  data: tx.data,
  value: BigInt(tx.value),
});
```

## ID Generation

```ts
import { IdGenerator } from '@rakelabs/dpayments-sdk';

const onChainId = IdGenerator.generateOnChainIdHex();
const displayId = IdGenerator.generateFriendlyId('PAY-', 12);
```
