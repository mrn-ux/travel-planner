import Stripe from 'stripe';
import { getConfig } from '../../config.js';
import type { Provenance, ProviderResult } from '../types.js';
import { fromMinorUnits, toMinorUnits } from './minorUnits.js';
import type { PaymentInfo, PaymentProvider } from './PaymentProvider.js';

const URL = 'https://dashboard.stripe.com/test/payments';

/** Stripe in TEST mode only: construction fails, and so the API refuses to start, unless both keys are test keys. */
export class StripePaymentProvider implements PaymentProvider {
  private readonly stripe: Stripe;
  private readonly publishableKey: string;

  constructor() {
    const { stripe } = getConfig();
    if (!stripe.secretKey.startsWith('sk_test_')) throw new Error('STRIPE_SECRET_KEY must be a test-mode key (starting sk_test_). Live keys are refused.');
    if (!stripe.publishableKey.startsWith('pk_test_')) throw new Error('STRIPE_PUBLISHABLE_KEY must be a test-mode key (starting pk_test_). Live keys are refused.');
    this.stripe = new Stripe(stripe.secretKey, { maxNetworkRetries: 1, timeout: 15000 });
    this.publishableKey = stripe.publishableKey;
  }

  private prov(): Provenance {
    return { source: 'stripe', source_url: URL, fetched_at: new Date().toISOString(), certainty: 'confirmed', sandbox: true };
  }

  private fail<T>(err: unknown): ProviderResult<T> {
    const e = err as { type?: string; code?: string; message?: string };
    console.warn('Stripe call failed:', e.type ?? 'error', e.code ?? '', e.message ?? '');
    return { ok: false, reason: e.type === 'StripeConnectionError' ? 'timeout' : 'http_error', detail: e.code };
  }

  async createPayment(input: { bookingId: string; amount: string; currency: string; idempotencyKey: string }): Promise<ProviderResult<{ paymentId: string; clientSecret: string }>> {
    try {
      const intent = await this.stripe.paymentIntents.create(
        {
          amount: Number(toMinorUnits(input.amount, input.currency)),
          currency: input.currency.toLowerCase(),
          automatic_payment_methods: { enabled: true },
          metadata: { bookingId: input.bookingId },
        },
        { idempotencyKey: input.idempotencyKey },
      );
      if (!intent.client_secret) return { ok: false, reason: 'invalid_response', detail: 'No client secret' };
      return { ok: true, data: { paymentId: intent.id, clientSecret: intent.client_secret }, provenance: this.prov() };
    } catch (err) {
      return this.fail(err);
    }
  }

  async getPayment(paymentId: string): Promise<ProviderResult<PaymentInfo>> {
    try {
      const i = await this.stripe.paymentIntents.retrieve(paymentId);
      const status: PaymentInfo['status'] = i.status === 'succeeded' ? 'succeeded' : i.status === 'requires_action' ? 'requires_action' : i.status === 'canceled' || i.last_payment_error ? 'failed' : 'created';
      return {
        ok: true,
        provenance: this.prov(),
        data: {
          status,
          amount: fromMinorUnits(i.amount, i.currency),
          currency: i.currency.toUpperCase(),
          bookingId: i.metadata?.['bookingId'] ?? null,
          ...(i.last_payment_error ? { failureCode: i.last_payment_error.code ?? i.last_payment_error.decline_code ?? 'payment_failed', failureMessage: i.last_payment_error.message ?? 'The payment was not accepted.' } : {}),
        },
      };
    } catch (err) {
      return this.fail(err);
    }
  }

  async refund(input: { paymentId: string; idempotencyKey: string }): Promise<ProviderResult<{ refundId: string }>> {
    try {
      const r = await this.stripe.refunds.create({ payment_intent: input.paymentId }, { idempotencyKey: input.idempotencyKey });
      return { ok: true, data: { refundId: r.id }, provenance: this.prov() };
    } catch (err) {
      return this.fail(err);
    }
  }

  publicConfig(): { publishableKey: string } {
    return { publishableKey: this.publishableKey };
  }
}
