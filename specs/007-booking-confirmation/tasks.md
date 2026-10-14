---
description: "Task list for Booking and Confirmation Flow"
---

# Tasks: Booking and Confirmation Flow

**Input**: `/specs/007-booking-confirmation/` (plan.md, spec.md, research.md, data-model.md, contracts/booking-api.md, contracts/providers.md, quickstart.md)

**Prerequisites**: plan 001 Phases 1-2; plan 002 `requireUser`; plan 003 trips; plan 005 `HotelProvider` read methods and `RoomList` (offer ids).

**Tests**: None (manual `quickstart.md`, with Stripe test cards and forced failures).

**Format**: `- [ ] T### [P?] [US#?] Description with file path`

---

## Phase 1: Setup

- [X] T001 Append the 007 DDL fragment from `data-model.md` (`bookings` with the duplicate-prevention partial unique index, `payment_attempts`, `confirmation_messages`) to `db/init.sql`
- [X] T002 [P] Add `stripe`, `nodemailer` to `api/package.json` and `@stripe/stripe-js`, `@stripe/react-stripe-js` to `web/package.json`; add optional `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `PAYMENT_PROVIDER` (`stripe`), `NOTIFICATION_PROVIDER` (`gmail`), `BOOK_TIMEOUT_MS` (20000) to `api/src/config.ts` and `.env.example`

---

## Phase 2: Foundational

**CRITICAL**: complete before any user story.

- [X] T003 [P] Implement `api/src/providers/payments/minorUnits.ts`: decimal string to integer minor units with BigInt/string arithmetic and a currency exponent table (2 default, 0 for JPY/KRW, 3 for BHD/KWD etc.); unknown currency throws a clear error
- [X] T004 Define `api/src/providers/payments/PaymentProvider.ts` and implement `StripePaymentProvider.ts` per `contracts/providers.md`: constructor throws unless `STRIPE_SECRET_KEY` starts `sk_test_` and `STRIPE_PUBLISHABLE_KEY` starts `pk_test_` (so the API refuses to start), `createPayment` with idempotency key `pi_<bookingId>` and metadata `bookingId`, `getPayment` via retrieve, `refund` with key `rf_<bookingId>`, `publicConfig`
- [X] T005 [P] Define `api/src/providers/notifications/NotificationProvider.ts` and implement `GmailNotificationProvider.ts` with `nodemailer` (`smtp.gmail.com:465`, secure, `GMAIL_USER`, `GMAIL_APP_PASSWORD`), `isConfigured()`, and the confirmation body (reference, hotel, dates, final price formatted `USD 765.00`, cancellation summary, "Sandbox booking - no real reservation")
- [X] T006 Extend `api/src/providers/hotels/LiteApiHotelProvider.ts` with `checkAvailability(offerId)`, `prebook(offerId)` (`POST /rates/prebook` on `https://book.liteapi.travel/v3.0`, returning `prebookId`, `price`, `priceDifferencePercent`, `cancellationChanged`, `boardChanged`), `book(input)` (`POST /rates/book`, payment method `ACC_CREDIT_CARD`, `clientReference` = booking id; error 4005 means already attempted), and `getBooking(clientReference)`; all `ttlMs: 0`; confirm booking-retrieval paths in the sandbox
- [X] T007 Implement `api/src/bookings/machine.ts`: the allowed transitions and step order from `data-model.md`; every transition runs in a transaction with `SELECT ... FOR UPDATE` on the booking row and returns the stored result when repeated

---

## Phase 3: User Story 1 - Complete a booking (Priority: P1) MVP

**Goal**: verify, price and terms, guest details, confirm and pay, confirmation.

**Independent Test**: book a room end to end with sandbox and a Stripe test card; confirmation shows reference, hotel, dates, final price.

- [X] T008 [US1] Implement `POST /api/trips/:tripId/bookings` (creates the booking in `in_progress`/`verify`, or returns the existing in-progress/pending booking; 409 `duplicate_confirmed` returning the confirmed one) and `GET /api/bookings/:id` in `api/src/routes/bookings.ts`, all behind `requireUser` and filtered by `user_id`
- [X] T009 [US1] Implement `POST /api/bookings/:id/verify` in `api/src/bookings/service.ts` + route: live rates call for the offer, availability and price with certainty; set step `price`
- [X] T010 [US1] Implement `POST /api/bookings/:id/price`: prebook, store `prebook_id`, final price, cancellation policy; `PUT /api/bookings/:id/guest` with field validation; `POST /api/bookings/:id/confirm` creating the PaymentIntent for the accepted price and returning `clientSecret`
- [X] T011 [US1] Implement `POST /api/bookings/:id/complete`: retrieve the PaymentIntent server-side, require `succeeded` and matching amount/currency/metadata, then book with the hotel provider; on `CONFIRMED` store `provider_booking_id`, `provider_status`, `hotel_confirmation_code`, set `confirmed`, set the trip status `booked`, send the email (T016)
- [X] T012 [US1] Implement the tools `check_hotel_availability` (read-only, `chatCallable: true`) and `create_hotel_booking` (`chatCallable: false`, called only from `complete`) and register both (Updated 2026-10-13: both live in `api/src/tools/bookingTools.ts`, not in separate files)
- [X] T013 [US1] Build `web/src/pages/booking/BookingPage.tsx` per UI-SPEC 2.7 and frames 1i-1n: stepper (`BookingStepper`) arriving with **Select room** complete and step content beneath, no skipping ahead
- [X] T014 [P] [US1] Build the step components in `web/src/pages/booking/steps/`: `Verify.tsx` (loading, then available or an `over-budget` styled alert with **Back to hotel details**), `PriceTerms.tsx` (breakdown + Confirmed badge + full cancellation text + **Accept and continue**), `Guest.tsx` (name, email, phone, optional requests), `Confirm.tsx` (review card + **Confirm and pay**)
- [X] T015 [US1] (Payment Element mounts and Stripe.js loads; entering a card in Stripe's iframe was not possible in the in-app browser, so card payment was tested server-side with Stripe test payment methods) Build `steps/Pay.tsx` and the Stripe loader (`getStripe()` in `web/src/lib/booking.ts`; Updated 2026-10-13: there is no `lib/stripe.ts`): load Stripe.js on this page only with the key from `/api/config/public`, mount the Payment Element (Faro adds no card inputs), `confirmPayment({ redirect: 'if_required' })`, then call `/complete` and move to `Confirmation.tsx`
- [X] T016 [US1] (Gmail delivery verified with the updated app password; spaces in the password are stripped) Implement `api/src/bookings/confirmationEmail.ts` (send via `NotificationProvider`, record `sent|failed|not_configured` in `confirmation_messages`, never roll back the booking) and build `steps/Confirmation.tsx` (reference, hotel, dates, final price, email status note, **View in My trips**, **Resend email**)

---

## Phase 4: User Story 2 - Failures are explicit and safe (Priority: P1)

**Goal**: price change, room unavailable, payment failure, provider timeout, paid-but-failed.

**Independent Test**: trigger each failure; each shows its message, correct state and only the correct next actions.

- [X] T017 [US2] Handle price change in `verify`/`price`: return 409 `price_changed` (`oldPrice`, `newPrice`) or `terms_changed`; implement `POST /api/bookings/:id/accept-price` (must equal the latest quote) and block `confirm` until accepted
- [X] T018 [US2] Handle room unavailable (empty rates, LiteAPI 4012/4040): booking becomes `failed` with no payment intent and 409 `room_unavailable`
- [X] T019 [US2] Handle payment failure in `complete`: 402 `payment_failed` with a safe reason, `payment_attempts.status='failed'`, booking returns to the `pay` step allowing a retry
- [X] T020 [US2] Handle provider timeout on `book` (`BOOK_TIMEOUT_MS`): set `pending`, mark the attempt `awaiting_return`, return `pending` to the client
- [X] T021 [US2] Implement reconcile (Updated 2026-10-13: `reconcileOne`/`reconcileAll` in `api/src/bookings/service.ts`, not a separate `reconcile.ts`): every minute and on `GET /api/bookings/:id` for pending bookings look up by `clientReference`; found confirmed -> `confirmed` + email; cancelled or not found after 15 minutes -> refund and `failed`; also scan `payment_attempts` stuck in `awaiting_return`; start the node-cron timer from `api/src/index.ts`
- [X] T022 [US2] Handle paid-but-failed: when the intent succeeded and the provider refuses, refund via `PaymentProvider.refund`, set `failed` with `refund_id` (or `refund_pending=true` and retry in reconcile)
- [X] T023 [US2] Add the inline alerts to the step components in `web/src/pages/booking/steps/`: `danger` style for price change (old/new price, **Accept new price** / Back), payment failure (**Try again**), timeout ("Pending confirmation", auto-refresh every few seconds), paid-but-refunded message

---

## Phase 5: User Story 3 - Prevent duplicate bookings (Priority: P1)

**Goal**: exactly one booking and one charge.

**Independent Test**: double-submit confirm/pay, reload during payment, two tabs: one booking row and one PaymentIntent.

- [X] T024 [US3] Verify and finish the layers from research R7: partial unique index (T001), row locks in `machine.ts`, Stripe idempotency keys derived from the booking id, `clientReference` = booking id (treat 4005 as "look it up"), and return the existing booking when a duplicate start is requested
- [X] T025 [US3] Disable action buttons while a request is in flight in every step component and ignore repeated clicks in `web/src/pages/booking/BookingPage.tsx`

---

## Phase 6: User Story 4 - Confirmation and resend (Priority: P2)

**Goal**: resend the same confirmation on request.

**Independent Test**: resend after confirming; identical details arrive; refused for failed/pending bookings.

- [X] T026 [US4] Implement `POST /api/bookings/:id/resend` in `api/src/routes/bookings.ts` (409 unless confirmed) and wire the **Resend email** button with a success/failure message
- [X] T027 [US4] Show "email not sent" with **Resend email** on the confirmation step when `email.status` is `failed` or `not_configured`

---

## Phase 7: Polish

- [X] T028 [P] Verify no card data reaches the Faro API (network inspector) and that logs contain no card data or Stripe secrets
- [X] T029 [P] Verify the start-up guard: a non-test Stripe key makes the API refuse to start naming the variable
- [X] T030 Run every step of `specs/007-booking-confirmation/quickstart.md` (all 14 steps) and fix failures
- [X] T031 [P] Run `scripts/check-tokens.sh` and compare the booking screens with frames 1i-1n and M6

---

## Phase 8: Multi-room and flights (added 2026-10-13)

- [X] T032 [US1] Multi-room hotel booking: add `bookings.rooms` (`db/init.sql`), accept `rooms` (1-10) and `roomName` in `POST /api/trips/:tripId/bookings`, send one `guests` entry per room to the provider `book`, carry `rooms` (and the per-room types in `room_name`) through `BookingPage.tsx`, the price step and `Confirmation.tsx`
- [X] T033 [US1] Short Stripe `return_url` (`/trip/:tripId/book/:hotelId?booking=<id>`) in `steps/Pay.tsx`; `BookingPage.tsx` resumes from `payment_intent` and `booking`
- [X] T034 Flights (constitution 3.5.0): `flight_bookings` and `trip_transport.provider_ref` in `db/init.sql`; `FlightProvider` + `DuffelFlightProvider` (test token only, balance payment); `api/src/flights/bookings.ts` (`checkFlight`, `bookFlight`, `getFlightBooking`, `resendFlightEmail`); `api/src/routes/flightBookings.ts`; `sendFlightConfirmation` in `GmailNotificationProvider`
- [X] T035 Flight rules: age bands on the flight day (infant under 2, child 2-11, adult 12+) with a message naming the traveler and range; each infant needs an adult (`infant_needs_adult`); the live price must equal the accepted price; one confirmed flight per trip
- [X] T036 `web/src/pages/search/FlightBookingModal.tsx` and `web/src/lib/flightBooking.ts`: check step first (live price, terms, changed-price notice), per-traveler form with the age-band hint, booked card with reference, **Resend email**, "email not sent" state
- [X] T037 Trip deletion rules (`deleteTrip` in `api/src/trips/service.ts`): refuse with 409 `has_booking` when the trip has a confirmed or pending hotel booking (or a refund pending) or a confirmed flight

---

## Dependencies & Execution Order

- Phase 1 -> Phase 2 -> Phase 3 (MVP) -> Phase 4 and Phase 5 (both build on Phase 3) -> Phase 6 -> Phase 7.
- T003/T004 before T010; T006 before T009-T011; T007 before T008-T011; T016 needs T005; T021 needs T006 `getBooking`; T032-T037 come after T011 and plan 005's Transport tab.
- Plan 006's selected-hotel dot and plan 008's statuses read `bookings` (T001).

## Parallel Opportunities

T002; T003, T005; T014 with T009-T011; T028, T029, T031.

## Implementation Strategy

MVP = Phases 1-3 (happy-path booking). Failure handling and duplicate prevention (Phases 4-5) are part of the required behaviour and should follow immediately; resend (Phase 6) last.
