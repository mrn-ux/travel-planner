# Contract: Booking API

Conventions: [platform contract](../../001-app-shell-navigation/contracts/platform.md). **Every endpoint requires a session** and filters by `user_id`; without one the API returns 401 and the web app redirects to `/login` (plan 002). Transitions are idempotent: repeating a call for a step already completed returns the stored result.

| Method & path | Request | Success | Failures |
|---|---|---|---|
| `POST /api/trips/:tripId/bookings` | `{ hotelId, roomId, roomName?, offerId, checkin, checkout, shownPrice, currency, rooms? }` (`rooms` 1-10, default 1; `shownPrice` is the total for all rooms. Updated 2026-10-13) | 201 `{ booking }` (or 200 with the existing booking when a duplicate in progress/pending/confirmed exists) | 400; 404 trip; 409 `duplicate_confirmed` (returns the confirmed booking) |
| `GET /api/bookings/:id` | | 200 `{ booking }` (also runs a reconcile check for `pending`) | 404 |
| `POST /api/bookings/:id/verify` | | 200 `{ booking, availability: { available: true, price: Priced } }` | 409 `room_unavailable` (booking → failed, no charge); 409 `price_changed` `{ oldPrice, newPrice }`; 504 `provider_timeout` |
| `POST /api/bookings/:id/price` | | 200 `{ booking, price: Priced, cancellation }` (runs prebook) | 409 `price_changed` / `terms_changed`; 409 `room_unavailable`; 504 |
| `POST /api/bookings/:id/accept-price` | `{ amount, currency }` (must equal the latest quoted price) | 200 `{ booking }` | 409 stale quote |
| `PUT /api/bookings/:id/guest` | `{ firstName, lastName, email, phone, specialRequests? }` | 200 `{ booking }` | 400 field errors |
| `POST /api/bookings/:id/confirm` | | 200 `{ booking, clientSecret }` (creates the PaymentIntent for the accepted price) | 409 wrong step; 502 payment provider |
| `POST /api/bookings/:id/complete` | `{ paymentIntentId }` | 200 `{ booking }` with `status` `confirmed`, `pending` or `failed` | 402 `payment_failed` `{ reason }`; 409 wrong step |
| `POST /api/bookings/:id/resend` | | 200 `{ message: { status } }` | 409 not confirmed; 502 email failure (booking unaffected) |
| `GET /api/config/public` | | `{ stripePublishableKey }` | |

## Shapes

```ts
type Booking = {
  id: string; status: 'in_progress'|'pending'|'confirmed'|'failed'; step: 'verify'|'price'|'guest'|'confirm'|'pay'|'done';
  hotel: { id: string; name: string }; room: { id: string; name: string };   // room.name lists the room type(s) chosen
  tripId: string; checkin: string; checkout: string; nights: number; adults: number; childrenAges: number[];
  rooms: number;                           // Updated 2026-10-13: number of rooms in this booking
  guest: { firstName: string; lastName: string; email: string; phone: string; specialRequests?: string } | null;
  refundPending: boolean;
  shownPrice: Priced; finalPrice: Priced | null;
  cancellation: { refundable: boolean; freeUntil: string | null; text: string } | null;
  reference: string | null;                // provider bookingId, only when confirmed
  hotelConfirmationCode: string | null;
  failureReason: string | null; sandbox: true;
  email: { status: 'sent'|'failed'|'not_configured'|null };
};
```

## Rules
- `reference` is `null` unless `status === 'confirmed'`; the UI shows a confirmation only then.
- A price change returns 409 with both prices and blocks `confirm` until `accept-price`.
- `complete` retrieves the PaymentIntent server-side; it books only when status is `succeeded` and amount/currency/metadata match.
- Provider timeout on book → `pending`; polling `GET /api/bookings/:id` (the UI refreshes every few seconds) resolves it.
- Failure after a succeeded payment triggers a refund before the response; `status` becomes `failed` with `refund` recorded.
- No endpoint returns card data; Stripe's client secret is returned once per intent.
- Updated 2026-10-13: `GET /api/bookings/:id` also settles a `pending` booking or one stuck at the `pay` step (reconcile), as the every-minute job does. The Pay step's `return_url` is the short booking route with `?booking=<id>` (Stripe adds `payment_intent`).

## Agent tools
| Tool | Arguments | Notes |
|---|---|---|
| `check_hotel_availability` | `{ hotelId, roomId?, checkin?, checkout? }` (dates default to the trip's) | Read-only live rate check; `chatCallable: true` |
| `create_hotel_booking` | `{ bookingId }` | Executes the post-payment provider booking; `chatCallable: false` (called only by the booking service from `/complete`) |

## UI (UI-SPEC §2.7)
Stepper (design `BookingStepper`) with step content below; **Select room** already complete on arrival. Alerts: `over-budget` style for room unavailable at Verify, `danger` style for price change, payment failure, timeout. Confirmation: reference, hotel, dates, final price (`USD 765.00`), email status note, **View in My trips**, **Resend email**. Stripe's Payment Element renders in the Pay step; Faro adds no card inputs.

## Flight booking (added 2026-10-13, constitution 3.5.0)

Duffel test mode only (the API refuses a live token); trains and buses are never booked. Every route requires a session and an owned trip (404 otherwise). The flight is the trip's chosen Duffel option (`trip_transport.provider_ref`); there is no Stripe step: the order is paid from the Duffel test balance. Errors are `{ error, code? }`.

| Method & path | Request | Success | Failures |
|---|---|---|---|
| `GET /api/trips/:id/flight-booking` | | 200 `{ booking: FlightBooking \| null }` (the trip's confirmed booking) | 404 |
| `POST /api/trips/:id/flight-booking/check` | | 200 `{ offer, shownPrice, priceChanged, existing }`: the offer is looked up again (live price, terms, travelers to name with their type and age) | 409 `no_flight_selected`; 409 `offer_unavailable`; 400 `infant_needs_adult`; 502/504 `provider_unavailable`; 503 not set up |
| `POST /api/trips/:id/flight-booking` | `{ amount, currency, passengers[] }` (each: title, givenName, familyName, bornOn, gender, email, phoneNumber in `+` international format) | 201 `{ booking }` only after the airline service confirms | 409 `duplicate` (one confirmed flight per trip); 409 `price_changed` (nothing booked); 409 `offer_unavailable`; 400 `infant_needs_adult`; 400 field errors (a date of birth outside the band, a missing traveler); 400 `dob_mismatch`; 504 `provider_timeout` (not confirmed); 502 `booking_failed` |
| `POST /api/trips/:id/flight-booking/resend` | | 200 `{ status }` | 409 no confirmed booking; 502 email failure (booking unaffected) |

Rules: the accepted `amount`/`currency` must equal the live price. Age bands are decided on the **flight day**: infant under 2, child 2 to 11, adult 12 and over; the date of birth of each named traveler must fit the band of their seat, and the 400 message names the traveler and the accepted date range. Each infant (under 2, no seat) needs an adult of their own in the same booking; this is checked in `check` and again in the booking call, before any detail is asked.

```ts
type FlightBooking = {
  id: string; status: 'confirmed' | 'failed'; reference: string | null;   // airline booking reference, from the order
  airline: string | null; origin: string | null; destination: string | null;
  departureAt: string | null; arrivalAt: string | null;
  total: { amount: string; currency: string } | null;
  passengers: { name: string }[];
  email: { status: 'sent' | 'failed' | 'not_configured' | null };
  sandbox: true;
};
```
