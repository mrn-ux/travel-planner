# Contract: Payment and Notification provider interfaces

Files under `api/src/providers/`. One real implementation each, selected by config (`PAYMENT_PROVIDER=stripe`, `NOTIFICATION_PROVIDER=gmail`). No mock exists. The hotel booking calls use `HotelProvider` from [plan 005](../../005-hotel-transport-comparison/contracts/providers.md).

## PaymentProvider

```ts
export interface PaymentProvider {
  /** Throws at construction if keys are not test-mode keys (sk_test_ / pk_test_). */
  createPayment(input: { bookingId: string; amount: string; currency: string; idempotencyKey: string }):
    Promise<ProviderResult<{ paymentId: string; clientSecret: string }>>;
  getPayment(paymentId: string):
    Promise<ProviderResult<{ status: 'created'|'requires_action'|'succeeded'|'failed'; amount: string; currency: string;
                             bookingId: string | null; failureCode?: string; failureMessage?: string }>>;
  refund(input: { paymentId: string; idempotencyKey: string }): Promise<ProviderResult<{ refundId: string }>>;
  publicConfig(): { publishableKey: string };
}
```

`StripePaymentProvider` maps this to PaymentIntents, `paymentIntents.retrieve`, and `refunds.create`; amounts convert between decimal strings and Stripe minor units with `minorUnits.ts` (string/BigInt arithmetic). It refuses to construct, and so the API refuses to start, when `STRIPE_SECRET_KEY` does not start with `sk_test_` or `STRIPE_PUBLISHABLE_KEY` with `pk_test_`.

## NotificationProvider

```ts
export interface NotificationProvider {
  isConfigured(): boolean;
  sendBookingConfirmation(input: {
    to: string; bookingReference: string; hotelName: string;
    checkin: string; checkout: string; finalPrice: string; currency: string;
    cancellationSummary: string; hotelConfirmationCode: string | null; sandbox: true;
  }): Promise<ProviderResult<{ messageId: string }>>;
  /** Added 2026-10-13: the flight confirmation (reference, airline, route, times, total, traveler names). */
  sendFlightConfirmation(input: {
    to: string; bookingReference: string; airline: string; origin: string; destination: string;
    departure: string; arrival: string; total: string; currency: string; passengers: string[]; sandbox: true;
  }): Promise<ProviderResult<{ messageId: string }>>;
}
```

`GmailNotificationProvider` uses SMTP to `smtp.gmail.com:465` with `GMAIL_USER` and `GMAIL_APP_PASSWORD` (a Google app password). `isConfigured()` is false when either is unset; the service then records `not_configured` and the UI shows "email not sent".

## FlightProvider (added 2026-10-13)

`api/src/providers/flights/FlightProvider.ts`, one real implementation `DuffelFlightProvider` (Duffel SDK), selected by the presence of `DUFFEL_ACCESS_TOKEN`; unset means flights stay estimates and flight booking answers 503. A live token is refused at start-up (`flightProvider()` is called from `index.ts`).

```ts
export interface FlightProvider {
  getOffer(offerId: string): Promise<ProviderResult<FlightOfferDetail>>;   // live price, expiry, travelers to name (adult | child | infant_without_seat, with age), terms; reason 'not_found' = expired
  createOrder(input: { offerId: string; amount: string; currency: string; passengers: FlightPassenger[] }): Promise<ProviderResult<FlightOrder>>;   // type 'instant', paid from the test balance (payments: [{ type: 'balance', amount, currency }]); detail 'price_changed' / 'offer_no_longer_available' are explicit
  searchFlights(q: FlightSearchQuery): Promise<ProviderResult<FlightOffer[]>>;
}
```

## Rules
- Routes, the agent and the UI depend only on these interfaces and on `ProviderResult` (see plan 005 providers contract).
- Card data never reaches Faro: only Stripe's client secret and payment ids are handled.
- All results carry provenance; Stripe results carry `sandbox: true` semantics via `test_mode`.
