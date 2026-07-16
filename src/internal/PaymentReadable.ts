import type { AppealPeriod, PaymentInfo, PaymentState } from '../types.js';

/**
 * Shared callable read API used by both the unbound reader and a bound payment.
 * `PaymentArgs` is either `[paymentAddress]` or `[]` when the address is already bound.
 */
export interface PaymentReadable<PaymentArgs extends [] | [paymentAddress: string]> {
    (...args: PaymentArgs): Promise<PaymentInfo>;
    state(...args: PaymentArgs): Promise<PaymentState>;
    payer(...args: PaymentArgs): Promise<string>;
    payee(...args: PaymentArgs): Promise<string>;
    token(...args: PaymentArgs): Promise<string>;
    amount(...args: PaymentArgs): Promise<bigint>;
    settlementTime(...args: PaymentArgs): Promise<bigint>;
    disputeId(...args: PaymentArgs): Promise<bigint>;
    disputeStartTime(...args: PaymentArgs): Promise<bigint>;
    arbitrator(...args: PaymentArgs): Promise<string>;
    arbitratorConfiguration(...args: PaymentArgs): Promise<string>;
    arbitrationCost(...args: PaymentArgs): Promise<bigint>;
    appealCost(...args: PaymentArgs): Promise<bigint>;
    appealPeriod(...args: PaymentArgs): Promise<AppealPeriod>;
    pendingWithdrawal(...args: [...PaymentArgs, wallet: string]): Promise<bigint>;
}
