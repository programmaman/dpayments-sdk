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
import type { ReadBlockReference, RpcClient } from './common/index.js';
import { encodeRpcBlockReference, ethCall, type RpcBlockIdentifier } from './internal/rpc.js';
import type { AbiCodec, Hex } from './common/AbiCodec.js';

// ─── PaymentReader ────────────────────────────────────────────────────────────

/**
 * Stateless reader for on-chain DisputablePayment state via JSON-RPC eth_call.
 *
 *
 * Accepts the SDK's minimal RpcClient.
 *
 * Pass a `MulticallConfig` to batch reads through Multicall3.
 * Omit it (or leave undefined) to use the original parallel Promise.all path.
 */
export class PaymentReader {
    private readonly _multicall?: MulticallConfig;
    private readonly _rpcClient: RpcClient;
    private readonly _codec: AbiCodec;
    private readonly _readBlock: RpcBlockIdentifier;
    readonly readPayment: PaymentReadable<[paymentAddress: string]>;

    constructor(
        client: RpcClient,
        codec: AbiCodec,
        multicallConfig?: MulticallConfig,
        readBlock: ReadBlockReference = 'latest',
    ) {
        this._rpcClient = client;
        this._codec = codec;
        this._multicall = multicallConfig;
        this._readBlock = encodeRpcBlockReference(readBlock);
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
            this._call({ to: addr, data: this._codec.encode(`${method}()`) });

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

        const feeBps = this._codec.decode('feeBps()', feeBpsRaw)[0] as bigint;
        const pendingOwner = this._codec.decode('pendingOwner()', pendingOwnerRaw)[0] as string;
        const [defaultImpl, defaultImplName] = this._codec.decode('defaultPaymentImplementation()', defaultImplRaw);

        return {
            factoryAddress: addr,
            defaultImpl:     defaultImpl as string,
            defaultImplName: defaultImplName as string,
            feeBps,
            feeRecipient:    this._codec.decode('feeRecipient()', feeRecipient)[0] as string,
            arbitrator:      this._codec.decode('arbitrator()', arbitrator)[0] as string,
            arbitratorConfiguration: this._codec.decode('arbitratorConfiguration()', arbitratorConfiguration)[0] as string,
            metaEvidenceUri: this._codec.decode('metaEvidenceURI()', metaEvidenceUri)[0] as string,
            owner:           this._codec.decode('owner()', owner)[0] as string,
            pendingOwner:    pendingOwner && pendingOwner !== '0x0000000000000000000000000000000000000000' ? pendingOwner : '',
        };
    }

    private async _readFactoryViaMulticall(addr: string): Promise<FactoryInfo> {
        const calls: EncodedReadCall[] = [
            this._encodeReadCall(addr, 'feeBps'),
            this._encodeReadCall(addr, 'feeRecipient'),
            this._encodeReadCall(addr, 'arbitrator'),
            this._encodeReadCall(addr, 'arbitratorConfiguration'),
            this._encodeReadCall(addr, 'metaEvidenceURI'),
            this._encodeReadCall(addr, 'owner'),
            this._encodeReadCall(addr, 'pendingOwner'),
            this._encodeReadCall(addr, 'defaultPaymentImplementation', data => {
                const [impl, name] = this._codec.decode('defaultPaymentImplementation()', data);
                return { impl: impl as string, name: name as string };
            }),
        ];

        const values = await this._executeMulticall(calls);

        const di = values[7] as { impl: string; name: string };

        return {
            factoryAddress:  addr,
            defaultImpl:     di.impl,
            defaultImplName: di.name,
            feeBps:          values[0] as bigint,
            feeRecipient:    values[1] as string,
            arbitrator:      values[2] as string,
            arbitratorConfiguration: values[3] as string,
            metaEvidenceUri: values[4] as string,
            owner:           values[5] as string,
            pendingOwner:    values[6] as string === '0x0000000000000000000000000000000000000000'
                ? '' : (values[6] as string),
        };
    }

    // ─── Single-call factory reads (not worth batching individually) ──────────

    async quoteGross(factoryAddress: string, net: bigint): Promise<FeeQuote> {
        const addr = requireAddress(factoryAddress, 'factoryAddress');
        if (net <= 0n) throw new Error('net must be > 0');
        const raw = await this._call({
            to: addr,
            data: this._codec.encode('quoteGross(uint256)', [net]),
        });
        const [gross, fee] = this._codec.decode('quoteGross(uint256)', raw);
        return { gross: gross as bigint, fee: fee as bigint };
    }

    async readFeeBps(factoryAddress: string): Promise<bigint> {
        const addr = requireAddress(factoryAddress, 'factoryAddress');
        const raw = await this._call({ to: addr, data: this._codec.encode('feeBps()') });
        return this._codec.decode('feeBps()', raw)[0] as bigint;
    }

    async readImplementationCount(factoryAddress: string): Promise<number> {
        const addr = requireAddress(factoryAddress, 'factoryAddress');
        const raw = await this._call({ to: addr, data: this._codec.encode('paymentImplementationCount()') });
        return Number(this._codec.decode('paymentImplementationCount()', raw)[0]);
    }

    async readImplementationAt(factoryAddress: string, index: number): Promise<PaymentImplementationInfo> {
        const addr = requireAddress(factoryAddress, 'factoryAddress');
        if (index < 0) throw new Error('index must be >= 0');
        const raw = await this._call({
            to: addr,
            data: this._codec.encode('paymentImplementationAt(uint256)', [index]),
        });
        const [impl, name] = this._codec.decode('paymentImplementationAt(uint256)', raw);
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

        const reqTuple = {
            id: req.id,
            payee: req.payee,
            token: req.token,
            amount: req.amount,
            fee: req.fee,
            settlementTime: req.settlementTime,
        };

        if (impl) {
            const raw = await this._call({
                to: addr,
                data: this._codec.encode(
                    'predictPaymentAddress(address,address,(bytes32,address,address,uint256,uint256,uint256))',
                    [impl, creatorAddr, reqTuple]),
            });
            return this._codec.decode(
                'predictPaymentAddress(address,address,(bytes32,address,address,uint256,uint256,uint256))', raw)[0] as string;
        }
        const raw = await this._call({
            to: addr,
            data: this._codec.encode(
                'predictPaymentAddress(address,(bytes32,address,address,uint256,uint256,uint256))',
                [creatorAddr, reqTuple]),
        });
        return this._codec.decode(
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
            this._call({ to: addr, data: this._codec.encode(`${method}()`) });

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
            payer:           this._codec.decode('payer()', payerRaw)[0] as string,
            payee:           this._codec.decode('payee()', payeeRaw)[0] as string,
            token:           this._codec.decode('token()', tokenRaw)[0] as string,
            amount:          this._codec.decode('amount()', amountRaw)[0] as bigint,
            state:           paymentStateFromOrdinal(Number(this._codec.decode('state()', stateRaw)[0])),
            settlementTime:  this._codec.decode('settlementTime()', settlementTimeRaw)[0] as bigint,
            consumed:        this._codec.decode('consumed()', consumedRaw)[0] as boolean,
            disputeId:       this._codec.decode('disputeId()', disputeIdRaw)[0] as bigint,
            disputeStartTime:this._codec.decode('disputeStartTime()', disputeStartTimeRaw)[0] as bigint,
            arbitratorAddress:       this._codec.decode('arbitrator()', arbitratorRaw)[0] as string,
            arbitratorConfiguration: this._codec.decode('arbitratorConfiguration()', arbitratorConfigRaw)[0] as string,
        };
    }

    private async _readPaymentViaMulticall(addr: string): Promise<PaymentInfo> {
        const values = await this._executeMulticall([
            'payer',
            'payee',
            'token',
            'amount',
            'state',
            'settlementTime',
            'consumed',
            'disputeId',
            'disputeStartTime',
            'arbitrator',
            'arbitratorConfiguration',
        ].map(method => this._encodeReadCall(addr, method)));

        return {
            paymentAddress: addr,
            payer:           values[0] as string,
            payee:           values[1] as string,
            token:           values[2] as string,
            amount:          values[3] as bigint,
            state:           paymentStateFromOrdinal(Number(values[4])),
            settlementTime:  values[5] as bigint,
            consumed:        values[6] as boolean,
            disputeId:       values[7] as bigint,
            disputeStartTime:values[8] as bigint,
            arbitratorAddress:       values[9] as string,
            arbitratorConfiguration: values[10] as string,
        };
    }

    private _encodeReadCall<T = unknown>(
        target: string,
        method: string,
        decode?: (data: Hex) => T,
    ): EncodedReadCall<T> {
        return {
            target,
            method,
            callData: this._codec.encode(`${method}()`),
            decode: decode ?? (data => this._codec.decode(`${method}()`, data)[0] as T),
        };
    }

    private async _executeMulticall(
        calls: readonly EncodedReadCall<unknown>[],
    ): Promise<unknown[]> {
        const config = this._multicall;
        if (!config) throw new Error('Multicall is not configured.');
        return executeMulticall(
            this._rpcClient, this._codec, config.address, calls, this._readBlock,
        );
    }

    private async _readPaymentValue(paymentAddress: string, method: string): Promise<unknown> {
        const addr = requireAddress(paymentAddress, 'paymentAddress');
        const raw = await this._call({
            to: addr,
            data: this._codec.encode(`${method}()`),
        });
        return this._codec.decode(`${method}()`, raw)[0];
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
        const raw = await this._call({ to: addr, data: this._codec.encode('arbitrationCost()') });
        return this._codec.decode('arbitrationCost()', raw)[0] as bigint;
    }

    /** Current Kleros appeal cost in wei. Throws if not DISPUTED. */
    async readAppealCost(paymentAddress: string): Promise<bigint> {
        const addr = requireAddress(paymentAddress, 'paymentAddress');
        const raw = await this._call({ to: addr, data: this._codec.encode('appealCost()') });
        return this._codec.decode('appealCost()', raw)[0] as bigint;
    }

    /** Current appeal window. `end == 0n` means no ruling has been issued yet. */
    async readAppealPeriod(paymentAddress: string): Promise<AppealPeriod> {
        const addr = requireAddress(paymentAddress, 'paymentAddress');
        const raw = await this._call({ to: addr, data: this._codec.encode('appealPeriod()') });
        const result = this._codec.decode('appealPeriod()', raw);
        return { start: result[0] as bigint, end: result[1] as bigint };
    }

    /**
     * ETH queued for `wallet` that can be claimed.
     */
    async readPendingWithdrawal(paymentAddress: string, wallet: string): Promise<bigint> {
        const addr = requireAddress(paymentAddress, 'paymentAddress');
        const walletAddr = requireAddress(wallet, 'wallet');
        const raw = await this._call({
            to: addr,
            data: this._codec.encode('pendingWithdrawals(address)', [walletAddr]),
        });
        return this._codec.decode('pendingWithdrawals(address)', raw)[0] as bigint;
    }

    private _call(request: { to: string; data: string }): Promise<`0x${string}`> {
        return ethCall(this._rpcClient, {
            to: request.to,
            data: request.data as `0x${string}`,
        }, this._readBlock);
    }
}
