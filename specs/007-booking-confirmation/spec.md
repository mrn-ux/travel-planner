# Feature Specification: Booking and Confirmation Flow

> Amended 2026-10-13 (implementation sync): Hotels: several rooms, each with its own room type, can be booked in one booking (a rooms count is stored with the booking); the Pay step uses a short return URL. Flights: before any traveler detail is asked, the airline's rules are checked: each child under 2 needs an adult of their own in the same booking, and each traveler's date of birth must put them in the right age band (under 2, 2 to 11, 12 and over) on the flight day. The form shows the band for each traveler; the API gives a clear message naming the traveler and the accepted date range.

> Amended 2026-10-13 (constitution 3.5.0): flight booking was added in test mode: the Transport tab's chosen Duffel flight is looked up again, the accepted price must still be the live price, every traveler is named, and the booking is confirmed only when the airline service confirms. One confirmed flight per trip (duplicate refused). Hotels are unchanged; trains and buses are never booked.

**Feature Branch**: `007-booking-confirmation`

**Created**: 2026-10-10

**Status**: Draft

**Input**: User description: "Hotel booking only, through the hotel provider (sandbox), following this exact sequence: select hotel and room, re-check availability, show the final price and cancellation terms, collect guest details, confirm, pay through the payment provider (test mode), receive the provider's confirmation, store the booking reference, and notify the user. A booking is never reported as confirmed until the hotel provider confirms it. Handle a price change, a room going unavailable, a payment failure, a provider timeout, and duplicate-booking prevention. Once confirmed, a confirmation can be resent on request. Booking shows a step indicator ending in a confirmation screen with the booking reference."

## Goal

Let a signed-in traveler book the hotel room they chose through a clear, step-by-step flow that never claims a booking before the provider confirms it and handles every failure explicitly.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Complete a booking (Priority: P1)

From the hotel details page the traveler continues to booking, which shows a step indicator — select room, verify availability, price and terms, guest details, confirm, pay, confirmation — with the current step's content below it. They move through each step in order and finish on a confirmation screen showing the booking reference.

**Why this priority**: It is the product's only transaction.

**Independent Test**: Book a room end to end in sandbox and test mode; confirm each step appears in order, only advances when valid, and the final screen shows reference, hotel, dates and final price.

**Acceptance Scenarios**:

1. **Given** a signed-in traveler with a picked room, **When** they open booking, **Then** the step indicator and the first step are shown with the chosen hotel and room.
2. **Given** the verify step, **When** it runs, **Then** availability is re-checked with the hotel provider and the result is shown with a certainty label before moving on.
3. **Given** the price and terms step, **When** shown, **Then** the final price breakdown and the cancellation terms are displayed and must be acknowledged to continue.
4. **Given** the guest details step, **When** the traveler enters valid details, **Then** they can continue; invalid or missing details show field-level messages.
5. **Given** the confirm step, **When** the traveler confirms, **Then** the flow moves to payment with the amount shown.
6. **Given** payment succeeds and the provider confirms, **When** complete, **Then** the booking reference is stored, the confirmation screen is shown and the traveler is notified.
7. **Given** any step, **When** the traveler tries to jump ahead of an unverified step, **Then** they cannot.

---

### User Story 2 - Failures are explicit and safe (Priority: P1)

If the price changes, the room becomes unavailable, payment fails, or the provider times out, the traveler sees what happened and their options; a booking is never shown as confirmed unless the provider confirmed it, and money is never taken twice.

**Why this priority**: Money and trust depend on correct failure handling.

**Independent Test**: Trigger each failure in sandbox and test mode; confirm each shows its dedicated message, leaves the booking in the right state and allows only the correct next actions.

**Acceptance Scenarios**:

1. **Given** the price differs at re-check or before payment, **When** detected, **Then** the old and new final prices are shown with labels and the traveler must accept the new price or cancel before continuing.
2. **Given** the room is no longer available, **When** detected, **Then** the traveler is told, the flow stops, and they are offered a return to the room list or other hotels.
3. **Given** payment fails, **When** reported, **Then** a message explains it, no booking is reported as confirmed, and the traveler can retry or change method.
4. **Given** the provider does not respond in time, **When** the wait ends, **Then** the booking is shown as "pending confirmation" with an explanation, not as confirmed, and retrying cannot create a second booking.
5. **Given** a pending booking is later resolved, **When** the provider's answer is known, **Then** the status becomes confirmed or failed and the traveler is told.

---

### User Story 3 - Prevent duplicate bookings (Priority: P1)

Double-clicks, repeated submissions, page reloads and retries never produce two bookings for the same traveler, hotel, room and dates.

**Why this priority**: A duplicate booking costs the traveler real money.

**Independent Test**: Submit the confirm or pay step twice rapidly and reload during payment; confirm exactly one booking and at most one charge exist.

**Acceptance Scenarios**:

1. **Given** the traveler submits confirm or pay twice, **When** processed, **Then** only one booking and one charge result.
2. **Given** a confirmed booking exists for the same hotel, room and dates, **When** the traveler tries to book it again, **Then** they are told and shown the existing booking instead.

---

### User Story 4 - Confirmation and resend (Priority: P2)

Once confirmed, a confirmation (booking reference, hotel, dates, final price) is generated, sent to the traveler, and can be resent on request.

**Why this priority**: Reassures the traveler but follows the booking itself.

**Independent Test**: Confirm a booking, request a resend, and check the same details arrive again.

**Acceptance Scenarios**:

1. **Given** a confirmed booking, **When** the confirmation screen is shown, **Then** it displays the booking reference, hotel, dates and final price.
2. **Given** a confirmed booking, **When** the traveler requests a resend, **Then** the confirmation is sent again with identical details and the traveler is told it was sent.
3. **Given** a failed or pending booking, **When** a resend is requested, **Then** it is refused with an explanation.

### Edge Cases

- A signed-out visitor reaching booking is sent to login and returns to the same step afterwards (every screen works this way: login first).
- Session expires mid-flow: the traveler is sent to login and returns to the same step with entered details kept.
- Browser back/forward and reload at any step keep the flow consistent and never re-submit payment.
- Traveler leaves and returns later: an unfinished booking can be resumed or restarted with a fresh availability check.
- Guest count above the room's capacity is refused with a message.
- Dates in the past or less than the minimum stay are refused.
- Payment details are never stored by the product beyond what the payment provider returns, and never shown in full or logged.
- Cancellation terms with a free-cancellation deadline show that deadline as a date.
- Amounts are shown in the booking currency and exact to the cent.

## Empty, Loading and Error States

- **Loading**: each step shows progress while it works (availability check, payment, confirmation) and disables its action to prevent resubmission.
- **Empty**: opening booking with no room picked sends the traveler back to hotel details with a message.
- **Error**: price change, unavailability, payment failure and provider timeout each have their own message and next actions as described above; unexpected failures show a generic message and keep the booking unconfirmed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Booking MUST require a signed-in session.
- **FR-002**: The booking flow MUST follow this order with a step indicator: select hotel and room, verify availability, price and terms, guest details, confirm, pay, confirmation.
- **FR-003**: The flow MUST NOT allow skipping ahead of an unverified step.
- **FR-004**: Availability MUST be re-checked with the hotel provider at the verify step and the result labelled Confirmed, Estimated or Unavailable.
- **FR-005**: The final price and cancellation terms MUST be shown and acknowledged before guest details are collected.
- **FR-006**: Payment MUST be taken only through the payment provider interface.
- **FR-007**: A booking MUST NOT be reported as confirmed until the hotel provider confirms it.
- **FR-008**: On provider confirmation the booking reference MUST be stored against the traveler's account and the traveler MUST be notified.
- **FR-009**: A price change MUST be surfaced with old and new amounts and require explicit acceptance.
- **FR-010**: A room becoming unavailable MUST stop the flow with a message and alternatives.
- **FR-011**: A payment failure MUST be shown and MUST NOT result in a confirmed booking.
- **FR-012**: A provider timeout MUST result in a "pending confirmation" state, never "confirmed", and MUST be resolvable to confirmed or failed.
- **FR-013**: The system MUST prevent duplicate bookings from repeated submissions, reloads or retries.
- **FR-014**: A confirmed booking MUST generate a confirmation containing booking reference, hotel, dates and final price, and MUST allow it to be resent on request.
- **FR-015**: Only hotel bookings MUST be supported; flights, trains and buses MUST NOT be bookable.
- **FR-016**: Each booking MUST belong to exactly one account and be visible only to it.
- **FR-017**: All booking amounts MUST be exact to the cent.

### Key Entities

- **Booking**: A traveler's reservation of one room at one hotel for dates, with status (in progress, pending confirmation, confirmed, failed), final price and booking reference.
- **Guest details**: Names and contact information for the stay.
- **Payment attempt**: One try to pay for a booking with its outcome.
- **Confirmation**: The record sent to the traveler with reference, hotel, dates and final price.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A signed-in traveler completes a booking in under 3 minutes with no failures.
- **SC-002**: 0 bookings are reported as confirmed without provider confirmation across all failure tests.
- **SC-003**: Every one of the four failure modes shows its specific message and a correct next action in 100% of test runs.
- **SC-004**: Repeated submissions of confirm or pay produce exactly one booking and one charge in 100% of test runs.
- **SC-005**: 100% of confirmations contain booking reference, hotel, dates and final price, and resend delivers identical details.

## Non-Goals

- No flight, train or bus booking.
- No real payment integration; only the payment provider in test mode.
- No booking modification, cancellation or refunds after confirmation.
- No notification beyond the booking-confirmation message (no push notifications, reminders or marketing).
- No hotel browsing, comparison or room picking (comparison feature) and no login or sign-up screens (authentication feature).
- No listing of past bookings (my trips feature).

## Assumptions

- The confirmation message is emailed to the address on the traveler's account through Gmail and is also shown on the confirmation screen. If email cannot be sent (not configured or failing), the booking still stands, the screen says "email not sent", and the traveler can resend.
- A pending booking is resolved by the hotel provider within a short window and the traveler can check its status.
- Payment uses the payment provider's embedded payment fields in test mode; only test cards work and Faro never handles card data.
- One room per booking in this build.
