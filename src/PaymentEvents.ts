import { id as ethersId } from 'ethers';
import { matchesTopic, type EvmLog } from './common/index.js';
import type {
    PaymentCreatedEvent,
    PaymentSettledEvent,
    DisputeRaisedEvent,
    ResolvedToPayeeEvent,
    RefundedToPayerEvent,
    PaymentEvidenceEvent,
} from './types.js';
import { PaymentFactory__factory, DisputablePayment__factory } from '../generated/typechain/index.js';

// ─── TypeChain-generated interfaces for event parsing ────────────────────────

const factoryIface = PaymentFactory__factory.createInterface();
const paymentIface = DisputablePayment__factory.createInterface();

// ─── Pre-computed topic0 hashes (keccak256 of canonical event signature) ───────

/** Topic0 for PaymentFactory.PaymentCreated */
export const TOPIC_PAYMENT_CREATED   = ethersId('PaymentCreated(bytes32,address,address,address,address,uint256,uint256,uint256)');
/** Topic0 for DisputablePayment.PaymentSettled */
export const TOPIC_PAYMENT_SETTLED   = ethersId('PaymentSettled(address,uint256)');
/** Topic0 for DisputablePayment.DisputeRaised */
export const TOPIC_DISPUTE_RAISED   = ethersId('DisputeRaised(uint256,address)');
/** Topic0 for DisputablePayment.ResolvedToPayee */
export const TOPIC_RESOLVED_TO_PAYEE = ethersId('ResolvedToPayee(address,uint256)');
/** Topic0 for DisputablePayment.RefundedToPayer */
export const TOPIC_REFUNDED_TO_PAYER = ethersId('RefundedToPayer(address,uint256)');
/** Topic0 for IEvidence.Evidence emitted by a payment clone */
export const TOPIC_EVIDENCE          = ethersId('Evidence(address,uint256,address,string)');

/**
 * All DisputablePayment event topic0 hashes as a single object.
 *
 * Use this for custom `eth_getLogs` topic filtering.
 *
 * @example
 * provider.getLogs({ topics: [PaymentTopics.PAYMENT_SETTLED], address: cloneAddr })
 */
export const PaymentTopics = {
    PAYMENT_CREATED:   TOPIC_PAYMENT_CREATED,
    PAYMENT_SETTLED:   TOPIC_PAYMENT_SETTLED,
    DISPUTE_RAISED:    TOPIC_DISPUTE_RAISED,
    RESOLVED_TO_PAYEE: TOPIC_RESOLVED_TO_PAYEE,
    REFUNDED_TO_PAYER: TOPIC_REFUNDED_TO_PAYER,
    EVIDENCE:          TOPIC_EVIDENCE,
} as const;

// ─── PaymentEvents ────────────────────────────────────────────────────────────

/**
 * Stateless log decoder for PaymentFactory and DisputablePayment events.
 *
 * Each tryDecode* method:
 *   1. Returns undefined immediately if topics[0] does not match.
 *   2. Returns the decoded event object on match.
 *   3. Throws if the log is structurally malformed.
 *
 * Usage:
 *   const events = new PaymentEvents();
 *   events.tryDecodePaymentCreated(log)?.paymentAddress;
 */
export class PaymentEvents {

    // ─── Factory events ───────────────────────────────────────────────────────

    /**
     * Tries to decode a PaymentFactory.PaymentCreated log.
     */
    tryDecodePaymentCreated(log: EvmLog): PaymentCreatedEvent | undefined {
        if (!matchesTopic(log, TOPIC_PAYMENT_CREATED)) return undefined;
        const parsed = factoryIface.parseLog({ topics: log.topics as string[], data: log.data })!;
        return {
            paymentId:       parsed.args.id             as string,
            paymentAddress:  parsed.args.payment        as string,
            creator:         parsed.args.creator        as string,
            payee:           parsed.args.payee          as string,
            token:           parsed.args.token          as string,
            amount:          parsed.args.amount         as bigint,
            fee:             parsed.args.fee            as bigint,
            settlementTime:  parsed.args.settlementTime as bigint,
            logAddress:      log.address,
            transactionHash: log.transactionHash,
        };
    }

    // ─── Payment clone events ─────────────────────────────────────────────────

    /**
     * Tries to decode a DisputablePayment.PaymentSettled log.
     */
    tryDecodePaymentSettled(log: EvmLog): PaymentSettledEvent | undefined {
        if (!matchesTopic(log, TOPIC_PAYMENT_SETTLED)) return undefined;
        const parsed = paymentIface.parseLog({ topics: log.topics as string[], data: log.data })!;
        return {
            payee:           parsed.args.payee  as string,
            amount:          parsed.args.amount as bigint,
            logAddress:      log.address,
            transactionHash: log.transactionHash,
        };
    }

    /**
     * Tries to decode a DisputablePayment.DisputeRaised log.
     */
    tryDecodeDisputeRaised(log: EvmLog): DisputeRaisedEvent | undefined {
        if (!matchesTopic(log, TOPIC_DISPUTE_RAISED)) return undefined;
        const parsed = paymentIface.parseLog({ topics: log.topics as string[], data: log.data })!;
        return {
            disputeId:       parsed.args.disputeId as bigint,
            raisedBy:        parsed.args.raisedBy  as string,
            logAddress:      log.address,
            transactionHash: log.transactionHash,
        };
    }

    /**
     * Tries to decode a DisputablePayment.ResolvedToPayee log.
     */
    tryDecodeResolvedToPayee(log: EvmLog): ResolvedToPayeeEvent | undefined {
        if (!matchesTopic(log, TOPIC_RESOLVED_TO_PAYEE)) return undefined;
        const parsed = paymentIface.parseLog({ topics: log.topics as string[], data: log.data })!;
        return {
            payee:           parsed.args.payee as string,
            paid:            parsed.args.paid  as bigint,
            logAddress:      log.address,
            transactionHash: log.transactionHash,
        };
    }

    /**
     * Tries to decode a DisputablePayment.RefundedToPayer log.
     */
    tryDecodeRefundedToPayer(log: EvmLog): RefundedToPayerEvent | undefined {
        if (!matchesTopic(log, TOPIC_REFUNDED_TO_PAYER)) return undefined;
        const parsed = paymentIface.parseLog({ topics: log.topics as string[], data: log.data })!;
        return {
            payer:           parsed.args.payer as string,
            paid:            parsed.args.paid  as bigint,
            logAddress:      log.address,
            transactionHash: log.transactionHash,
        };
    }

    // ─── Evidence ─────────────────────────────────────────────────────────────

    /**
     * Tries to decode an IEvidence.Evidence log emitted by a payment clone.
     */
    tryDecodeEvidence(log: EvmLog): PaymentEvidenceEvent | undefined {
        if (!matchesTopic(log, TOPIC_EVIDENCE)) return undefined;
        const parsed = paymentIface.parseLog({ topics: log.topics as string[], data: log.data })!;
        return {
            arbitrator:      parsed.args._arbitrator      as string,
            evidenceGroupId: parsed.args._evidenceGroupID as bigint,
            party:           parsed.args._party           as string,
            evidenceUri:     parsed.args._evidence        as string,
            logAddress:      log.address,
            transactionHash: log.transactionHash,
        };
    }
}
