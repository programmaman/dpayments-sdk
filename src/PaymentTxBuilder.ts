import { Interface, ZeroAddress } from 'ethers';
import type { PreparedTx } from './common/index.js';
import { requireAddress, type SigningPreview, buildFeeBreakdown, formatUnixSec, ZERO_ADDRESS } from './common/index.js';
import { PaymentFactory__factory, DisputablePayment__factory } from '../generated/typechain/index.js';

// ─── Configuration ─────────────────────────────────────────────────────────────

export interface PaymentsConfig {
    chainId: number;
    factoryAddress: string;
}

// ─── Parameter types ───────────────────────────────────────────────────────────

export interface CreatePaymentParams {
    callerWallet: string;
    /** bytes32 as 0x-prefixed hex — use IdGenerator.generateOnChainIdHex() or uuidToBytes32Hex() */
    paymentId: string;
    payeeAddress: string;
    tokenAddress?: string | null;
    /** NET amount the payee receives (before any fee addition). Gross = amount + fee. */
    amount: bigint;
    /** Protocol fee to be paid along with the amount. */
    fee: bigint;
    /** Absolute settlement time (Unix seconds). Payee can claim after this. */
    settlementTimeUnixSec: bigint;
    /** Pinned payment implementation address. Internal — set by FactoryHandle. */
    impl?: string;
}

export interface PaymentActionParams {
    callerWallet: string;
    paymentAddress: string;
}

export interface RaiseDisputeParams {
    callerWallet: string;
    paymentAddress: string;
    arbFeeWei: bigint;
}

export interface SubmitEvidenceParams {
    callerWallet: string;
    paymentAddress: string;
    evidenceUri: string;
}

export interface AppealParams {
    callerWallet: string;
    paymentAddress: string;
    extraData: string;
    appealFeeWei: bigint;
}

export interface Erc20ApproveParams {
    ownerWallet: string;
    tokenAddress: string;
    spenderAddress: string;
    amount: bigint;
}

// ─── ERC20 approve — not a payment contract, kept as minimal inline fragment
const ERC20_ABI = [
    'function approve(address spender, uint256 amount) returns (bool)',
];

// ─── Internal helpers ──────────────────────────────────────────────────────────

function requireBytes32Hex(value: string, name: string): void {
    if (!value || typeof value !== 'string') {
        throw new Error(`${name} must be a 0x-prefixed 32-byte hex string`);
    }
    const hex = value.startsWith('0x') || value.startsWith('0X') ? value.slice(2) : value;
    if (hex.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(hex)) {
        throw new Error(`${name} must be a 0x-prefixed 32-byte hex string (got: ${value})`);
    }
}

function noValue(
    to: string, data: string, chainId: number, signerHint: string, preview: SigningPreview,
): PreparedTx {
    return { to, data, value: '0', chainId, signerHint, preview };
}

function withValue(
    to: string, data: string, valueWei: bigint, chainId: number, signerHint: string, preview: SigningPreview,
): PreparedTx {
    return { to, data, value: valueWei.toString(), chainId, signerHint, preview };
}

// ─── Builder ───────────────────────────────────────────────────────────────────

/**
 * Stateless transaction builder for the DisputablePayment contracts.
 *
 * Every method returns an unsigned PreparedTx — the caller's wallet signs and
 * submits the transaction. This class never holds private keys.
 */
export class PaymentTxBuilder {
    private readonly factoryIface: Interface;
    private readonly paymentIface: Interface;
    private readonly erc20Iface: Interface;

    constructor() {
        this.factoryIface = PaymentFactory__factory.createInterface() as unknown as Interface;
        this.paymentIface = DisputablePayment__factory.createInterface() as unknown as Interface;
        this.erc20Iface   = new Interface(ERC20_ABI);
    }

    // ─── Factory: createPayment ─────────────────────────────────────────────

    /**
     * Build an unsigned `createPayment` transaction for an ETH-funded payment.
     */
    createEthPayment(cfg: PaymentsConfig, p: CreatePaymentParams): PreparedTx {
        if (p.tokenAddress) throw new Error('tokenAddress must NOT be set for ETH payment');
        return this.buildCreatePayment(cfg, p, null);
    }

    /**
     * Build an unsigned `createPayment` transaction for an ERC20-funded payment.
     */
    createErc20Payment(cfg: PaymentsConfig, p: CreatePaymentParams): PreparedTx {
        if (!p.tokenAddress) throw new Error('tokenAddress must be set for ERC20 payment');
        requireAddress(p.tokenAddress, 'tokenAddress');
        return this.buildCreatePayment(cfg, p, requireAddress(p.tokenAddress, 'tokenAddress'));
    }

    private buildCreatePayment(
        cfg: PaymentsConfig, p: CreatePaymentParams, tokenAddress: string | null,
    ): PreparedTx {
        requireAddress(cfg.factoryAddress, 'factoryAddress');
        requireAddress(p.callerWallet, 'callerWallet');
        requireAddress(p.payeeAddress, 'payeeAddress');
        requireBytes32Hex(p.paymentId, 'paymentId');
        if (p.amount <= 0n) throw new Error('amount must be > 0');
        if (p.fee < 0n) throw new Error('fee must be >= 0');
        if (p.settlementTimeUnixSec <= 0n) throw new Error('settlementTimeUnixSec must be > 0');

        const token = tokenAddress || ZeroAddress;
        const isEth = token === ZeroAddress;
        const gross  = p.amount + p.fee;

        const req = {
            id:             p.paymentId,
            payee:          p.payeeAddress,
            token,
            amount:         p.amount,
            fee:            p.fee,
            settlementTime: p.settlementTimeUnixSec,
        };

        const data = p.impl
            ? this.factoryIface.encodeFunctionData(
                'createPayment(address,(bytes32,address,address,uint256,uint256,uint256))',
                [p.impl, req])
            : this.factoryIface.encodeFunctionData(
                'createPayment((bytes32,address,address,uint256,uint256,uint256))',
                [req]);

        const preview: SigningPreview = {
            action: isEth ? 'Create ETH Payment' : 'Create ERC20 Payment',
            signer: 'payer',
            description: isEth
                ? 'Deploy a new payment contract funded with native ETH.'
                : 'Deploy a new payment contract funded with an ERC20 token.',
            valueWei: isEth ? gross.toString() : undefined,
            token,
            tokenAmountWei: p.amount.toString(),
            fees: buildFeeBreakdown(token, [['Protocol fee', p.fee]]),
            details: {
                'Payment ID':     p.paymentId,
                'Payee':          p.payeeAddress,
                'Token':          token,
                'Net amount':     p.amount.toString(),
                'Protocol fee':   p.fee.toString(),
                'Gross (value)':  gross.toString(),
                'Settlement time': formatUnixSec(p.settlementTimeUnixSec),
            },
        };

        return isEth
            ? withValue(cfg.factoryAddress, data, gross, cfg.chainId, 'Create payment', preview)
            : noValue(cfg.factoryAddress, data, cfg.chainId, 'Create payment', preview);
    }

    // ─── Clone: settle / refund ────────────────────────────────────────────

    /** Payee claims funds. */
    settle(cfg: PaymentsConfig, p: PaymentActionParams): PreparedTx {
        return this.simpleCall(cfg, p, 'settle', 'Settle Payment', {
            signer: 'payee',
            description: 'Claim funds from the payment contract after the settlement time has passed.',
            details: { 'Payment': p.paymentAddress },
        });
    }

    /** Payee voluntarily refunds the payer. */
    voluntaryRefund(cfg: PaymentsConfig, p: PaymentActionParams): PreparedTx {
        return this.simpleCall(cfg, p, 'voluntaryRefund', 'Refund Payment', {
            signer: 'payee',
            description: 'Voluntarily refund all funds back to the payer.',
            details: { 'Payment': p.paymentAddress },
        });
    }

    // ─── Clone: dispute / evidence / appeal ────────────────────────────────

    /** Build an unsigned raiseDispute transaction. */
    raiseDispute(cfg: PaymentsConfig, p: RaiseDisputeParams): PreparedTx {
        requireAddress(p.callerWallet, 'callerWallet');
        requireAddress(p.paymentAddress, 'paymentAddress');
        if (p.arbFeeWei < 0n) throw new Error('arbFeeWei must be >= 0');
        const data = this.paymentIface.encodeFunctionData('dispute', []);
        const preview: SigningPreview = {
            action: 'Raise Dispute',
            signer: 'payer',
            description: 'Open a Kleros arbitration dispute on this payment. The arbitration fee is sent with this transaction.',
            valueWei: p.arbFeeWei.toString(),
            token: ZERO_ADDRESS,
            tokenAmountWei: p.arbFeeWei.toString(),
            fees: buildFeeBreakdown(ZERO_ADDRESS, [['Arbitration fee', p.arbFeeWei]]),
            details: { 'Payment': p.paymentAddress },
        };
        return withValue(p.paymentAddress, data, p.arbFeeWei, cfg.chainId, 'Raise dispute', preview);
    }

    submitEvidence(cfg: PaymentsConfig, p: SubmitEvidenceParams): PreparedTx {
        requireAddress(p.callerWallet, 'callerWallet');
        requireAddress(p.paymentAddress, 'paymentAddress');
        if (!p.evidenceUri?.trim()) throw new Error('evidenceUri must not be blank');
        const data = this.paymentIface.encodeFunctionData('submitEvidence', [p.evidenceUri]);
        const preview: SigningPreview = {
            action: 'Submit Evidence',
            signer: 'either party',
            description: 'Submit an evidence URI (IPFS or HTTPS) to the Kleros arbitration for this payment.',
            details: { 'Payment': p.paymentAddress, 'Evidence URI': p.evidenceUri },
        };
        return noValue(p.paymentAddress, data, cfg.chainId, 'Submit evidence', preview);
    }

    appeal(cfg: PaymentsConfig, p: AppealParams): PreparedTx {
        requireAddress(p.callerWallet, 'callerWallet');
        requireAddress(p.paymentAddress, 'paymentAddress');
        if (p.appealFeeWei < 0n) throw new Error('appealFeeWei must be >= 0');
        const data = this.paymentIface.encodeFunctionData('appeal', [p.extraData ?? '0x']);
        const preview: SigningPreview = {
            action: 'Appeal Ruling',
            signer: 'either party',
            description: 'Appeal the Kleros ruling for this payment. The appeal fee is sent with this transaction.',
            valueWei: p.appealFeeWei.toString(),
            token: ZERO_ADDRESS,
            tokenAmountWei: p.appealFeeWei.toString(),
            fees: buildFeeBreakdown(ZERO_ADDRESS, [['Appeal fee', p.appealFeeWei]]),
            details: { 'Payment': p.paymentAddress },
        };
        return withValue(p.paymentAddress, data, p.appealFeeWei, cfg.chainId, 'Appeal ruling', preview);
    }

    // ─── Clone: claim ──────────────────────────────────────────────────────

    claim(cfg: PaymentsConfig, p: PaymentActionParams): PreparedTx {
        return this.simpleCall(cfg, p, 'claim', 'Claim ETH', {
            signer: 'recipient',
            description: 'Claim ETH that was queued for withdrawal.',
            token: ZERO_ADDRESS,
            details: { 'Payment': p.paymentAddress },
        });
    }

    // ─── ERC20 approve ─────────────────────────────────────────────────────

    /** Build an ERC20 `approve(spender, amount)` transaction. */
    erc20Approve(cfg: PaymentsConfig, p: Erc20ApproveParams): PreparedTx {
        requireAddress(p.ownerWallet, 'ownerWallet');
        requireAddress(p.tokenAddress, 'tokenAddress');
        requireAddress(p.spenderAddress, 'spenderAddress');
        if (p.amount <= 0n) throw new Error('amount must be > 0');
        const data = this.erc20Iface.encodeFunctionData('approve', [p.spenderAddress, p.amount]);
        const preview: SigningPreview = {
            action: 'Approve ERC20',
            signer: 'payer',
            description: `Approve the payment contract to pull ${p.amount.toString()} tokens on your behalf.`,
            token: p.tokenAddress,
            tokenAmountWei: p.amount.toString(),
            details: {
                'Token': p.tokenAddress,
                'Spender': p.spenderAddress,
                'Amount': p.amount.toString(),
            },
        };
        return noValue(p.tokenAddress, data, cfg.chainId, 'Approve ERC20', preview);
    }

    // ─── Internals ─────────────────────────────────────────────────────────

    private simpleCall(
        cfg: PaymentsConfig, p: PaymentActionParams, method: string,
        action: string, previewOverrides: Partial<SigningPreview>,
    ): PreparedTx {
        requireAddress(p.callerWallet, 'callerWallet');
        requireAddress(p.paymentAddress, 'paymentAddress');
        const data = this.paymentIface.encodeFunctionData(method, []);
        const preview: SigningPreview = {
            action,
            signer: 'either party',
            description: `${action} on payment ${p.paymentAddress}.`,
            details: { 'Payment': p.paymentAddress },
            ...previewOverrides,
        };
        return noValue(p.paymentAddress, data, cfg.chainId, action, preview);
    }
}