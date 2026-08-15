import { matchesTopic, type EvmLog } from './common/index.js';
import type { AbiCodec, Hex } from './common/AbiCodec.js';
import { PAYMENT_EVENT_TOPICS } from './abi.js';
import type {
    PaymentCreatedEvent,
    PaymentSettledEvent,
    DisputeRaisedEvent,
    ResolvedToPayeeEvent,
    RefundedToPayerEvent,
    ConsumedEvent,
    PaymentEvidenceEvent,
} from './types.js';

export const TOPIC_PAYMENT_CREATED = PAYMENT_EVENT_TOPICS.PAYMENT_CREATED;
export const TOPIC_PAYMENT_SETTLED = PAYMENT_EVENT_TOPICS.PAYMENT_SETTLED;
export const TOPIC_DISPUTE_RAISED = PAYMENT_EVENT_TOPICS.DISPUTE_RAISED;
export const TOPIC_RESOLVED_TO_PAYEE = PAYMENT_EVENT_TOPICS.RESOLVED_TO_PAYEE;
export const TOPIC_REFUNDED_TO_PAYER = PAYMENT_EVENT_TOPICS.REFUNDED_TO_PAYER;
export const TOPIC_CONSUMED = PAYMENT_EVENT_TOPICS.CONSUMED;
export const TOPIC_EVIDENCE = PAYMENT_EVENT_TOPICS.EVIDENCE;

export const PaymentTopics = {
    PAYMENT_CREATED: TOPIC_PAYMENT_CREATED,
    PAYMENT_SETTLED: TOPIC_PAYMENT_SETTLED,
    DISPUTE_RAISED: TOPIC_DISPUTE_RAISED,
    RESOLVED_TO_PAYEE: TOPIC_RESOLVED_TO_PAYEE,
    REFUNDED_TO_PAYER: TOPIC_REFUNDED_TO_PAYER,
    CONSUMED: TOPIC_CONSUMED,
    EVIDENCE: TOPIC_EVIDENCE,
} as const;

const CREATED = 'PaymentCreated(bytes32,address,address,address,address,uint256,uint256,uint256)';
const SETTLED = 'PaymentSettled(address,uint256)';
const DISPUTE = 'DisputeRaised(uint256,address)';
const RESOLVED = 'ResolvedToPayee(address,uint256)';
const REFUNDED = 'RefundedToPayer(address,uint256)';
const CONSUMED = 'Consumed()';
const EVIDENCE = 'Evidence(address,uint256,address,string)';

export class PaymentEvents {
    constructor(private readonly codec: AbiCodec) {}

    tryDecodePaymentCreated(log: EvmLog): PaymentCreatedEvent | undefined {
        if (!matchesTopic(log, TOPIC_PAYMENT_CREATED)) return undefined;
        const event = this.codec.decodeEvent(CREATED, log.topics as Hex[], log.data as Hex);
        return {
            paymentId: event.id as string,
            paymentAddress: event.payment as string,
            creator: event.creator as string,
            payee: event.payee as string,
            token: event.token as string,
            amount: event.amount as bigint,
            fee: event.fee as bigint,
            settlementTime: event.settlementTime as bigint,
            logAddress: log.address,
            transactionHash: log.transactionHash,
        };
    }

    tryDecodePaymentSettled(log: EvmLog): PaymentSettledEvent | undefined {
        if (!matchesTopic(log, TOPIC_PAYMENT_SETTLED)) return undefined;
        const event = this.codec.decodeEvent(SETTLED, log.topics as Hex[], log.data as Hex);
        return { payee: event.payee as string, amount: event.amount as bigint, logAddress: log.address, transactionHash: log.transactionHash };
    }

    tryDecodeDisputeRaised(log: EvmLog): DisputeRaisedEvent | undefined {
        if (!matchesTopic(log, TOPIC_DISPUTE_RAISED)) return undefined;
        const event = this.codec.decodeEvent(DISPUTE, log.topics as Hex[], log.data as Hex);
        return { disputeId: event.disputeId as bigint, raisedBy: event.raisedBy as string, logAddress: log.address, transactionHash: log.transactionHash };
    }

    tryDecodeResolvedToPayee(log: EvmLog): ResolvedToPayeeEvent | undefined {
        if (!matchesTopic(log, TOPIC_RESOLVED_TO_PAYEE)) return undefined;
        const event = this.codec.decodeEvent(RESOLVED, log.topics as Hex[], log.data as Hex);
        return { payee: event.payee as string, paid: event.paid as bigint, logAddress: log.address, transactionHash: log.transactionHash };
    }

    tryDecodeRefundedToPayer(log: EvmLog): RefundedToPayerEvent | undefined {
        if (!matchesTopic(log, TOPIC_REFUNDED_TO_PAYER)) return undefined;
        const event = this.codec.decodeEvent(REFUNDED, log.topics as Hex[], log.data as Hex);
        return { payer: event.payer as string, paid: event.paid as bigint, logAddress: log.address, transactionHash: log.transactionHash };
    }

    tryDecodeConsumed(log: EvmLog): ConsumedEvent | undefined {
        if (!matchesTopic(log, TOPIC_CONSUMED)) return undefined;
        this.codec.decodeEvent(CONSUMED, log.topics as Hex[], log.data as Hex);
        return { logAddress: log.address, transactionHash: log.transactionHash };
    }

    tryDecodeEvidence(log: EvmLog): PaymentEvidenceEvent | undefined {
        if (!matchesTopic(log, TOPIC_EVIDENCE)) return undefined;
        const event = this.codec.decodeEvent(EVIDENCE, log.topics as Hex[], log.data as Hex);
        return {
            arbitrator: event.arbitrator as string,
            evidenceGroupId: event.evidenceGroupId as bigint,
            party: event.party as string,
            evidenceUri: event.evidenceUri as string,
            logAddress: log.address,
            transactionHash: log.transactionHash,
        };
    }
}
