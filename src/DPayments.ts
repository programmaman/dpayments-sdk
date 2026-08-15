import type { PreparedTx } from './common/index.js';
import type {
    FactoryInfo,
    FeeQuote,
    PaymentImplementationInfo,
    PaymentCreatedEvent,
    PrepareCreateParams,
    PrepareCreateErc20Params,
    PrepareCreateEthResult,
    PrepareCreateErc20Result,
} from './types.js';
import type {
    PaymentsConfig,
    CreatePaymentParams,
    Erc20ApproveParams,
} from './PaymentTxBuilder.js';
import { PaymentTxBuilder } from './PaymentTxBuilder.js';
import { PaymentReader } from './PaymentReader.js';
import { PaymentEvents, TOPIC_PAYMENT_CREATED } from './PaymentEvents.js';
import { DPayment } from './DPayment.js';
import { requireAddress, IdGenerator } from './common/index.js';
import type { MulticallConfig } from './multicall.js';
import { getFactoryAddress, requireSupportedChainId } from './deployments.js';
import type { ReadBlockReference, RpcClient } from './common/index.js';
import type { AbiCodec } from './common/AbiCodec.js';
import { decodeRpcChainId, ethGetLogs } from './internal/rpc.js';

export interface DPaymentsSdkConfig {
    chainId: number;
    /** Factory override; defaults to the deployed address for `chainId`. */
    factoryAddress?: string;
    rpcClient: RpcClient;
    codec: AbiCodec;
    /** Block context for reads; defaults to `latest`. */
    readBlock?: ReadBlockReference;
    /** Default wallet for write helpers; can be overridden per call. */
    walletAddress?: string;
    /** Optional Multicall3 batching for reads. */
    multicall?: MulticallConfig;
    /** Optional implementation to pin for create and predict calls. */
    impl?: PaymentImplementationInfo;
}

export interface DPaymentsFromRpcOptions {
    readonly codec: AbiCodec;
    readonly factoryAddress?: string;
    readonly walletAddress?: string;
    readonly readBlock?: ReadBlockReference;
    readonly multicall?: MulticallConfig;
    readonly implNameOrAddress?: string;
}

/** Factory-level reads and transaction builders. */
export class FactoryHandle {
    constructor(
        private readonly cfg:          PaymentsConfig,
        private readonly reader:       PaymentReader,
        private readonly builder:      PaymentTxBuilder,
        private readonly decoder:      PaymentEvents,
        private readonly rpcClient:    RpcClient,
        private readonly walletAddress?: string,
        private readonly impl?:        string,
    ) {}

    /** Reads the factory configuration. */
    readConfig(): Promise<FactoryInfo> {
        return this.reader.readFactory(this.cfg.factoryAddress);
    }

    /** Quotes the gross amount and protocol fee for a net amount. */
    quoteGross(net: bigint): Promise<FeeQuote> {
        return this.reader.quoteGross(this.cfg.factoryAddress, net);
    }

    /** Reads the protocol fee in basis points. */
    feeBps(): Promise<bigint> {
        return this.reader.readFeeBps(this.cfg.factoryAddress);
    }

    /** Reads the number of registered implementations. */
    implementationCount(): Promise<number> {
        return this.reader.readImplementationCount(this.cfg.factoryAddress);
    }

    /** Reads an implementation by zero-based index. */
    implementationAt(index: number): Promise<PaymentImplementationInfo> {
        return this.reader.readImplementationAt(this.cfg.factoryAddress, index);
    }

    /** Predicts the clone address for a payment. */
    predictAddress(creator: string, req: {
        id: string;
        payee: string;
        token: string;
        amount: bigint;
        fee: bigint;
        settlementTime: bigint;
    }): Promise<string> {
        return this.reader.predictPaymentAddress(this.cfg.factoryAddress, creator, req, this.impl);
    }

    /** Lists all registered implementations. */
    async listImplementations(): Promise<PaymentImplementationInfo[]> {
        const count = await this.reader.readImplementationCount(this.cfg.factoryAddress);
        return Promise.all(
            Array.from({ length: count }, (_, i) =>
                this.reader.readImplementationAt(this.cfg.factoryAddress, i)),
        );
    }

    /** Builds an unsigned ETH-funded `createPayment` transaction. */
    createEthPayment(p: Omit<CreatePaymentParams, 'callerWallet'>, wallet?: string): PreparedTx {
        return this.builder.createEthPayment(this.cfg, {
            ...p,
            callerWallet: this.resolveWallet(wallet),
            impl: this.impl,
        });
    }

    /** Builds an unsigned ERC20-funded `createPayment` transaction. */
    createErc20Payment(p: Omit<CreatePaymentParams, 'callerWallet'>, wallet?: string): PreparedTx {
        return this.builder.createErc20Payment(this.cfg, {
            ...p,
            callerWallet: this.resolveWallet(wallet),
            impl: this.impl,
        });
    }

    /** Builds an unsigned ERC20 approval transaction. */
    erc20Approve(p: Omit<Erc20ApproveParams, 'ownerWallet'>, wallet?: string): PreparedTx {
        return this.builder.erc20Approve(this.cfg, {
            ...p,
            ownerWallet: this.resolveWallet(wallet),
        });
    }

    /** Quotes the fee and builds an ETH-funded create transaction. */
    async prepareCreateEthPayment(
        params: PrepareCreateParams,
        wallet?: string,
    ): Promise<PrepareCreateEthResult> {
        const { gross, fee } = await this.reader.quoteGross(this.cfg.factoryAddress, params.netAmount);
        const paymentId = params.paymentId ?? IdGenerator.generateOnChainIdHex();
        const tx = this.builder.createEthPayment(this.cfg, {
            callerWallet:          this.resolveWallet(wallet),
            paymentId,
            payeeAddress:          params.payeeAddress,
            amount:                params.netAmount,
            fee,
            settlementTimeUnixSec: params.settlementTimeUnixSec,
            impl:                  this.impl,
        });
        return { tx, paymentId, gross, fee };
    }

    /** Builds ERC20 approval and create transactions; send `approveTx` first. */
    async prepareCreateErc20Payment(
        params: PrepareCreateErc20Params,
        wallet?: string,
    ): Promise<PrepareCreateErc20Result> {
        const { gross, fee } = await this.reader.quoteGross(this.cfg.factoryAddress, params.netAmount);
        const paymentId = params.paymentId ?? IdGenerator.generateOnChainIdHex();
        const caller = this.resolveWallet(wallet);
        const tokenAddr = requireAddress(params.tokenAddress, 'tokenAddress');

        const predictedAddress = await this.reader.predictPaymentAddress(this.cfg.factoryAddress, caller, {
            id:             paymentId,
            payee:          params.payeeAddress,
            token:          tokenAddr,
            amount:         params.netAmount,
            fee,
            settlementTime: params.settlementTimeUnixSec,
        }, this.impl);

        const approveTx = this.builder.erc20Approve(this.cfg, {
            ownerWallet:    caller,
            tokenAddress:   tokenAddr,
            spenderAddress: predictedAddress,
            amount:         gross,
        });

        const createTx = this.builder.createErc20Payment(this.cfg, {
            callerWallet:          caller,
            paymentId,
            payeeAddress:          params.payeeAddress,
            tokenAddress:          tokenAddr,
            amount:                params.netAmount,
            fee,
            settlementTimeUnixSec: params.settlementTimeUnixSec,
            impl:                  this.impl,
        });

        return { createTx, approveTx, paymentId, gross, fee, predictedAddress };
    }

    /** Fetches `PaymentCreated` events emitted by this factory. */
    async getLogs(
        fromBlock: number | 'earliest' = 0,
        toBlock:   number | 'latest'   = 'latest',
    ): Promise<PaymentCreatedEvent[]> {
        const rawLogs = await ethGetLogs(this.rpcClient, {
            address:   this.cfg.factoryAddress,
            topics:    [TOPIC_PAYMENT_CREATED],
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
            const decoded = this.decoder.tryDecodePaymentCreated(evmLog);
            return decoded ? [decoded] : [];
        });
    }

    async getLogsByPayee(
        payee:       string,
        fromBlock:   number | 'earliest' = 0,
        toBlock:     number | 'latest'   = 'latest',
    ): Promise<PaymentCreatedEvent[]> {
        const payeeTopic = '0x000000000000000000000000' + requireAddress(payee, 'payee').toLowerCase().slice(2);
        const rawLogs = await ethGetLogs(this.rpcClient, {
            address:   this.cfg.factoryAddress,
            topics:    [TOPIC_PAYMENT_CREATED, null, null, payeeTopic],
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
            const decoded = this.decoder.tryDecodePaymentCreated(evmLog);
            return decoded ? [decoded] : [];
        });
    }

    async getLogsByCreator(
        creator:     string,
        fromBlock:   number | 'earliest' = 0,
        toBlock:     number | 'latest'   = 'latest',
    ): Promise<PaymentCreatedEvent[]> {
        const creatorTopic = '0x000000000000000000000000' + requireAddress(creator, 'creator').toLowerCase().slice(2);
        const rawLogs = await ethGetLogs(this.rpcClient, {
            address:   this.cfg.factoryAddress,
            topics:    [TOPIC_PAYMENT_CREATED, null, creatorTopic],
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
            const decoded = this.decoder.tryDecodePaymentCreated(evmLog);
            return decoded ? [decoded] : [];
        });
    }

    /** Fetches `PaymentCreated` events filtered by payer or payee. */
    async getLogsByParty(
        role:       'payer' | 'payee',
        party:      string,
        fromBlock:  number | 'earliest' = 0,
        toBlock:    number | 'latest'   = 'latest',
    ): Promise<PaymentCreatedEvent[]> {
        return role === 'payee'
            ? this.getLogsByPayee(party, fromBlock, toBlock)
            : this.getLogsByCreator(party, fromBlock, toBlock);
    }

    private resolveWallet(override?: string): string {
        const w = override ?? this.walletAddress;
        if (!w) throw new Error(
            'walletAddress is required — pass it to new DPayments({ walletAddress }) or as the last argument to this method.',
        );
        return w;
    }
}

/** Top-level entry point for the DPayments SDK. */
export class DPayments {
    /** Factory reads and transaction builders. */
    readonly factory: FactoryHandle;

    private readonly _reader:   PaymentReader;
    private readonly _builder:  PaymentTxBuilder;
    private readonly _events:   PaymentEvents;
    private readonly _cfg:      PaymentsConfig;
    private readonly _rpcClient: RpcClient;
    private readonly _wallet?:  string;
    private readonly _impl?:    string;

    constructor(config: DPaymentsSdkConfig) {
        const chainId = DPayments._normalizeChainId(config.chainId);

        if (!config.factoryAddress) {
            requireSupportedChainId(chainId);
        }

        const factoryAddress = config.factoryAddress ?? getFactoryAddress(chainId);
        if (!factoryAddress) {
            throw new Error(`Unsupported chain ID: ${chainId}`);
        }

        requireAddress(factoryAddress, 'factoryAddress');
        this._cfg      = { chainId, factoryAddress };
        this._rpcClient = config.rpcClient;
        this._reader   = new PaymentReader(config.rpcClient, config.codec, config.multicall, config.readBlock);
        this._builder  = new PaymentTxBuilder(config.codec);
        this._events   = new PaymentEvents(config.codec);
        this._wallet   = config.walletAddress;
        this._impl     = config.impl
            ? requireAddress(config.impl.address, 'impl')
            : undefined;

        this.factory = new FactoryHandle(
            this._cfg, this._reader, this._builder, this._events,
            this._rpcClient, this._wallet, this._impl,
        );
    }

    /** Creates an instance using the deployed factory for `chainId`. */
    static forChain(
        chainId: number,
        rpcClient: RpcClient,
        codec: AbiCodec,
        walletAddress?: string,
        impl?: PaymentImplementationInfo,
    ): DPayments {
        return new DPayments({ chainId, rpcClient, codec, walletAddress, impl });
    }

    static async fromRpc(
        rpcClient: RpcClient,
        options: DPaymentsFromRpcOptions,
    ): Promise<DPayments> {
        const chainId = decodeRpcChainId(
            await rpcClient.request({ method: 'eth_chainId', params: [] }),
        );
        const factoryAddress = options.factoryAddress ?? getFactoryAddress(chainId);
        if (!factoryAddress) {
            throw new Error(`Unsupported chain ID: ${chainId}`);
        }

        const reader = new PaymentReader(rpcClient, options.codec, options.multicall, options.readBlock);
        const impl = options.implNameOrAddress
            ? await this._resolveImpl(reader, factoryAddress, options.implNameOrAddress)
            : undefined;

        return new DPayments({
            chainId,
            rpcClient,
            codec: options.codec,
            factoryAddress,
            walletAddress: options.walletAddress,
            readBlock: options.readBlock,
            multicall: options.multicall,
            impl,
        });
    }

    private static _normalizeChainId(chainId: number): number {
        if (!Number.isSafeInteger(chainId) || chainId <= 0) {
            throw new Error(`Invalid DPayments chain ID: ${chainId}.`);
        }
        return chainId;
    }

    private static async _resolveImpl(
        reader: PaymentReader,
        factoryAddress: string,
        nameOrAddress: string,
    ): Promise<PaymentImplementationInfo> {
        if (nameOrAddress.startsWith('0x')) {
            return { address: requireAddress(nameOrAddress, 'impl'), name: '' };
        }
        const count  = await reader.readImplementationCount(factoryAddress);
        const impls  = await Promise.all(
            Array.from({ length: count }, (_, i) =>
                reader.readImplementationAt(factoryAddress, i)),
        );
        const match = impls.find(i =>
            i.name.toLowerCase() === nameOrAddress.toLowerCase());
        if (!match) throw new Error(
            `No implementation named "${nameOrAddress}" on factory ${factoryAddress}. ` +
            `Available: ${impls.map(i => i.name).join(', ')}.`);
        return match;
    }

    /** Binds a `DPayment` instance to a deployed clone address. */
    dPayment(address: string): DPayment {
        return new DPayment(
            requireAddress(address, 'paymentAddress'),
            this._cfg, this._reader, this._builder, this._events, this._rpcClient, this._wallet,
        );
    }
}
