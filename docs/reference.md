# Reference

Cheat sheet for every action, type, and common mistake.

## States

```ts
enum PaymentState { PAID, SETTLED, DISPUTED, RESOLVED }
```

## Factory actions

| Method | Description | Who signs |
|--------|-------------|:---------:|
| `factory.readConfig()` | Read factory config (fee, arbitrator, impls, etc.). | N/A (read) |
| `factory.quoteGross(net)` | Quote gross = net + fee. | N/A (read) |
| `factory.feeBps()` | Current protocol fee in basis points. | N/A (read) |
| `factory.prepareCreateEthPayment(params)` | Quote fee + build create + fund tx in one call. | Payer |
| `factory.prepareCreateErc20Payment(params)` | Quote + predict + build approve + create txs. | Payer |
| `factory.createEthPayment(params)` | Build create tx only (you supply fee). | Payer |
| `factory.createErc20Payment(params)` | Build create tx only (you supply fee). | Payer |
| `factory.erc20Approve(params)` | Build ERC20 approve tx. | Payer |
| `factory.predictAddress(creator, req)` | Predict clone address before creating. | N/A (read) |
| `factory.implementationCount()` | Number of registered payment implementations. | N/A (read) |
| `factory.implementationAt(index)` | Implementation address + name at index. | N/A (read) |
| `factory.listImplementations()` | All registered implementations. | N/A (read) |
| `factory.getLogs(from, to)` | Fetch PaymentCreated events from factory. | N/A (read) |
| `factory.getLogsByParty(role, address)` | Fetch events filtered by payer or payee. | N/A (read) |
| `factory.getLogsByCreator(address)` | Fetch events by creator address. | N/A (read) |
| `factory.getLogsByPayee(address)` | Fetch events by payee address. | N/A (read) |

### CreatePayment params

```ts
{
  paymentId:              string;   // bytes32 hex (auto-generated if omitted)
  payeeAddress:           string;
  tokenAddress?:          string;   // omit for ETH, set for ERC20
  amount:                 bigint;   // NET payee receives
  fee:                    bigint;   // protocol fee (from quoteGross)
  settlementTimeUnixSec:  bigint;   // absolute Unix timestamp
}
```

### FactoryInfo fields

```ts
{
  factoryAddress:         string;
  defaultImpl:            string;
  defaultImplName:        string;
  feeBps:                 bigint;
  feeRecipient:           string;
  arbitrator:             string;
  arbitratorConfiguration: string;
  metaEvidenceUri:        string;
  owner:                  string;
  pendingOwner:           string;
}
```

## Payment reads

| Method | Returns |
|--------|---------|
| `dPayment.read()` | `PaymentInfo`, all on-chain state |
| `dPayment.arbitrationCost()` | `bigint`, current Kleros arbitration fee in wei |
| `dPayment.appealCost()` | `bigint`, current appeal fee (DISPUTED only) |
| `dPayment.appealPeriod()` | `{ start, end }`, appeal window (DISPUTED only) |
| `dPayment.pendingWithdrawal(address)` | `bigint`, ETH queued for pull-payment fallback |
| `dPayment.getEvidenceLogs(fromBlock, toBlock)` | `PaymentEvidenceEvent[]`, evidence log history |
| `dPayment.getLogs()` | `PaymentEvent[]`, all payment events |

### PaymentInfo fields

```ts
{
  paymentAddress:          string;
  state:                   PaymentState;
  payer:                   string;
  payee:                   string;
  token:                   string;       // 0x0 = ETH
  amount:                  bigint;       // NET (payee receives this)
  settlementTime:          bigint;       // Unix sec
  disputeId:               bigint;       // 0n = never disputed
  disputeStartTime:        bigint;       // Unix sec
  arbitratorAddress:       string;
  arbitratorConfiguration: string;       // raw hex (snapshotted at creation)
}
```

## Payment writes

| Method | Description |
|--------|-------------|
| `dPayment.settle()` | Build settle tx. |
| `dPayment.voluntaryRefund()` | Build voluntary refund tx. |
| `dPayment.prepareRaiseDispute()` | Fetch arb fee + build raiseDispute tx. |
| `dPayment.raiseDispute(arbFeeWei)` | Build raiseDispute tx. |
| `dPayment.submitEvidence(uri)` | Build evidence tx. |
| `dPayment.appeal(extraData, feeWei)` | Build appeal tx. |
| `dPayment.prepareAppeal(extraData?)` | Fetch appeal fee + period + build tx. |
| `dPayment.claim()` | Build claim tx. |

## Event topics

```ts
import { PaymentTopics } from '@rakelabs/dpayments-sdk';
```

## PreparedTx shape

Every write method returns a `PreparedTx`:

```ts
{
  to:         string;   // contract address
  data:       string;   // calldata (0x-prefixed)
  value:      string;   // ETH in wei (decimal string)
  chainId:    number;
  signerHint?: string;  // human-readable action label
  preview?:   SigningPreview;  // structured fee breakdown for wallet UI
}
```

## Common mistakes

| Mistake | Fix |
|---------|-----|
| Forgot to pass `value` when sending an ETH payment create tx. | Include `value: BigInt(tx.value)` in `sendTransaction`. |
| Used `createEthPayment` with a `tokenAddress`. | Use `createErc20Payment` for ERC20 tokens. |
| Skipped ERC20 `approve()` before creating an ERC20 payment. | `prepareCreateErc20Payment` returns an `approveTx`. Send it first. |
| Called `appealCost` or `appealPeriod` on a non-DISPUTED payment. | Check `info.state === PaymentState.DISPUTED` first. |
| Passed `tx.value` directly into signers that expect bigint. | Use `BigInt(tx.value)`. |
