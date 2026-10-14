# Implementation Plan: Booking and Confirmation Flow

**Branch**: `007-booking-confirmation` | **Date**: 2026-10-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-booking-confirmation/spec.md`. Shared stack: [plan 001](../001-app-shell-navigation/plan.md); auth guard: [plan 002](../002-authentication-sessions/plan.md); hotel provider interface: [plan 005](../005-hotel-transport-comparison/plan.md).

## Summary

The booking screen `/trip/:tripId/book/:hotelId` (stepper + step content) and the booking engine behind it: live availability re-check, LiteAPI **prebook** (final price and cancellation terms), guest details, **Stripe test-mode** payment through the embedded Payment Element, LiteAPI **book** only after payment succeeded, booking reference storage, a confirmation email through **Gmail**, and explicit handling of price change, room gone, payment failure, provider timeout (pending), duplicate prevention and automatic refund if payment succeeded but the booking failed. Adds `StripePaymentProvider`, `GmailNotificationProvider` and the tools `check_hotel_availability` and `create_hotel_booking`.

> Updated 2026-10-13: the booking covers one or more rooms (`bookings.rooms`; the room types chosen per room on the hotel page). Test-mode **flight booking** was added (constitution 3.5.0): a separate, simpler flow (check, traveler details, book, email) with no Stripe; the order is paid from the Duffel test balance. Tables `flight_bookings`; routes in `api/src/routes/flightBookings.ts`; logic in `api/src/flights/bookings.ts`; provider `api/src/providers/flights/{FlightProvider,DuffelFlightProvider}.ts`; UI `web/src/pages/search/FlightBookingModal.tsx`.

## Technical Context

**Language/Version**: TypeScript 5, Node 20, React 18

**Primary Dependencies**: `stripe` (Node SDK, server), `@stripe/stripe-js` + `@stripe/react-stripe-js` (web, Payment Element), `nodemailer` (Gmail SMTP), `fetch` for LiteAPI

**Storage**: PostgreSQL: `bookings`, `payment_attempts`, `confirmation_messages`, `flight_bookings` (Updated 2026-10-13); `trip_transport.provider_ref` holds the Duffel offer id of a bookable flight

**Testing**: None; manual quickstart with Stripe test cards and forced failures

**Target Platform**: Podman compose; Stripe.js loads from `js.stripe.com` on this page only

**Project Type**: Web application

**Performance Goals**: Verify step under 5s; booking completion (payment confirmed → provider booked → page updated) under 15s

**Constraints**: Never report confirmed before LiteAPI confirms; sandbox/test mode only (API refuses to start with non-test Stripe keys; LiteAPI rows flagged `sandbox: true`); card data never touches Faro; exactly one booking and one charge per intent; amounts exact to the cent (decimal strings, integer minor units for Stripe via string math)

**Scale/Scope**: One hotel per booking, one to ten rooms (Updated 2026-10-13; was one room); one confirmed flight per trip

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| I Simplicity | Pass | A small state machine in one file; direct SQL with `SELECT … FOR UPDATE`; no saga/queue library. |
| II Multi-user | Pass | All booking endpoints require a session and filter by `user_id`; bookings never visible to others. |
| III Agent discipline | Pass | `create_hotel_booking` is not chat-callable; a booking is only created from the UI's explicit Confirm and pay. The model cannot invent a confirmation. |
| IV Provider abstraction | Pass | `PaymentProvider` (Stripe test mode) and `NotificationProvider` (Gmail) interfaces plus the existing `HotelProvider`; routes/agent/UI use only the interfaces. |
| V Money | Pass | `NUMERIC(14,2)`; Stripe minor-unit conversion done with string arithmetic and a currency-exponent table, never floats. |
| VI Certainty | Pass | Availability, final price and booking status carry certainty; pending is shown as "Pending confirmation", never Confirmed. |
| VII Design fidelity | Pass | Stepper and steps per UI-SPEC §2.7 with design `BookingStepper`, `Modal`, `Input`, `Button`. |
| VIII No silent failure | Pass | Each failure mode has its own visible message and next action. |

## Project Structure

### Documentation (this feature)

```text
specs/007-booking-confirmation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── booking-api.md
    └── providers.md
```

### Source Code

```text
api/src/providers/payments/{PaymentProvider.ts,StripePaymentProvider.ts,minorUnits.ts}
api/src/providers/notifications/{NotificationProvider.ts,GmailNotificationProvider.ts}
api/src/bookings/{machine.ts,service.ts,confirmationEmail.ts}   # reconcile (reconcileOne/reconcileAll) lives in service.ts; there is no reconcile.ts (Updated 2026-10-13)
api/src/tools/bookingTools.ts        # check_hotel_availability and create_hotel_booking
api/src/routes/bookings.ts
api/src/routes/flightBookings.ts, api/src/flights/bookings.ts, api/src/providers/flights/{FlightProvider,DuffelFlightProvider}.ts
web/src/pages/booking/{BookingPage.tsx,steps/{Verify,PriceTerms,Guest,Confirm,Pay,Confirmation,Alert}.tsx}
web/src/pages/search/FlightBookingModal.tsx, web/src/lib/{booking.ts,flightBooking.ts}   # Stripe.js is loaded by getStripe() in lib/booking.ts (no lib/stripe.ts)
```

**Structure Decision**: The booking state machine lives in `bookings/machine.ts` so every transition (and its allowed predecessors) is in one place.

## Reconciliations With Other Documents

- **UI-SPEC §2.7** step content is followed: Verify (loading, then available or an `over-budget`-styled not-available alert with a button back to hotel details), Price & terms (breakdown with a `confirmed` badge + full cancellation text), Guest details (name, email, phone, optional requests), Confirm (review card + **Confirm and pay**), Pay (provider's embedded fields), Confirmation (reference, hotel, dates, final price, email note, **View in My trips**, **Resend email**).
- **Spec order** "confirm, pay, receive provider confirmation": the sequence is prebook → pay → book, so a booking is only made after funds are secured; the failure path refunds.
- **Email**: constitution v3.0.0 names Gmail. Gmail needs a Google account with 2-step verification and an **app password** (`GMAIL_USER`, `GMAIL_APP_PASSWORD`); if unset the confirmation page says "email not sent" and resend works once configured.
- **Return URL** (Updated 2026-10-13): the Pay step passes a short `return_url` (`/trip/:tripId/book/:hotelId?booking=<id>`); Stripe appends `payment_intent` when it returns the browser, and the page resumes `complete` from it.
- **Stripe docs now steer new integrations to Checkout Sessions in Elements mode**; PaymentIntents + Payment Element remain supported and are used here as the brief requires. Stripe also recommends webhooks for fulfilment; this build instead retrieves the PaymentIntent server-side after the browser returns (no Stripe CLI or public URL needed). Flagged as a trade-off: a payment completed but never returned to the browser is caught by the reconciler (research R6).
- **LiteAPI payment**: sandbox booking uses payment method `ACC_CREDIT_CARD` (no real charge); Stripe payment is taken separately by Faro. This coupling is a demo arrangement (LiteAPI's own Stripe/Payment-SDK flow is unverified in sandbox).

## Complexity Tracking

| Item | Why needed | Simpler alternative rejected because |
|---|---|---|
| Reconcile job (`reconcileAll` in `bookings/service.ts`, node-cron every minute from `index.ts`) | Provider timeouts leave a paid, unconfirmed booking | Ignoring it would break "never report confirmed until provider confirms" or leave users charged for nothing |
