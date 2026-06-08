# Disputes

A payment can enter a dispute when the payer raises one before the settlement time.

## Flow

1. **Payer calls `raiseDispute`**: the payment's Kleros arbitrator creates a dispute on-chain.
2. **Jurors review evidence**: both parties submit evidence URIs (IPFS recommended).
3. **Kleros rules**: the ruling decides whether the payer or payee gets the funds.
4. **Funds released**: the ruling is enforced automatically on-chain.

> Rulings override settlement. Once disputed, the payment cannot be settled or refunded until Kleros issues a ruling.

## Raise a dispute

```ts
const payment = dpayments.dPayment('0xPAYMENT_ADDRESS');

// Fetch the required arbitration fee, then prepare the transaction.
const { tx, arbFeeWei } = await payment.prepareRaiseDispute();
await signer.sendTransaction({ ...tx, value: arbFeeWei.toString() });
// → State: DISPUTED
```

## Submit evidence

```ts
const payment = dpayments.dPayment('0xPAYMENT_ADDRESS');

// Both the payer and payee can submit evidence while the dispute is pending.
await signer.sendTransaction(
  payment.submitEvidence('ipfs://QmYourEvidenceDoc')
);
```

## Reading the ruling

```ts
const info = await payment.read();
// info.state === DisputeState.RESOLVED
// info.ruling === 1n  // 1 = payer wins, 2 = payee wins
```

## Appeals

If either party disagrees with the ruling, they can appeal within the appeal window.

```ts
const { tx: appealTx, appealFeeWei, appealPeriod } = await payment.prepareAppeal();
await signer.sendTransaction({ ...appealTx, value: appealFeeWei.toString() });
```

## State transitions

```
PAID  ──→  DISPUTED  ──→  RESOLVED  (Kleros ruling)
         │                    ↑
         └── appeals ─────────┘
```
