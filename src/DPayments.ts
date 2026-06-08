import type { AbstractProvider } from 'ethers';
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
import { getFactoryAddress, listDeployments } from './deployments.js';

// ─── SDK config ───────────────────────────────────────────────────────────────

export interface DPaymentsSdkConfig {
    chainId: number;
    factoryAddress: string;
    /** ethers AbstractProvider (JsonRpcProvider, BrowserProvider, …). */
    provider: AbstractProvider;
    /**
     * Current user's wallet address.
     * When set, all write operations pre-fill `callerWallet` automatically.
     * Can still be overridden per-call.
     */
    walletAddress?: string;
    /**
     * Optional Multicall3 configuration.
     * When set, `readPayment` and `readFactory` batch all their eth_calls into a
     * single `aggregate3` request, reducing RPC round-trips significantly.
     *
     * The canonical Multicall3 address on most EVM chains is:
     * `0xcA11bde05977b3631167028862bE2a173976CA11`
     *
     * Omit to keep the default parallel-Promise.all behaviour.
     */
    multicall?: MulticallConfig;
    /**
     * Optional payment implementation to pin.
     *
     * Omit (or set undefined) to use the factory's live default.
     *
     * Set to a {@link PaymentImplementationInfo} from {@link FactoryHandle.listImplementations}
     * to pin a specific implementation for all create and predict calls on this SDK instance.
     */
    impl?: PaymentImplementationInfo;
}

// ─── FactoryHandle ─────────────────────────────────────────────────────────────

/**
 * Factory-level namespace. Access via `dpayments.factory`.
 *
 * Read methods are async (eth_call). Write methods return unsigned `PreparedTx`.
 */
export class FactoryHandle {
    constructor(
        private readonly cfg:          PaymentsConfig,
        private readonly reader:       PaymentReader,
        private readonly builder:      PaymentTxBuilder,
        private readonly decoder:      PaymentEvents,
        private readonly provider:     AbstractProvider,
        private readonly walletAddress?: string,
        private readonly impl?:        string,
    ) {}

    // ─── Reads ─────────────────────────────────────────────────────────────

    /** Full on-chain factory configuration (fees, arbitrator, owner, …). */
    readConfig(): Promise<FactoryInfo> {
        return this.reader.readFactory(this.cfg.factoryAddress);
    }

    /**
     * Quotes the gross amount (net + protocol fee) for a given net amount.
     * Use the returned `gross` value as `amount` when building `CreatePaymentParams`.
     */
    quoteGross(net: bigint): Promise<FeeQuote> {
        return this.reader.quoteGross(this.cfg.factoryAddress, net);
    }

    /** Current protocol fee in basis points (10 000 = 100 %). */
    feeBps(): Promise<bigint> {
        return this.reader.readFeeBps(this.cfg.factoryAddress);
    }

    /** Number of registered payment implementation contracts. */
    implementationCount(): Promise<number> {
        return this.reader.readImplementationCount(this.cfg.factoryAddress);
    }

    /** Implementation address + name at `index` (0-based). */
    implementationAt(index: number): Promise<PaymentImplementationInfo> {
        return this.reader.readImplementationAt(this.cfg.factoryAddress, index);
    }

    /**
     * Calls `predictPaymentAddress` on-chain and returns the deterministic clone address.
     * Pass the wallet/creator that will submit `createPayment(...)`.
     */
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

    /**
     * Reads all registered payment implementations from the factory.
     *
     * Returns an ordered list of `{ address, name }` pairs suitable for
     * passing to {@link DPaymentsSdkConfig.impl} or {@link DPayments.fromProvider}.
     */
    async listImplementations(): Promise<PaymentImplementationInfo[]> {
        const count = await this.reader.readImplementationCount(this.cfg.factoryAddress);
        return Promise.all(
            Array.from({ length: count }, (_, i) =>
                this.reader.readImplementationAt(this.cfg.factoryAddress, i)),
        );
    }

    // ─── Writes ────────────────────────────────────────────────────────────

    /**
     * Build an unsigned `createPayment` transaction for a native-ETH-funded payment.
     */
    createEthPayment(p: Omit<CreatePaymentParams, 'callerWallet'>, wallet?: string): PreparedTx {
        return this.builder.createEthPayment(this.cfg, {
            ...p,
            callerWallet: this.resolveWallet(wallet),
            impl: this.impl,
        });
    }

    /**
     * Build an unsigned `createPayment` transaction for an ERC20-funded payment.
     */
    createErc20Payment(p: Omit<CreatePaymentParams, 'callerWallet'>, wallet?: string): PreparedTx {
        return this.builder.createErc20Payment(this.cfg, {
            ...p,
            callerWallet: this.resolveWallet(wallet),
            impl: this.impl,
        });
    }

    /**
     * Build an ERC20 `approve(spender, amount)` transaction.
     */
    erc20Approve(p: Omit<Erc20ApproveParams, 'ownerWallet'>, wallet?: string): PreparedTx {
        return this.builder.erc20Approve(this.cfg, {
            ...p,
            ownerWallet: this.resolveWallet(wallet),
        });
    }

    // ─── Prepare helpers (read + build in one call) ───────────────────────────

    /**
     * Quotes the protocol fee, then builds the `createPayment` transaction for ETH.
     *
     * Pass `netAmount` — gross and fee are computed automatically.
     * `paymentId` is auto-generated (cryptographically random bytes32) if omitted.
     *
     * Eliminates the manual quote → create pattern:
     * ```ts
     * // Before
     * const { gross, fee } = await dpayments.factory.quoteGross(net);
     * const tx = dpayments.factory.createEthPayment({ paymentId, amount: net, fee, … });
     *
     * // After
     * const { tx, paymentId, gross, fee } = await dpayments.factory.prepareCreateEthPayment({
     *   netAmount: 1_000_000n,
     *   payeeAddress: '0xPAYEE…',
     *   settlementTimeUnixSec: BigInt(Math.floor(Date.now() / 1000) + 7 * 86400),
     * });
     * ```
     */
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

    /**
     * Quotes the protocol fee, predicts the clone address, then builds both the
     * ERC20 `approve` and `createPayment` transactions.
     *
     * **Send `approveTx` first**, then `createTx`.
     *
     * ```ts
     * const { approveTx, createTx, paymentId, gross, predictedAddress } =
     *   await dpayments.factory.prepareCreateErc20Payment({
     *     tokenAddress: '0xTOKEN…',
     *     netAmount:    1_000_000n,
     *     payeeAddress: '0xPAYEE…',
     *     settlementTimeUnixSec: BigInt(Math.floor(Date.now() / 1000) + 7 * 86400),
     *   });
     * await signer.sendTransaction(approveTx);
     * await signer.sendTransaction(createTx);
     * ```
     */
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

    // ─── Event history ─────────────────────────────────────────────────────

    /**
     * Fetches all `PaymentCreated` events emitted by this factory.
     *
     * @param fromBlock  First block to scan (default: 0).
     * @param toBlock    Last block to scan (default: 'latest').
     */
    async getLogs(
        fromBlock: number | 'earliest' = 0,
        toBlock:   number | 'latest'   = 'latest',
    ): Promise<PaymentCreatedEvent[]> {
        const rawLogs = await this.provider.getLogs({
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
        const rawLogs = await this.provider.getLogs({
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
        const rawLogs = await this.provider.getLogs({
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

    /**
     * Convenience — fetches PaymentCreated events filtered by role.
     *
     * `role: 'payer'`  → returns events created by `party`.
     * `role: 'payee'`  → returns events where `party` is the payee.
     *
     * TODO: This is a stopgap. The event query layer needs a proper design and implementation, with flexible filtering, pagination, etc. Refactor when that is in place.
     */
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

    // ─── Internals ─────────────────────────────────────────────────────────

    private resolveWallet(override?: string): string {
        const w = override ?? this.walletAddress;
        if (!w) throw new Error(
            'walletAddress is required — pass it to new DPayments({ walletAddress }) or as the last argument to this method.',
        );
        return w;
    }
}

// ─── DPayments ─────────────────────────────────────────────────────────────────

/**
 * Top-level entry point for the DPayments SDK.
 *
 * Zero-config usage (auto-detects chain + factory from the wallet):
 * ```ts
 * const dpayments = await DPayments.fromProvider(provider);
 * ```
 *
 * Explicit config (for custom chains or factory addresses):
 * ```ts
 * const dpayments = new DPayments({
 *   chainId:        1,
 *   factoryAddress: '0x…',
 *   provider,
 *   walletAddress:  '0x…',   // optional — fills callerWallet on all write ops
 *   impl:           { address: '0x…', name: 'DisputablePayment' },  // optional
 * });
 *
 * // Factory-level operations
 * const info     = await dpayments.factory.readConfig();
 * const quote    = await dpayments.factory.quoteGross(1_000_000n);
 * const createTx = dpayments.factory.createEthPayment(params);
 *
 * // Bound payment — no network call
* const dPayment    = dpayments.dPayment('0x…');
     * const state        = await dPayment.read();
     * const settleTx     = dPayment.settle();
     * const history      = await dPayment.getLogs();
 * ```
 */
export class DPayments {
    /** Factory-level operations (reads + create tx). */
    readonly factory: FactoryHandle;

    private readonly _reader:   PaymentReader;
    private readonly _builder:  PaymentTxBuilder;
    private readonly _events:   PaymentEvents;
    private readonly _cfg:      PaymentsConfig;
    private readonly _provider: AbstractProvider;
    private readonly _wallet?:  string;
    private readonly _impl?:    string;

    constructor(config: DPaymentsSdkConfig) {
        requireAddress(config.factoryAddress, 'factoryAddress');
        this._cfg      = { chainId: config.chainId, factoryAddress: config.factoryAddress };
        this._provider = config.provider;
        this._reader   = new PaymentReader(config.provider, config.multicall);
        this._builder  = new PaymentTxBuilder();
        this._events   = new PaymentEvents();
        this._wallet   = config.walletAddress;
        this._impl     = config.impl
            ? requireAddress(config.impl.address, 'impl')
            : undefined;

        this.factory = new FactoryHandle(
            this._cfg, this._reader, this._builder, this._events,
            this._provider, this._wallet, this._impl,
        );
    }

    /**
     * Creates a `DPayments` instance using a known deployment for the given chain ID.
     *
     * Convenience equivalent to:
     * ```ts
     * const factoryAddr = getFactoryAddress(chainId);
     * if (!factoryAddr) throw ...;
     * return new DPayments({ chainId, factoryAddress: factoryAddr, provider, walletAddress, impl });
     * ```
     *
     * @param chainId 1, 3, 4, 5, 42, 10, 137, 80001, etc.
     * @param provider
     * @param walletAddress
     * @param impl Optional payment implementation. Omit to use the factory's live default.
     * @throws if no known deployment exists for this chain ID.
     */
    static forChain(
        chainId: number,
        provider: AbstractProvider,
        walletAddress?: string,
        impl?: PaymentImplementationInfo,
    ): DPayments {
        const factoryAddress = getFactoryAddress(chainId);
        if (!factoryAddress) {
            const known = listDeployments().map(d => d.chainId).join(', ');
            throw new Error(
                `No default DPayments deployment known for chain ID ${chainId}. ` +
                `Provide a factoryAddress explicitly via new DPayments({ ... }). ` +
                `Known chains: ${known}.`,
            );
        }
        return new DPayments({ chainId: Number(chainId), factoryAddress, provider, walletAddress, impl });
    }

    /**
     * Creates a `DPayments` instance by auto-detecting the chain from the provider
     * and resolving the factory address from known deployments.
     *
     * This is the **recommended** entry point — zero config:
     * ```ts
     * const provider = new ethers.BrowserProvider(window.ethereum);
     * const dpayments = await DPayments.fromProvider(provider);
     * ```
     *
     * With optional wallet address (auto-fills callerWallet on write ops):
     * ```ts
     * const signer = await provider.getSigner();
     * const dpayments = await DPayments.fromProvider(provider, await signer.getAddress());
     * ```
     *
     * With a specific payment implementation by name or address:
     * ```ts
     * const dpayments = await DPayments.fromProvider(
     *     provider, await signer.getAddress(), 'DisputablePayment');
     * ```
     *
     * @param provider          Any ethers AbstractProvider (BrowserProvider, JsonRpcProvider, etc.)
     * @param walletAddress     Optional — when set, all write ops pre-fill `callerWallet`.
     * @param implNameOrAddress Optional — name or address of a registered implementation.
     *                          Omit to use the factory's live default.
     * @param multicall
     * @throws if the provider's chain ID has no known factory deployment.
     */
    static async fromProvider(
        provider: AbstractProvider,
        walletAddress?: string,
        implNameOrAddress?: string,
        multicall?: MulticallConfig,
    ): Promise<DPayments> {
        const { chainId } = await provider.getNetwork();
        const factoryAddress = getFactoryAddress(Number(chainId));
        if (!factoryAddress) {
            const known = listDeployments().map(d => d.chainId).join(', ');
            throw new Error(
                `No default DPayments deployment known for chain ID ${chainId}. ` +
                `Provide a factoryAddress explicitly via new DPayments({ ... }). ` +
                `Known chains: ${known}.`,
            );
        }

        let impl: PaymentImplementationInfo | undefined;
        if (implNameOrAddress) {
            impl = await this._resolveImpl(provider, factoryAddress, implNameOrAddress);
        }

        return new DPayments({ chainId: Number(chainId), factoryAddress, provider, walletAddress, impl, multicall });
    }

    private static async _resolveImpl(
        provider: AbstractProvider,
        factoryAddress: string,
        nameOrAddress: string,
    ): Promise<PaymentImplementationInfo> {
        // Address: validate and return directly
        if (nameOrAddress.startsWith('0x')) {
            return { address: requireAddress(nameOrAddress, 'impl'), name: '' };
        }
        // Name: read factory, find match
        const reader = new PaymentReader(provider);
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

    /**
     * Returns a `DPayment` bound to the given deployed clone address.
     *
     * This is a **free, synchronous** operation — no network call is made.
     */
    dPayment(address: string): DPayment {
        return new DPayment(
            requireAddress(address, 'paymentAddress'),
            this._cfg, this._reader, this._builder, this._events, this._provider, this._wallet,
        );
    }
}