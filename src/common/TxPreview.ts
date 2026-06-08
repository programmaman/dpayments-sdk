
/**
 * A single line item in a fee breakdown.
 */
export interface FeeLineItem {
    /** Human-readable label, e.g. "Protocol fee (2.5%)", "Arbitration cost". */
    label: string;
    /** Amount in wei as a decimal string (safe for BigInt conversion). */
    amountWei: string;
    /** Token address. ZeroAddress (0x000…0) for native ETH; ERC20 address otherwise. */
    token: string;
}

/**
 * Structured breakdown of all fees associated with a transaction.
 * Attach to {@link SigningPreview#fees} so the UI can render a cost summary.
 */
export interface FeeBreakdown {
    /** Primary token address for this fee group (ZeroAddress for ETH). */
    token: string;
    /** Individual fee line items. Sum of `amountWei` across items == `totalFeeWei`. */
    items: FeeLineItem[];
    /** Pre-computed sum of all item `amountWei` values (decimal string). */
    totalFeeWei: string;
}

/**
 * Human-readable preview of an unsigned transaction.
 *
 * Wallets and UIs attach this to a {@link PreparedTx} and render it in a
 * signing confirmation dialog so users understand exactly what they are signing.
 */
export interface SigningPreview {
    /** Short action label shown as the title, e.g. "Create Payment". */
    action: string;

    /**
     * Who is expected to sign, expressed as a role string.
     * Examples: `"payer"`, `"payee"`, `"either party"`, `"owner"`.
     */
    signer: string;

    /** One-sentence description of the transaction's on-chain effect. */
    description: string;

    /**
     * Native ETH value being sent with the transaction (in wei, decimal string).
     * Omitted when the transaction carries no ETH value.
     */
    valueWei?: string;

    /**
     * Primary token address relevant to this action.
     * ZeroAddress for native ETH; an ERC20 contract address otherwise.
     * Omitted for non-asset actions such as `submitEvidence`.
     */
    token?: string;

    /**
     * Token or ETH amount relevant to this action (decimal string, in wei/smallest unit).
     * For ETH actions this mirrors `valueWei`.
     * For ERC20 actions this is the token amount being transferred or approved.
     * Omitted for non-asset actions.
     */
    tokenAmountWei?: string;

    /**
     * Fee breakdown for actions that incur protocol or arbitration fees.
     * Omitted when no fees are applicable.
     */
    fees?: FeeBreakdown;

    /**
     * Supplementary key/value pairs for display purposes.
     * Examples: `{ "Payee": "0xABC…", "Settlement": "2026-12-31" }`.
     */
    details?: Record<string, string>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Ethereum zero address constant (20 zero bytes). */
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Builds a {@link FeeBreakdown} from an ordered list of named wei amounts.
 * Items with zero amount are included (callers may filter if desired).
 *
 * @param token   Token address for all items (ZeroAddress for ETH).
 * @param entries Pairs of [label, amountWei as bigint].
 */
export function buildFeeBreakdown(
    token: string,
    entries: ReadonlyArray<[label: string, amountWei: bigint]>,
): FeeBreakdown {
    const items: FeeLineItem[] = entries.map(([label, amountWei]) => ({
        label,
        amountWei: amountWei.toString(),
        token,
    }));
    const total = entries.reduce((acc, [, v]) => acc + v, 0n);
    return { token, items, totalFeeWei: total.toString() };
}

/**
 * Formats a Unix timestamp (seconds) to an ISO-8601 UTC string + relative description.
 * Returns e.g. "2026-12-31T23:59:59Z (in 6 months)".
 */
export function formatUnixSec(unixSec: bigint): string {
    const d = new Date(Number(unixSec) * 1000);
    const iso = d.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const now = Date.now();
    const diffMs = Number(unixSec) * 1000 - now;
    if (diffMs < 0) return `${iso} (past)`;
    const days = Math.floor(diffMs / 86400000);
    if (days > 365) {
        const years = Math.floor(days / 365);
        return `${iso} (in ~${years} year${years !== 1 ? 's' : ''})`;
    }
    if (days > 30) {
        const months = Math.floor(days / 30);
        return `${iso} (in ~${months} month${months !== 1 ? 's' : ''})`;
    }
    if (days > 0) return `${iso} (in ${days} day${days !== 1 ? 's' : ''})`;
    const hours = Math.floor(diffMs / 3600000);
    if (hours > 0) return `${iso} (in ${hours} hour${hours !== 1 ? 's' : ''})`;
    const mins = Math.floor(diffMs / 60000);
    return `${iso} (in ${mins} minute${mins !== 1 ? 's' : ''})`;
}
