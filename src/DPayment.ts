import type { AbstractProvider } from 'ethers';
import type { PreparedTx } from './common/index.js';
import type {
    PaymentInfo,
    AppealPeriod,
    PaymentState,
    PaymentEvent,
    PaymentEvidenceEvent,
    PrepareRaiseDisputeResult,
    PrepareAppealResult,
} from './types.js';
import type { PaymentsConfig } from './PaymentTxBuilder.js';
import type { PaymentReadable } from './internal/PaymentReadable.js';
import { PaymentReader } from './PaymentReader.js';
import { PaymentTxBuilder } from './PaymentTxBuilder.js';
import { PaymentEvents, TOPIC_EVIDENCE } from './PaymentEvents.js';

/**
 * A handle bound to a specific deployed DisputablePayment clone.
 *
 * Obtained via `DPayments.payment(address)` — construction is free (no network call).
 *
 * Read methods (`read`, `arbitrationCost`, …) are `async` and hit the chain.
 * Write methods (`settle`, `refund`, `raiseDispute`, …) are synchronous and return an
 * unsigned `PreparedTx`. The caller's wallet signs and broadcasts.
 *
 * `walletAddress` (set on the SDK or overridden per-call) fills `callerWallet`
 * in every `PreparedTx` automatically, so callers never have to pass it manually.
 */
export class DPayment {
    readonly read: PaymentReadable<[]>;

    constructor(
        /** On-chain address of this DisputablePayment clone. */
        readonly address: string,
        private readonly cfg:      PaymentsConfig,
        private readonly reader:   PaymentReader,
        private readonly builder:  PaymentTxBuilder,
        private readonly decoder:  PaymentEvents,
        private readonly provider: AbstractProvider,
        private readonly walletAddress?: string,
    ) {
        this.read = Object.assign(
            () => this.reader.readPayment(this.address),
            {
                state: () => this.reader.readPayment.state(this.address),
                payer: () => this.reader.readPayment.payer(this.address),
                payee: () => this.reader.readPayment.payee(this.address),
                token: () => this.reader.readPayment.token(this.address),
                amount: () => this.reader.readPayment.amount(this.address),
                settlementTime: () => this.reader.readPayment.settlementTime(this.address),
                consumed: () => this.reader.readPayment.consumed(this.address),
                disputeId: () => this.reader.readPayment.disputeId(this.address),
                disputeStartTime: () => this.reader.readPayment.disputeStartTime(this.address),
                arbitrator: () => this.reader.readPayment.arbitrator(this.address),
                arbitratorConfiguration: () =>
                    this.reader.readPayment.arbitratorConfiguration(this.address),
                arbitrationCost: () => this.reader.readPayment.arbitrationCost(this.address),
                appealCost: () => this.reader.readPayment.appealCost(this.address),
                appealPeriod: () => this.reader.readPayment.appealPeriod(this.address),
                pendingWithdrawal: (wallet: string) =>
                    this.reader.readPayment.pendingWithdrawal(this.address, wallet),
            },
        );
    }

    // ─── Reads (async, no wallet required) ────────────────────────────────────

    /** Current Kleros arbitration cost in wei. */
    arbitrationCost(): Promise<bigint> {
        return this.reader.readArbitrationCost(this.address);
    }

    /** Current Kleros appeal cost in wei. Throws if not DISPUTED. */
    appealCost(): Promise<bigint> {
        return this.reader.readAppealCost(this.address);
    }

    /** Current appeal window. */
    appealPeriod(): Promise<AppealPeriod> {
        return this.reader.readAppealPeriod(this.address);
    }

    /**
     * ETH queued for a wallet that can be claimed.
     */
    pendingWithdrawal(wallet: string): Promise<bigint> {
        return this.reader.readPendingWithdrawal(this.address, wallet);
    }

    // ─── Lifecycle writes ─────────────────────────────────────────────────────

    /** Payee claims funds after settlementTime has passed. */
    settle(wallet?: string): PreparedTx {
        return this.builder.settle(this.cfg, {
            callerWallet:  this.resolveWallet(wallet),
            paymentAddress: this.address,
        });
    }

    /** Payee voluntarily refunds the payer before settlement. */
    voluntaryRefund(wallet?: string): PreparedTx {
        return this.builder.voluntaryRefund(this.cfg, {
            callerWallet:  this.resolveWallet(wallet),
            paymentAddress: this.address,
        });
    }

    /** Payee marks the payment as consumed without settling the funds. */
    consume(wallet?: string): PreparedTx {
        return this.builder.consume(this.cfg, {
            callerWallet:  this.resolveWallet(wallet),
            paymentAddress: this.address,
        });
    }

    /** Payer raises a Kleros dispute. */
    raiseDispute(arbFeeWei: bigint, wallet?: string): PreparedTx {
        return this.builder.raiseDispute(this.cfg, {
            callerWallet:  this.resolveWallet(wallet),
            paymentAddress: this.address,
            arbFeeWei,
        });
    }

    /** Submit evidence URI to Kleros arbitration. */
    submitEvidence(evidenceUri: string, wallet?: string): PreparedTx {
        return this.builder.submitEvidence(this.cfg, {
            callerWallet:  this.resolveWallet(wallet),
            paymentAddress: this.address,
            evidenceUri,
        });
    }

    /** Appeal a Kleros ruling. */
    appeal(extraData: string, appealFeeWei: bigint, wallet?: string): PreparedTx {
        return this.builder.appeal(this.cfg, {
            callerWallet:  this.resolveWallet(wallet),
            paymentAddress: this.address,
            extraData,
            appealFeeWei,
        });
    }

    claim(wallet?: string): PreparedTx {
        return this.builder.claim(this.cfg, {
            callerWallet:  this.resolveWallet(wallet),
            paymentAddress: this.address,
        });
    }

    // ─── Prepare helpers ──────────────────────────────────────────────────────

    /** Reads arbitration cost, then builds the raiseDispute transaction. */
    async prepareRaiseDispute(wallet?: string): Promise<PrepareRaiseDisputeResult> {
        const arbFeeWei = await this.reader.readArbitrationCost(this.address);
        const tx = this.builder.raiseDispute(this.cfg, {
            callerWallet:  this.resolveWallet(wallet),
            paymentAddress: this.address,
            arbFeeWei,
        });
        return { tx, arbFeeWei };
    }

    /** Reads appeal cost + appeal period, then builds the appeal transaction. */
    async prepareAppeal(extraData: string = '0x', wallet?: string): Promise<PrepareAppealResult> {
        const [appealFeeWei, appealPeriod] = await Promise.all([
            this.reader.readAppealCost(this.address),
            this.reader.readAppealPeriod(this.address),
        ]);
        const tx = this.builder.appeal(this.cfg, {
            callerWallet:  this.resolveWallet(wallet),
            paymentAddress: this.address,
            extraData,
            appealFeeWei,
        });
        return { tx, appealFeeWei, appealPeriod };
    }

    // ─── Event history ─────────────────────────────────────────────────────────

    /**
     * Fetches all events emitted by this payment clone.
     *
     * @param fromBlock  First block to scan (default: 0).
     * @param toBlock    Last block to scan (default: 'latest').
     */
    async getLogs(
        fromBlock: number | 'earliest' = 0,
        toBlock:   number | 'latest'   = 'latest',
    ): Promise<PaymentEvent[]> {
        const rawLogs = await this.provider.getLogs({
            address:  this.address,
            fromBlock,
            toBlock,
        });

        return rawLogs.flatMap(log => {
            const evmLog = {
                address:         log.address,
                topics:          log.topics,
                data:            log.data,
                transactionHash: log.transactionHash,
            };
            const decoded = this.decoder.tryDecodePaymentSettled(evmLog)
                ?? this.decoder.tryDecodeDisputeRaised(evmLog)
                ?? this.decoder.tryDecodeResolvedToPayee(evmLog)
                ?? this.decoder.tryDecodeRefundedToPayer(evmLog)
                ?? this.decoder.tryDecodeConsumed(evmLog)
                ?? this.decoder.tryDecodeEvidence(evmLog);
            return decoded ? [decoded] : [];
        });
    }

    /**
     * Fetches all Evidence events emitted by this payment clone.
     */
    async getEvidenceLogs(
        fromBlock: number | 'earliest' = 0,
        toBlock:   number | 'latest'   = 'latest',
    ): Promise<PaymentEvidenceEvent[]> {
        const rawLogs = await this.provider.getLogs({
            address:  this.address,
            topics:   [TOPIC_EVIDENCE],
            fromBlock,
            toBlock,
        });

        return rawLogs.flatMap(log => {
            const evmLog = {
                address:         log.address,
                topics:          log.topics,
                data:            log.data,
                transactionHash: log.transactionHash,
            };
            const decoded = this.decoder.tryDecodeEvidence(evmLog);
            return decoded ? [decoded] : [];
        });
    }

    // ─── Internals ─────────────────────────────────────────────────────────

    private resolveWallet(override?: string): string {
        const w = override ?? this.walletAddress;
        if (!w) throw new Error(
            'walletAddress is required — pass it to new DPayments({ walletAddress }) or as the last argument to this method.',
        );
        return w;
    }
}
