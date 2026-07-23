# API Reference

Compact reference for the public DPayments npm surface.

## Main Exports

```ts
import {
  DPayments,
  DPayment,
  PaymentTxBuilder,
  PaymentReader,
  PaymentEvents,
  PaymentTopics,
  PaymentState,
  decodeDPaymentError,
  IdGenerator,
} from '@rakelabs/dpayments-sdk';
```

## State Enum

```ts
enum PaymentState {
  PAID = 0,
  SETTLED = 1,
  DISPUTED = 2,
  RESOLVED = 3,
}
```

## Top-Level SDK

| Method | Purpose |
| --- | --- |
| `DPayments.fromProvider(provider, walletAddress?, implNameOrAddress?, multicall?)` | Detect chain and default factory from provider. |
| `DPayments.forChain(chainId, provider, walletAddress?, impl?)` | Use the canonical factory address for a specific chain ID. |
| `new DPayments(config)` | Use explicit factory, chain, multicall, and implementation config. |
| `dpayments.dPayment(address)` | Return a bound payment handle. No network call. |

## SDK Config

```ts
interface DPaymentsSdkConfig {
  chainId: number;
  factoryAddress: string;
  provider: AbstractProvider;
  walletAddress?: string;
  multicall?: { address: string };
  impl?: { address: string; name: string };
}
```

## Factory Reads

| Method | Returns |
| --- | --- |
| `factory.readConfig()` | `FactoryInfo` |
| `factory.quoteGross(net)` | `{ gross, fee }` |
| `factory.feeBps()` | `bigint` |
| `factory.implementationCount()` | `number` |
| `factory.implementationAt(index)` | `{ address, name }` |
| `factory.listImplementations()` | `{ address, name }[]` |
| `factory.predictAddress(creator, req)` | Predicted clone address |
| `factory.getLogs(from?, to?)` | `PaymentCreatedEvent[]` |
| `factory.getLogsByParty(role, party, from?, to?)` | `PaymentCreatedEvent[]` |
| `factory.getLogsByCreator(creator, from?, to?)` | `PaymentCreatedEvent[]` |
| `factory.getLogsByPayee(payee, from?, to?)` | `PaymentCreatedEvent[]` |

## Factory Writes

| Method | Description | Who signs |
| --- | --- | --- |
| `factory.prepareCreateEthPayment(params)` | Quote fee and build ETH create transaction. | Payer |
| `factory.prepareCreateErc20Payment(params)` | Quote fee, predict clone, build ERC20 approve and create transactions. | Payer |
| `factory.createEthPayment(params)` | Build ETH create transaction when you already know fee values. | Payer |
| `factory.createErc20Payment(params)` | Build ERC20 create transaction when you already know fee values. | Payer |
| `factory.erc20Approve(params)` | Build ERC20 approval transaction. | Token owner |

### Prepare Create Params

```ts
interface PrepareCreateParams {
  netAmount: bigint;
  paymentId?: string;
  payeeAddress: string;
  settlementTimeUnixSec: bigint;
}

interface PrepareCreateErc20Params extends PrepareCreateParams {
  tokenAddress: string;
}
```

### Prepare Results

```ts
type PrepareCreateEthResult = {
  tx: PreparedTx;
  paymentId: string;
  gross: bigint;
  fee: bigint;
};

type PrepareCreateErc20Result = {
  approveTx: PreparedTx;
  createTx: PreparedTx;
  paymentId: string;
  gross: bigint;
  fee: bigint;
  predictedAddress: string;
};
```

## Payment Reads

| Method | Returns |
| --- | --- |
| `reader.readPayment(address)` | `PaymentInfo` aggregate snapshot |
| `reader.readPayment.state(address)` | `PaymentState` |
| `reader.readPayment.payer(address)` | Payer address |
| `reader.readPayment.payee(address)` | Payee address |
| `reader.readPayment.token(address)` | Token address (`ZeroAddress` for ETH) |
| `reader.readPayment.amount(address)` | Net amount as `bigint` |
| `reader.readPayment.settlementTime(address)` | Unix settlement time as `bigint` |
| `reader.readPayment.consumed(address)` | Whether the payee has consumed the payment |
| `reader.readPayment.disputeId(address)` | Dispute ID as `bigint` |
| `reader.readPayment.disputeStartTime(address)` | Dispute start time as `bigint` |
| `reader.readPayment.arbitrator(address)` | Arbitrator address |
| `reader.readPayment.arbitratorConfiguration(address)` | Arbitrator configuration hex |
| `reader.readPayment.arbitrationCost(address)` | Current Kleros arbitration fee |
| `reader.readPayment.appealCost(address)` | Current appeal fee |
| `reader.readPayment.appealPeriod(address)` | `{ start, end }` |
| `reader.readPayment.pendingWithdrawal(address, wallet)` | Claimable ETH balance |
| `dPayment.read()` | `PaymentInfo` |
| `dPayment.read.state()` | `PaymentState` |
| `dPayment.read.payer()` | Payer address |
| `dPayment.read.payee()` | Payee address |
| `dPayment.read.token()` | Token address (`ZeroAddress` for ETH) |
| `dPayment.read.amount()` | Net amount as `bigint` |
| `dPayment.read.settlementTime()` | Unix settlement time as `bigint` |
| `dPayment.read.consumed()` | Whether the payee has consumed the payment |
| `dPayment.read.disputeId()` | Dispute ID as `bigint` |
| `dPayment.read.disputeStartTime()` | Dispute start time as `bigint` |
| `dPayment.read.arbitrator()` | Arbitrator address |
| `dPayment.read.arbitratorConfiguration()` | Arbitrator configuration hex |
| `dPayment.read.arbitrationCost()` | Current Kleros arbitration fee |
| `dPayment.read.appealCost()` | Current appeal fee |
| `dPayment.read.appealPeriod()` | `{ start, end }` |
| `dPayment.read.pendingWithdrawal(wallet)` | Claimable ETH balance |
| `dPayment.arbitrationCost()` | Current Kleros arbitration fee |
| `dPayment.appealCost()` | Current appeal fee |
| `dPayment.appealPeriod()` | `{ start, end }` |
| `dPayment.pendingWithdrawal(address)` | Claimable ETH balance |
| `dPayment.getEvidenceLogs(from?, to?)` | Evidence events |
| `dPayment.getLogs(from?, to?)` | Decoded payment events |

## Payment Writes

| Method | Description |
| --- | --- |
| `dPayment.settle()` | Build payee settlement transaction. |
| `dPayment.voluntaryRefund()` | Build payee refund transaction. |
| `dPayment.consume()` | Build payee consumption-marker transaction. |
| `dPayment.prepareRaiseDispute()` | Read arbitration fee and build dispute transaction. |
| `dPayment.raiseDispute(arbFeeWei)` | Build dispute transaction with caller-supplied fee. |
| `dPayment.submitEvidence(uri)` | Submit evidence URI. |
| `dPayment.prepareAppeal(extraData?)` | Read appeal fee/window and build appeal transaction. |
| `dPayment.appeal(extraData, feeWei)` | Build appeal transaction with caller-supplied fee. |
| `dPayment.claim()` | Claim queued ETH withdrawal. |

## PaymentInfo

```ts
interface PaymentInfo {
  paymentAddress: string;
  state: PaymentState;
  payer: string;
  payee: string;
  token: string;
  amount: bigint;
  settlementTime: bigint;
  consumed: boolean;
  disputeId: bigint;
  disputeStartTime: bigint;
  arbitratorAddress: string;
  arbitratorConfiguration: string;
}
```

## PreparedTx

```ts
interface PreparedTx {
  to: string;
  data: string;
  value: string;
  chainId: number;
  signerHint?: string;
  preview?: SigningPreview;
}
```

Send with ethers v6:

```ts
await signer.sendTransaction({
  to: tx.to,
  data: tx.data,
  value: BigInt(tx.value),
});
```

## Events

Factory event:

```ts
type PaymentCreatedEvent = {
  paymentId: string;
  paymentAddress: string;
  creator: string;
  payee: string;
  token: string;
  amount: bigint;
  fee: bigint;
  settlementTime: bigint;
  logAddress: string;
  transactionHash?: string;
};
```

Payment event union includes:

- `PaymentSettledEvent`
- `DisputeRaisedEvent`
- `ResolvedToPayeeEvent`
- `RefundedToPayerEvent`
- `ConsumedEvent`
- `PaymentEvidenceEvent`

## Common Mistakes

| Mistake | Fix |
| --- | --- |
| Calling `refund()` on `DPayment`. | Use `voluntaryRefund()`. |
| Passing `tx.value` directly to ethers v6. | Use `BigInt(tx.value)`. |
| Approving the ERC20 factory instead of the predicted clone. | Use `prepareCreateErc20Payment()` and send its `approveTx` first. |
| Treating `paymentId` as the contract address. | Store the deployed `paymentAddress` from `PaymentCreated`. |
| Settling before `settlementTimeUnixSec`. | Read `PaymentInfo.settlementTime` and compare it to current Unix time. |
| Calling appeal reads before a ruling exists. | Check state and `appealPeriod.end > 0n`. |
