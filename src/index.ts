// ─── Main entry points ─────────────────────────────────────────────────────
export { DPayments, FactoryHandle } from './DPayments.js';
export type { DPaymentsSdkConfig } from './DPayments.js';

// ─── Bound dPayment handle ───────────────────────────────────────────────────
export { DPayment } from './DPayment.js';

// ─── Transaction builder ────────────────────────────────────────────────────
export { PaymentTxBuilder } from './PaymentTxBuilder.js';
export type { PaymentsConfig, CreatePaymentParams, PaymentActionParams, RaiseDisputeParams, SubmitEvidenceParams, AppealParams, Erc20ApproveParams } from './PaymentTxBuilder.js';

// ─── Reader ─────────────────────────────────────────────────────────────────
export { PaymentReader } from './PaymentReader.js';

// ─── Events ─────────────────────────────────────────────────────────────────
export { PaymentEvents, PaymentTopics, TOPIC_PAYMENT_CREATED, TOPIC_PAYMENT_SETTLED, TOPIC_DISPUTE_RAISED, TOPIC_RESOLVED_TO_PAYEE, TOPIC_REFUNDED_TO_PAYER, TOPIC_EVIDENCE } from './PaymentEvents.js';

// ─── Types ──────────────────────────────────────────────────────────────────
export { PaymentState, paymentStateFromOrdinal } from './types.js';
export type {
    FactoryInfo,
    FeeQuote,
    PaymentInfo,
    PaymentImplementationInfo,
    AppealPeriod,
    EvmLog,
    PrepareCreateParams,
    PrepareCreateErc20Params,
    PrepareCreateEthResult,
    PrepareCreateErc20Result,
    PrepareRaiseDisputeResult,
    PrepareAppealResult,
    PaymentCreatedEvent,
    PaymentSettledEvent,
    DisputeRaisedEvent,
    ResolvedToPayeeEvent,
    RefundedToPayerEvent,
    PaymentEvidenceEvent,
    PaymentEvent,
} from './types.js';

// ─── Common ─────────────────────────────────────────────────────────────────
export type { PreparedTx } from './common/PreparedTx.js';
export type { SigningPreview, FeeBreakdown, FeeLineItem } from './common/TxPreview.js';
export { IdGenerator, requireAddress, uuidToBytes32Hex, bytes32HexToUuid, ZERO_ADDRESS, buildFeeBreakdown, formatUnixSec } from './common/index.js';

// ─── Multicall ──────────────────────────────────────────────────────────────
export type { MulticallConfig } from './multicall.js';

// ─── Error decoder ─────────────────────────────────────────────────────────
export { decodeDPaymentError } from './error-decoder.js';
export type { DecodedRevert } from './error-decoder.js';

// ─── Deployments ────────────────────────────────────────────────────────────
export * as DPaymentsDeployments from './deployments.js';
export { FACTORY_ADDRESS, SUPPORTED_CHAIN_IDS, isSupportedChainId, requireSupportedChainId, getFactoryAddress, listDeployments } from './deployments.js';
