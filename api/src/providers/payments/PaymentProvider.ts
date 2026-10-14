import type { ProviderResult } from '../types.js';

export type PaymentStatus = 'created' | 'requires_action' | 'succeeded' | 'failed';

export interface PaymentInfo {
  status: PaymentStatus;
  /** Decimal string in `currency`. */
  amount: string;
  currency: string;
  bookingId: string | null;
  failureCode?: string;
  /** Safe to show the traveler. */
  failureMessage?: string;
}

/**
 * Payment. One real implementation (Stripe in test mode), chosen by PAYMENT_PROVIDER. Card data never reaches Faro: only the
 * client secret and payment ids are handled. Refunds are idempotent by key.
 */
export interface PaymentProvider {
  createPayment(input: { bookingId: string; amount: string; currency: string; idempotencyKey: string }): Promise<ProviderResult<{ paymentId: string; clientSecret: string }>>;
  getPayment(paymentId: string): Promise<ProviderResult<PaymentInfo>>;
  refund(input: { paymentId: string; idempotencyKey: string }): Promise<ProviderResult<{ refundId: string }>>;
  publicConfig(): { publishableKey: string };
}
