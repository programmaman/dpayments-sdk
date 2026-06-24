/**
 * Represents the current status of a payment workflow.
 */
export enum PaymentState {
    PAID = 0,
    SETTLED = 1,
    DISPUTED = 2,
    RESOLVED = 3,
}

export function paymentStateFromOrdinal(ordinal: number): PaymentState {
    if (ordinal < 0 || ordinal > 3) throw new Error(`Unknown PaymentState ordinal: ${ordinal}`);
    return ordinal;
}

// ─── Reader result types ───────────────────────────────────────────────────────

/** Snapshot of PaymentFactory on-chain config. Returned by PaymentReader.readFactory(). */
export interface FactoryInfo {
    factoryAddress: string;
    defaultImpl: string;
    defaultImplName: string;
    feeBps: bigint;
    feeRecipient: string;
    arbitrator: string;
    arbitratorConfiguration: string;
    metaEvidenceUri: string;
    owner: string;
    /** Non-empty only while a 2-step ownership transfer is pending. */
    pendingOwner: string;
}

/**
 * Result of PaymentFactory.quoteGross(net).
 */
export interface FeeQuote {
    gross: bigint;
    fee: bigint;
}

/**
 * Snapshot of all on-chain state for a deployed DisputablePayment clone.
 * Returned by PaymentReader.readPayment().
 * Addresses are EIP-55 checksummed; zero address means slot is unset.
 */
export interface PaymentInfo {
    paymentAddress: string;
    state: PaymentState;
    payer: string;
    payee: string;
    /** Token contract address. */
    token: string;
    /** NET amount the payee receives */
    amount: bigint;
    /** Unix timestamp (seconds) when payee can claim */
    settlementTime: bigint;
    disputeId: bigint;
    disputeStartTime: bigint;
    /** Kleros arbitrator address snapshotted at payment initialization. */
    arbitratorAddress: string;
    /** Arbitrator configuration hex string. */
    arbitratorConfiguration: string;
}

/**
 * A registered payment implementation entry.
 * Returned by PaymentReader.readImplementationAt().
 */
export interface PaymentImplementationInfo {
    address: string;
    name: string;
}

/**
 * Appeal window for a disputed payment.
 */
export interface AppealPeriod {
    start: bigint;
    end: bigint;
}

// ─── Minimal EVM log shape — re-exported from common for SDK consumer convenience ──
export type { EvmLog } from './common/LogUtils.js';

// ─── Prepare helper input / result types ──────────────────────────────────────

/**
 * Input for `factory.prepareCreateEthPayment` and `factory.prepareCreateErc20Payment`.
 * Pass `netAmount` — the gross and fee are quoted automatically.
 * `paymentId` is auto-generated (cryptographically random bytes32) if omitted.
 */
export interface PrepareCreateParams {
    /** Net payment amount (before fee). The fee will be quoted and added automatically. */
    netAmount: bigint;
    /** bytes32 hex — auto-generated if omitted. */
    paymentId?: string;
    payeeAddress: string;
    /** Absolute settlement time (Unix seconds). Payee can claim after this. */
    settlementTimeUnixSec: bigint;
}

/** Input for `factory.prepareCreateErc20Payment` — extends `PrepareCreateParams` with token. */
export interface PrepareCreateErc20Params extends PrepareCreateParams {
    tokenAddress: string;
}

/** Result of `factory.prepareCreateEthPayment`. */
export interface PrepareCreateEthResult {
    /** Unsigned transaction to deploy the payment clone. */
    tx: import('./common/PreparedTx.js').PreparedTx;
    /** The paymentId used. */
    paymentId: string;
    /** Gross amount including protocol fee. */
    gross: bigint;
    /** Protocol fee portion. */
    fee: bigint;
}

/** Result of `factory.prepareCreateErc20Payment`. */
export interface PrepareCreateErc20Result {
    /** Unsigned `createPayment` transaction. */
    createTx: import('./common/PreparedTx.js').PreparedTx;
    /**
     * Unsigned ERC20 `approve(predictedAddress, gross)` transaction.
     * **Send this before `createTx`.**
     */
    approveTx: import('./common/PreparedTx.js').PreparedTx;
    /** The paymentId used. */
    paymentId: string;
    /** Gross amount including protocol fee. */
    gross: bigint;
    /** Protocol fee portion. */
    fee: bigint;
    /** Deterministic clone address — the spender for the ERC20 approve. */
    predictedAddress: string;
}

/** Result of `payment.prepareRaiseDispute()`. */
export interface PrepareRaiseDisputeResult {
    /** Unsigned dispute transaction. */
    tx: import('./common/PreparedTx.js').PreparedTx;
    /** Kleros arbitration cost in wei. */
    arbFeeWei: bigint;
}

/** Result of `payment.prepareAppeal()`. */
export interface PrepareAppealResult {
    /** Unsigned appeal transaction. */
    tx: import('./common/PreparedTx.js').PreparedTx;
    /** Appeal fee in wei. */
    appealFeeWei: bigint;
    /** The appeal window read from on-chain. Check `end > 0n` before sending. */
    appealPeriod: AppealPeriod;
}

// ─── Event types ──────────────────────────────────────────────────────────────

/** Decoded PaymentFactory.PaymentCreated event. */
export interface PaymentCreatedEvent {
    /** bytes32 id as hex string */
    paymentId: string;
    paymentAddress: string;
    /** address that called createPayment */
    creator: string;
    payee: string;
    token: string;
    /** Net amount the payee receives */
    amount: bigint;
    /** Protocol fee */
    fee: bigint;
    settlementTime: bigint;
    logAddress: string;
    transactionHash: string | undefined;
}

/** Decoded DisputablePayment.PaymentSettled event. */
export interface PaymentSettledEvent {
    payee: string;
    amount: bigint;
    logAddress: string;
    transactionHash: string | undefined;
}

/** Decoded DisputablePayment.DisputeRaised event. */
export interface DisputeRaisedEvent {
    disputeId: bigint;
    raisedBy: string;
    logAddress: string;
    transactionHash: string | undefined;
}

/** Decoded DisputablePayment.ResolvedToPayee event. */
export interface ResolvedToPayeeEvent {
    payee: string;
    paid: bigint;
    logAddress: string;
    transactionHash: string | undefined;
}

/** Decoded DisputablePayment.RefundedToPayer event. */
export interface RefundedToPayerEvent {
    payer: string;
    paid: bigint;
    logAddress: string;
    transactionHash: string | undefined;
}

/** Decoded IEvidence.Evidence event emitted by a payment clone. */
export interface PaymentEvidenceEvent {
    party: string;
    evidenceGroupId: bigint;
    arbitrator: string;
    evidenceUri: string;
    logAddress: string;
    transactionHash: string | undefined;
}

/** Union of all payment event types (for convenience when iterating). */
export type PaymentEvent =
    | PaymentCreatedEvent
    | PaymentSettledEvent
    | DisputeRaisedEvent
    | ResolvedToPayeeEvent
    | RefundedToPayerEvent
    | PaymentEvidenceEvent;
