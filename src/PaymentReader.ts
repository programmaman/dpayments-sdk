import { Interface, AbstractProvider, ZeroAddress } from 'ethers';
import { requireAddress } from './common/index.js';
import {
    type FactoryInfo,
    type FeeQuote,
    type PaymentInfo,
    type PaymentImplementationInfo,
    type AppealPeriod,
    PaymentState,
    paymentStateFromOrdinal,
} from './types.js';
import type { PaymentReadable } from './internal/PaymentReadable.js';
import { type MulticallConfig, type EncodedReadCall, executeMulticall } from './multicall.js';
import { PaymentFactory__factory, DisputablePayment__factory } from '../generated/typechain/index.js';

// ─── Reusable Interface instances (allocated once, not per-call) ──────────────

const FACTORY_IFACE = PaymentFactory__factory.createInterface() as unknown as Interface;
const PAYMENT_IFACE = DisputablePayment__factory.createInterface() as unknown as Interface;

// ─── PaymentReader ────────────────────────────────────────────────────────────

/**
 * Stateless reader for on-chain DisputablePayment state via JSON-RPC eth_call.
 *
 *
 * Accepts any ethers AbstractProvider (JsonRpcProvider, BrowserProvider, etc.).
 * All methods are async and throw if the RPC call fails.
 *
 * Pass a `MulticallConfig` to batch reads through Multicall3.
 * Omit it (or leave undefined) to use the original parallel Promise.all path.
 */
export class PaymentReader {
    private readonly _multicall?: MulticallConfig;
    readonly readPayment: PaymentReadable<[paymentAddress: string]>;

    constructor(private readonly provider: AbstractProvider, multicallConfig?: MulticallConfig) {
        this._multicall = multicallConfig;
        this.readPayment = Object.assign(
            (paymentAddress: string) => this._readPaymentSnapshot(paymentAddress),
            {
                state: (paymentAddress: string) => this._readPaymentState(paymentAddress),
                payer: (paymentAddress: string) => this._readPaymentString(paymentAddress, 'payer'),
                payee: (paymentAddress: string) => this._readPaymentString(paymentAddress, 'payee'),
                token: (paymentAddress: string) => this._readPaymentString(paymentAddress, 'token'),
                amount: (paymentAddress: string) => this._readPaymentBigInt(paymentAddress, 'amount'),
                settlementTime: (paymentAddress: string) => this._readPaymentBigInt(paymentAddress, 'settlementTime'),
                consumed: (paymentAddress: string) => this._readPaymentBoolean(paymentAddress, 'consumed'),
                disputeId: (paymentAddress: string) => this._readPaymentBigInt(paymentAddress, 'disputeId'),
                disputeStartTime: (paymentAddress: string) => this._readPaymentBigInt(paymentAddress, 'disputeStartTime'),
                arbitrator: (paymentAddress: string) => this._readPaymentString(paymentAddress, 'arbitrator'),
                arbitratorConfiguration: (paymentAddress: string) => this._readPaymentString(paymentAddress, 'arbitratorConfiguration'),
                arbitrationCost: (paymentAddress: string) => this.readArbitrationCost(paymentAddress),
                appealCost: (paymentAddress: string) => this.readAppealCost(paymentAddress),
                appealPeriod: (paymentAddress: string) => this.readAppealPeriod(paymentAddress),
                pendingWithdrawal: (paymentAddress: string, wallet: string) =>
                    this.readPendingWithdrawal(paymentAddress, wallet),
            },
        );
    }

    // ─── Factory reads ────────────────────────────────────────────────────────

    /**
     * Reads the full factory configuration.
     */
    async readFactory(factoryAddress: string): Promise<FactoryInfo> {
        const addr = requireAddress(factoryAddress, 'factoryAddress');
        return this._multicall
            ? this._readFactoryViaMulticall(addr)
            : this._readFactoryDirect(addr);
    }

    private async _readFactoryDirect(addr: string): Promise<FactoryInfo> {
        const call = (method: string) =>
            this.provider.call({ to: addr, data: FACTORY_IFACE.encodeFunctionData(method, []) });

        const [feeBpsRaw, feeRecipient, arbitrator, arbitratorConfiguration,
               metaEvidenceUri, owner, pendingOwnerRaw, defaultImplRaw] =
            await Promise.all([
                call('feeBps'),
                call('feeRecipient'),
                call('arbitrator'),
                call('arbitratorConfiguration'),
                call('metaEvidenceURI'),
                call('owner'),
                call('pendingOwner'),
                call('defaultPaymentImplementation'),
            ]);

        const feeBps = FACTORY_IFACE.decodeFunctionResult('feeBps', feeBpsRaw)[0] as bigint;
        const pendingOwner = FACTORY_IFACE.decodeFunctionResult('pendingOwner', pendingOwnerRaw)[0] as string;
        const [defaultImpl, defaultImplName] = FACTORY_IFACE.decodeFunctionResult('defaultPaymentImplementation', defaultImplRaw);

        return {
            factoryAddress: addr,
            defaultImpl:     defaultImpl as string,
            defaultImplName: defaultImplName as string,
            feeBps,
            feeRecipient:    FACTORY_IFACE.decodeFunctionResult('feeRecipient', feeRecipient)[0] as string,
            arbitrator:      FACTORY_IFACE.decodeFunctionResult('arbitrator', arbitrator)[0] as string,
            arbitratorConfiguration: FACTORY_IFACE.decodeFunctionResult('arbitratorConfiguration', arbitratorConfiguration)[0] as string,
            metaEvidenceUri: FACTORY_IFACE.decodeFunctionResult('metaEvidenceURI', metaEvidenceUri)[0] as string,
            owner:           FACTORY_IFACE.decodeFunctionResult('owner', owner)[0] as string,
            pendingOwner:    pendingOwner && pendingOwner !== ZeroAddress ? pendingOwner : '',
        };
    }

    private async _readFactoryViaMulticall(addr: string): Promise<FactoryInfo> {
        const cfg   = this._multicall!;

        const enc = (method: string): EncodedReadCall => ({
            target:   addr,
            method,
            callData: FACTORY_IFACE.encodeFunctionData(method, []),
            decode:   (data: string) => FACTORY_IFACE.decodeFunctionResult(method, data)[0] as unknown,
        });

        const calls: EncodedReadCall[] = [
            enc('feeBps'),
            enc('feeRecipient'),
            enc('arbitrator'),
            enc('arbitratorConfiguration'),
            enc('metaEvidenceURI'),
            enc('owner'),
            enc('pendingOwner'),
            // defaultPaymentImplementation returns two values — decode both
            {
                target:   addr,
                method:   'defaultPaymentImplementation',
                callData: FACTORY_IFACE.encodeFunctionData('defaultPaymentImplementation', []),
                decode:   (data: string) => {
                    const r = FACTORY_IFACE.decodeFunctionResult('defaultPaymentImplementation', data);
                    return { impl: r[0] as string, name: r[1] as string };
                },
            },
        ];

        const results = await executeMulticall(
            this.provider, cfg.address, calls, cfg.requireSuccess !== false,
        );

        const [feeBpsRaw, feeRecipient, arbitrator, arbitratorConfiguration,
               metaEvidenceUri, owner, pendingOwnerRaw, defaultImplRaw] = results;

        const di = defaultImplRaw as { impl: string; name: string };

        return {
            factoryAddress:  addr,
            defaultImpl:     di.impl,
            defaultImplName: di.name,
            feeBps:          feeBpsRaw as bigint,
            feeRecipient:    feeRecipient as string,
            arbitrator:      arbitrator as string,
            arbitratorConfiguration: arbitratorConfiguration as string,
            metaEvidenceUri: metaEvidenceUri as string,
            owner:           owner as string,
            pendingOwner:    (pendingOwnerRaw as string) ?? '',
        };
    }

    // ─── Single-call factory reads (not worth batching individually) ──────────

    async quoteGross(factoryAddress: string, net: bigint): Promise<FeeQuote> {
        const addr = requireAddress(factoryAddress, 'factoryAddress');
        if (net <= 0n) throw new Error('net must be > 0');
        const iface = new Interface([
            'function quoteGross(uint256 net) view returns (uint256 gross, uint256 fee)',
        ]);
        const raw = await this.provider.call({
            to: addr,
            data: iface.encodeFunctionData('quoteGross', [net]),
        });
        const [gross, fee] = iface.decodeFunctionResult('quoteGross', raw);
        return { gross: gross as bigint, fee: fee as bigint };
    }

    async readFeeBps(factoryAddress: string): Promise<bigint> {
        const addr = requireAddress(factoryAddress, 'factoryAddress');
        const iface = new Interface(['function feeBps() view returns (uint16)']);
        const raw = await this.provider.call({ to: addr, data: iface.encodeFunctionData('feeBps', []) });
        return BigInt(iface.decodeFunctionResult('feeBps', raw)[0]);
    }

    async readImplementationCount(factoryAddress: string): Promise<number> {
        const addr = requireAddress(factoryAddress, 'factoryAddress');
        const iface = new Interface(['function paymentImplementationCount() view returns (uint256)']);
        const raw = await this.provider.call({ to: addr, data: iface.encodeFunctionData('paymentImplementationCount', []) });
        return Number(iface.decodeFunctionResult('paymentImplementationCount', raw)[0]);
    }

    async readImplementationAt(factoryAddress: string, index: number): Promise<PaymentImplementationInfo> {
        const addr = requireAddress(factoryAddress, 'factoryAddress');
        if (index < 0) throw new Error('index must be >= 0');
        const iface = new Interface(['function paymentImplementationAt(uint256 index) view returns (address impl, string name)']);
        const raw = await this.provider.call({
            to: addr,
            data: iface.encodeFunctionData('paymentImplementationAt', [index]),
        });
        const [impl, name] = iface.decodeFunctionResult('paymentImplementationAt', raw);
        return { address: impl as string, name: name as string };
    }

    async predictPaymentAddress(
        factoryAddress: string, creator: string,
        req: {
            id: string;
            payee: string;
            token: string;
            amount: bigint;
            fee: bigint;
            settlementTime: bigint;
        },
        impl?: string,
    ): Promise<string> {
        const addr = requireAddress(factoryAddress, 'factoryAddress');
        const creatorAddr = requireAddress(creator, 'creator');

        const iface = new Interface([
            'function predictPaymentAddress(address creator, (bytes32 id, address payee, address token, uint256 amount, uint256 fee, uint256 settlementTime) req) view returns (address)',
            'function predictPaymentAddress(address impl, address creator, (bytes32 id, address payee, address token, uint256 amount, uint256 fee, uint256 settlementTime) req) view returns (address)',
        ]);

        const reqTuple = {
            id: req.id,
            payee: req.payee,
            token: req.token,
            amount: req.amount,
            fee: req.fee,
            settlementTime: req.settlementTime,
        };

        if (impl) {
            const raw = await this.provider.call({
                to: addr,
                data: iface.encodeFunctionData(
                    'predictPaymentAddress(address,address,(bytes32,address,address,uint256,uint256,uint256))',
                    [impl, creatorAddr, reqTuple]),
            });
            return iface.decodeFunctionResult(
                'predictPaymentAddress(address,address,(bytes32,address,address,uint256,uint256,uint256))', raw)[0] as string;
        }
        const raw = await this.provider.call({
            to: addr,
            data: iface.encodeFunctionData(
                'predictPaymentAddress(address,(bytes32,address,address,uint256,uint256,uint256))',
                [creatorAddr, reqTuple]),
        });
        return iface.decodeFunctionResult(
            'predictPaymentAddress(address,(bytes32,address,address,uint256,uint256,uint256))', raw)[0] as string;
    }

    // ─── Payment reads ─────────────────────────────────────────────────────────

    /**
     * Reads all on-chain state for a deployed DisputablePayment clone.
     */
    private async _readPaymentSnapshot(paymentAddress: string): Promise<PaymentInfo> {
        const addr = requireAddress(paymentAddress, 'paymentAddress');
        return this._multicall
            ? this._readPaymentViaMulticall(addr)
            : this._readPaymentDirect(addr);
    }

    private async _readPaymentDirect(addr: string): Promise<PaymentInfo> {
        const call = (method: string) =>
            this.provider.call({ to: addr, data: PAYMENT_IFACE.encodeFunctionData(method, []) });

        const [payerRaw, payeeRaw, tokenRaw, amountRaw, stateRaw,
               settlementTimeRaw, consumedRaw, disputeIdRaw, disputeStartTimeRaw,
               arbitratorRaw, arbitratorConfigRaw] =
            await Promise.all([
                call('payer'), call('payee'), call('token'), call('amount'),
                call('state'), call('settlementTime'), call('consumed'), call('disputeId'),
                call('disputeStartTime'), call('arbitrator'),
                call('arbitratorConfiguration'),
            ]);

        return {
            paymentAddress: addr,
            payer:           PAYMENT_IFACE.decodeFunctionResult('payer', payerRaw)[0] as string,
            payee:           PAYMENT_IFACE.decodeFunctionResult('payee', payeeRaw)[0] as string,
            token:           PAYMENT_IFACE.decodeFunctionResult('token', tokenRaw)[0] as string,
            amount:          PAYMENT_IFACE.decodeFunctionResult('amount', amountRaw)[0] as bigint,
            state:           paymentStateFromOrdinal(Number(PAYMENT_IFACE.decodeFunctionResult('state', stateRaw)[0])),
            settlementTime:  PAYMENT_IFACE.decodeFunctionResult('settlementTime', settlementTimeRaw)[0] as bigint,
            consumed:        PAYMENT_IFACE.decodeFunctionResult('consumed', consumedRaw)[0] as boolean,
            disputeId:       PAYMENT_IFACE.decodeFunctionResult('disputeId', disputeIdRaw)[0] as bigint,
            disputeStartTime:PAYMENT_IFACE.decodeFunctionResult('disputeStartTime', disputeStartTimeRaw)[0] as bigint,
            arbitratorAddress:       PAYMENT_IFACE.decodeFunctionResult('arbitrator', arbitratorRaw)[0] as string,
            arbitratorConfiguration: PAYMENT_IFACE.decodeFunctionResult('arbitratorConfiguration', arbitratorConfigRaw)[0] as string,
        };
    }

    private async _readPaymentViaMulticall(addr: string): Promise<PaymentInfo> {
        const cfg   = this._multicall!;

        const enc = (method: string): EncodedReadCall => ({
            target:   addr,
            method,
            callData: PAYMENT_IFACE.encodeFunctionData(method, []),
            decode:   (data: string) => PAYMENT_IFACE.decodeFunctionResult(method, data)[0] as unknown,
        });

        const calls: EncodedReadCall[] = [
            enc('payer'),
            enc('payee'),
            enc('token'),
            enc('amount'),
            enc('state'),
            enc('settlementTime'),
            enc('consumed'),
            enc('disputeId'),
            enc('disputeStartTime'),
            enc('arbitrator'),
            enc('arbitratorConfiguration'),
        ];

        const results = await executeMulticall(
            this.provider, cfg.address, calls, cfg.requireSuccess !== false,
        );

        const [
            payer, payee, token, amount, stateOrd,
            settlementTime, consumed, disputeId, disputeStartTime,
            arbitratorAddress, arbitratorConfiguration,
        ] = results;

        return {
            paymentAddress: addr,
            payer:           payer as string,
            payee:           payee as string,
            token:           token as string,
            amount:          amount as bigint,
            state:           paymentStateFromOrdinal(Number(stateOrd)),
            settlementTime:  settlementTime as bigint,
            consumed:        consumed as boolean,
            disputeId:       disputeId as bigint,
            disputeStartTime:disputeStartTime as bigint,
            arbitratorAddress:       arbitratorAddress as string,
            arbitratorConfiguration: arbitratorConfiguration as string,
        };
    }

    private async _readPaymentValue(paymentAddress: string, method: string): Promise<unknown> {
        const addr = requireAddress(paymentAddress, 'paymentAddress');
        const raw = await this.provider.call({
            to: addr,
            data: PAYMENT_IFACE.encodeFunctionData(method, []),
        });
        return PAYMENT_IFACE.decodeFunctionResult(method, raw)[0];
    }

    private async _readPaymentState(paymentAddress: string): Promise<PaymentState> {
        return paymentStateFromOrdinal(
            Number(await this._readPaymentValue(paymentAddress, 'state')),
        );
    }

    private async _readPaymentString(paymentAddress: string, method: string): Promise<string> {
        return await this._readPaymentValue(paymentAddress, method) as string;
    }

    private async _readPaymentBigInt(paymentAddress: string, method: string): Promise<bigint> {
        return await this._readPaymentValue(paymentAddress, method) as bigint;
    }

    private async _readPaymentBoolean(paymentAddress: string, method: string): Promise<boolean> {
        return await this._readPaymentValue(paymentAddress, method) as boolean;
    }

    // ─── Single-call reads (not worth batching individually) ──────────────────

    /** Current Kleros arbitration cost in wei. */
    async readArbitrationCost(paymentAddress: string): Promise<bigint> {
        const addr = requireAddress(paymentAddress, 'paymentAddress');
        const iface = new Interface(['function arbitrationCost() view returns (uint256)']);
        const raw = await this.provider.call({ to: addr, data: iface.encodeFunctionData('arbitrationCost', []) });
        return iface.decodeFunctionResult('arbitrationCost', raw)[0] as bigint;
    }

    /** Current Kleros appeal cost in wei. Throws if not DISPUTED. */
    async readAppealCost(paymentAddress: string): Promise<bigint> {
        const addr = requireAddress(paymentAddress, 'paymentAddress');
        const iface = new Interface(['function appealCost() view returns (uint256)']);
        const raw = await this.provider.call({ to: addr, data: iface.encodeFunctionData('appealCost', []) });
        return iface.decodeFunctionResult('appealCost', raw)[0] as bigint;
    }

    /** Current appeal window. `end == 0n` means no ruling has been issued yet. */
    async readAppealPeriod(paymentAddress: string): Promise<AppealPeriod> {
        const addr = requireAddress(paymentAddress, 'paymentAddress');
        const iface = new Interface(['function appealPeriod() view returns (uint256 start, uint256 end)']);
        const raw = await this.provider.call({ to: addr, data: iface.encodeFunctionData('appealPeriod', []) });
        const result = iface.decodeFunctionResult('appealPeriod', raw);
        return { start: result[0] as bigint, end: result[1] as bigint };
    }

    /**
     * ETH queued for `wallet` that can be claimed.
     */
    async readPendingWithdrawal(paymentAddress: string, wallet: string): Promise<bigint> {
        const addr = requireAddress(paymentAddress, 'paymentAddress');
        const walletAddr = requireAddress(wallet, 'wallet');
        const iface = new Interface(['function pendingWithdrawals(address) view returns (uint256)']);
        const raw = await this.provider.call({
            to: addr,
            data: iface.encodeFunctionData('pendingWithdrawals', [walletAddr]),
        });
        return iface.decodeFunctionResult('pendingWithdrawals', raw)[0] as bigint;
    }
}
