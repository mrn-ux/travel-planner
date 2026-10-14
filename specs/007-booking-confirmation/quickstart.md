# Quickstart: Booking and Confirmation Flow

Prerequisites: plans 001–006 running; `LITEAPI_API_KEY` (sandbox), `STRIPE_SECRET_KEY` (`sk_test_…`), `STRIPE_PUBLISHABLE_KEY` (`pk_test_…`); optionally `GMAIL_USER` and `GMAIL_APP_PASSWORD`; a signed-in account; a hotel with a selected room; for flights, `DUFFEL_ACCESS_TOKEN` (a Duffel test token) and a Duffel flight chosen in the Transport tab.

## Validate
1. **Start-up guard**: set `STRIPE_SECRET_KEY` to a value not starting `sk_test_`; the API refuses to start naming the variable. Restore it.
2. **Auth guard**: signed out, open a booking URL → `/login`; after sign-in you return to the booking route.
3. **Happy path**: Verify shows loading then "available"; Price & terms shows the breakdown with a Confirmed badge and the full cancellation text; fill Guest details; **Confirm and pay**; pay with `4242 4242 4242 4242`; Confirmation shows the booking reference, hotel, dates and final price (`USD …`), and `status = 'confirmed'` in the database with `provider_booking_id` set. A Stripe test-mode PaymentIntent exists and `payment_attempts.status = 'succeeded'`.
4. **Email**: with Gmail configured the confirmation email arrives with reference, hotel, dates, price and the sandbox line; **Resend email** sends it again. With Gmail unset the page says "email not sent", the booking stands, and `confirmation_messages.status = 'not_configured'`.
5. **Price change**: simulate (reduce the stored `shown_price` before Price & terms, or use a rate that changes between calls); a danger alert shows old and new prices; **Confirm and pay** stays disabled until **Accept new price**.
6. **Room unavailable**: use an expired/invalid `offerId`; Verify shows the `over-budget`-styled alert and **Back to hotel**; no payment intent exists.
7. **Payment failure**: pay with `4000 0000 0000 0002`; the Pay step shows the decline with Try again; the booking is not confirmed and no `confirmed` status exists.
8. **3-D Secure**: `4000 0027 6000 3184` completes after the challenge; `4000 0084 0000 1629` ends declined.
9. **Provider timeout**: set the book timeout low or block the booking host after payment; the page shows "Pending confirmation" (never Confirmed); unblock; within a minute the reconciler moves it to confirmed and sends the email (or, if the provider has no booking after the cut-off, refunds and marks failed).
10. **Paid but failed**: force the provider to refuse after payment; the booking becomes `failed`, the PaymentIntent shows a refund, and the message says so.
11. **Duplicates**: double-click **Confirm and pay**, reload during payment, and open the booking route in two tabs; exactly one booking row and one PaymentIntent exist; starting the same room/dates again returns the existing booking.
12. **No skipping**: call `POST /api/bookings/<id>/confirm` before `price`; it returns 409.
13. **Isolation**: a second account requesting `GET /api/bookings/<id>` gets 404.
14. **Card data**: network inspector shows card fields posted only to Stripe, never to the Faro API; Faro logs contain no card data.

### Added 2026-10-13
15. **Several rooms**: on the hotel page set Rooms to 2 and pick a type for each room; the booking route carries `rooms=2`; the Confirmation lists Rooms: 2 and one total; `bookings.rooms = 2`.
16. **Return URL**: after paying, the browser lands on `/trip/<tripId>/book/<hotelId>?booking=<id>&payment_intent=...` and the page finishes `complete` without a second charge.
17. **Flight check**: on the Transport tab choose a Duffel flight and **Book flight**; the modal first looks the offer up again and shows the live price and terms (a changed price is shown before any detail is asked). A party with more children under 2 than adults is refused with a message about needing one adult for each child under 2.
18. **Age bands**: the form shows "Must be under 2 / 2 to 11 / 12 or over on the flight day" per traveler; a date of birth outside the band is refused (400) naming the traveler and the accepted range.
19. **Flight booking**: fill every traveler and book; the reference appears only after the airline test service confirms; the order is paid from the Duffel test balance; `flight_bookings.status = 'confirmed'`. Booking again for the same trip is refused (409 `duplicate`). With Gmail unset the card says "email not sent" and **Resend email** (`POST /api/trips/:id/flight-booking/resend`) works once configured.
20. **Delete rules**: `DELETE /api/trips/<id>` for a trip with a confirmed or pending hotel booking, or a confirmed flight, returns 409 `has_booking`; a planned trip without bookings is deleted.
