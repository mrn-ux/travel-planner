# Research: Booking and Confirmation Flow

**UNVERIFIED** marks facts to confirm against live docs or the sandbox when implementing.

## R1. LiteAPI prebook and book
- **Hosts**: booking calls go to `https://book.liteapi.travel/v3.0` with header `X-API-Key`.
- **Prebook**: `POST /rates/prebook` `{ offerId, usePaymentSdk: false }` → `prebookId`, `price`, `priceDifferencePercent`, `cancellationChanged`, `boardChanged`. **Policy** (docs do not say): any of `priceDifferencePercent ≠ 0`, `cancellationChanged`, `boardChanged` is treated as a change that must be shown and accepted before payment. Errors: 4040 outdated offer (refetch rates), 4016 timeout, 4002 invalid offer.
- **Book**: `POST /rates/book` `{ prebookId, holder{firstName,lastName,email,phone}, guests[{occupancyNumber,firstName,lastName,email}], payment{method:'ACC_CREDIT_CARD'}, clientReference }` → `data.bookingId`, `status` (`CONFIRMED`|`CANCELED`), `hotelConfirmationCode` (**may be empty**; supplier fills it later), `cancellationPolicies`, `lastFreeCancellationDate`, price/currency. Errors: 4012 (HTTP 410 room gone/rate expired), 2013/2014 provider or payment failure, 4005 repeated `clientReference`.
- **Idempotency**: the booking's UUID is sent as `clientReference`; a retry returns 4005, which the service treats as "already attempted: look the booking up" rather than a failure.
- **Retrieval**: `GET /bookings/{bookingId}` and a list-by-client-reference call are **UNVERIFIED** paths; implementation confirms in sandbox. If lookup by `clientReference` is unavailable, the reconciler keeps the booking `pending` and surfaces "needs attention" after a cut-off.
- **Booking reference shown to the traveler**: Faro's own short reference is not invented; the displayed reference is LiteAPI's `bookingId`, and `hotelConfirmationCode` is shown when present ("Hotel confirmation code: pending" otherwise). Flagged: if the sandbox returns no usable id, booking is reported as failed.
- **MCP**: not used (tool names unverified; REST is simpler).
- **Several rooms** (Updated 2026-10-13): `book` sends one `guests` entry per room (`occupancyNumber` 1..n, the holder's name) and only the offer's own total covers all rooms, so the booking keeps one `shown_price`/`final_price` for the whole stay and `bookings.rooms` holds the count; the room types chosen per room are listed in `room_name`.

## R2. Stripe (test mode)
- **Flow**: server `POST /v1/payment_intents` via `stripe.paymentIntents.create({ amount, currency, automatic_payment_methods: {enabled: true}, metadata: {bookingId} }, { idempotencyKey: 'pi_' + bookingId })`; return `client_secret`; browser mounts the Payment Element with the publishable key (`GET /api/config/public`) and calls `stripe.confirmPayment({ elements, redirect: 'if_required', confirmParams: { return_url } })`. Updated 2026-10-13: `return_url` is short, `<origin>/trip/<tripId>/book/<hotelId>?booking=<id>`, so no price, room or traveler data travels in the URL; Stripe adds `payment_intent` on return.
- **Verification**: after confirm, the browser calls `POST /api/bookings/:id/complete`; the server retrieves the PaymentIntent and requires `status === 'succeeded'` and matching amount/currency/metadata before booking. The client is never trusted.
- **Test cards**: success `4242 4242 4242 4242`; decline `4000 0000 0000 0002`; 3-D Secure succeeds `4000 0027 6000 3184`; 3-D Secure declines `4000 0084 0000 1629`.
- **Key prefixes**: the API refuses to start unless `STRIPE_SECRET_KEY` starts `sk_test_` and `STRIPE_PUBLISHABLE_KEY` starts `pk_test_` (the `pk_test_` prefix is **UNVERIFIED** in the docs read; `sk_test_` is shown in Stripe's examples).
- **Idempotency**: every Stripe POST carries an `Idempotency-Key` (≤ 255 chars; kept ≥ 24 h).
- **Webhooks**: not used (needs a public URL or the Stripe CLI); see the trade-off in plan.md and R6.
- **Refunds**: `stripe.refunds.create({ payment_intent }, { idempotencyKey: 'rf_' + bookingId })`.
- **MCP**: Stripe's hosted MCP has no create-PaymentIntent tool (only generic read/write helpers; PaymentIntent creation unconfirmed) and from 31 Oct 2026 rejects full-access secret keys; **Decision**: use the Node SDK. 

## R3. Minor units
- **Decision**: `minorUnits.ts` converts a decimal string to an integer string using the currency's exponent: 2 by default; 0 for zero-decimal currencies (e.g. JPY, KRW); 3 for BHD/KWD etc.; implemented with string/BigInt arithmetic, no floats. Unknown currency → refuse to start payment with a clear message.

## R4. Email through Gmail
- **Decision**: `nodemailer` with `host: smtp.gmail.com`, `port: 465`, `secure: true`, `auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }`. Requires a Google account with 2-step verification and an app password (not the account password). Gmail may rewrite the From address to the authenticated account. Sending limits apply (consumer accounts ≈ 500 messages/day, **UNVERIFIED**).
- Email body: booking reference, hotel, dates, final price (formatted `USD 765.00`), cancellation summary, "Sandbox booking — no real reservation" line. Sent to the signed-in user's email. Failure never rolls back the booking: the row in `confirmation_messages` records `sent | failed | not_configured`, the page shows "email not sent", and **Resend email** retries.

## R5. State machine
- **States**: `in_progress` (with a `step`), `pending` (payment taken, provider outcome unknown), `confirmed`, `failed` (with `failure_reason`).
- **Steps** within `in_progress`: `verify → price → guest → confirm → pay`. A step can only be entered when the previous step's stored result exists (no skipping), enforced server-side.
- **Transitions**: `verify` runs a live rates call for the chosen `offerId`; success moves to `price` where prebook runs (price/terms stored); acceptance of any change is recorded; guest details stored; `confirm` creates the PaymentIntent; `complete` (after Stripe succeeded) calls book → `confirmed`; provider timeout/5xx → `pending`; provider says room gone or booking failed → refund → `failed`.
- **Locking**: every transition runs in a transaction with `SELECT … FOR UPDATE` on the booking row, so double-submits serialise and the second sees the new state (idempotent response).

## R6. Timeout, pending and reconciliation
- Book call timeout (default 20 s) → `pending`, message "Payment received; confirming with the hotel provider". A job (`reconcileAll`/`reconcileOne` in `api/src/bookings/service.ts`, scheduled with node-cron every minute from `index.ts`; the name `reconcile.ts` is superseded as of 2026-10-13; also run when the traveler opens the booking) looks up the booking by `clientReference`: found confirmed → `confirmed` + email; found cancelled or not found after 15 minutes → refund → `failed`. A paid PaymentIntent with no `/complete` call (browser closed) is also found by scanning `payment_attempts` in `awaiting_return` and retrieving the intent.
- This is the substitute for Stripe webhooks.

## R7. Duplicate prevention
- Layers: (1) partial unique index on `(user_id, provider_hotel_id, checkin, checkout, room_id)` for statuses `in_progress`, `pending`, `confirmed` — a second start returns the existing booking; (2) row lock per transition; (3) Stripe idempotency keys derived from the booking id; (4) LiteAPI `clientReference` = booking id; (5) the UI disables buttons while a call is in flight.

## R8. Failure messaging
| Case | Detection | UI (UI-SPEC: `danger` inline alert) | Next actions |
|---|---|---|---|
| Price change | prebook shows difference/terms change, or verify rate ≠ shown | "Price changed from USD 720.00 to USD 765.00" | Accept new price / Back |
| Room unavailable | rates empty, 4012, 4040 on re-fetch | `over-budget`-styled alert at Verify (per UI-SPEC) | Back to hotel details |
| Payment failure | Stripe confirm error or intent not succeeded | decline reason from Stripe (safe text) | Try again / change method / Back |
| Provider timeout | book call timeout | "Pending confirmation" | Wait (auto-refresh) / contact note |
| Paid but booking failed | book error with intent succeeded | "Booking failed; payment refunded" | Back to hotel details |
| Email failure | notification result | "Booking confirmed; email not sent" | Resend email |

## Implementation notes (verified live, October 2026)

- **LiteAPI sandbox**: `POST book.liteapi.travel/v3.0/rates/prebook` returns `prebookId`, `price`, `priceDifferencePercent`, `cancellationChanged`, `boardChanged`; `POST /rates/book` with `payment.method = ACC_CREDIT_CARD` returns `status: CONFIRMED`, a `bookingId` (the reference shown) and `hotelConfirmationCode` (`test` in the sandbox) immediately. Bookings are retrievable with `GET api.liteapi.travel/v3.0/bookings?clientReference=<id>` (and by id on either host), which is what reconciliation uses. Offer ids change on every rates call, so the booking stores a stable room id and the verify step takes a fresh offer id.
- **Failure paths tested**: price change at verify (409 + accept, stale quote refused), room gone (booking failed, no payment), card declined (402, retry succeeds on the same payment), paid but provider refuses (refund recorded), provider timeout with `BOOK_TIMEOUT_MS=1` (pending, then refunded after 15 minutes), double submit of complete (one booking, one payment), duplicate start (existing booking returned, 409 when already confirmed).
- **Stripe**: payments are created with idempotency key `pi_<bookingId>`; `complete` retrieves the PaymentIntent and requires status, amount, currency and booking id to match. Test payment methods (`pm_card_visa`, `pm_card_chargeDeclined`) were used server-side.
- **Gmail**: Google shows an app password as four groups separated by spaces. The config now strips whitespace from `GMAIL_APP_PASSWORD`, and with the updated password a confirmation email was sent through `smtp.gmail.com:465` (status `sent` recorded in `confirmation_messages`).

## R9. Flights in Duffel test mode (added 2026-10-13, constitution 3.5.0)
- **Decision**: the Duffel Node SDK behind `FlightProvider`. `getOffer` looks the chosen offer up again just before booking (live price, expiry, the travelers to name by type, terms); `createOrder` creates an `instant` order paid with `payments: [{ type: 'balance', amount, currency }]` from the test balance. A live token is refused at start-up. No Stripe is involved: no real money moves.
- **Never reported booked early**: a row is stored (and a reference shown) only after the order call succeeds; a timeout answers 504 "not confirmed" and stores nothing.
- **Price**: the amount the traveler accepted must equal the live amount, else 409 `price_changed` and nothing is booked.
- **Age bands**: Duffel sorts passengers by age on the **flight day**: infant (under 2, no seat), child (2 to 11), adult (12 and over). The API checks each date of birth against the band of that seat before calling Duffel and names the traveler and the accepted range; Duffel's own "does not match date of birth" error is mapped to `dob_mismatch`.
- **Infants**: each infant needs an adult of their own; refused at `check` and again at booking (`infant_needs_adult`).
- **One flight per trip**: partial unique index `flight_bookings_one_confirmed`; two simultaneous requests are settled by it (409 `duplicate`).
- **Email**: the same Gmail provider (`sendFlightConfirmation`); status stored in `flight_bookings.email_status`; resend endpoint; failure never undoes the booking.
