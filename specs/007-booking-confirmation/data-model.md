# Data Model: Booking and Confirmation Flow

## Entities

- **Booking**: one traveler's reservation attempt/outcome for one or more rooms at one hotel and dates (Updated 2026-10-13: was one room; `rooms` holds the count and `room_name` the chosen room type(s)).
- **Payment attempt**: one Stripe PaymentIntent (or retry) for a booking.
- **Confirmation message**: one attempt to send the confirmation email for a confirmed booking.
- **Flight booking** (Updated 2026-10-13): a flight booked in Duffel test mode for a trip; table `flight_bookings`. One confirmed flight per trip (partial unique index `flight_bookings_one_confirmed` on `trip_id` where `status = 'confirmed'`). Only `confirmed` rows are written today (`failed` is allowed by the CHECK but a failed order stores nothing). Travelers are stored as JSON (name, date of birth, gender, email; the phone number is sent to the airline service but not stored). `email_status` is `sent`, `failed` or `not_configured`; the email is resent through `POST /api/trips/:id/flight-booking/resend`. The bookable offer id is kept in `trip_transport.provider_ref` when the chosen option is a Duffel flight.

## Relationships and rules

- `bookings.user_id → users.id` (not null; bookings exist only for signed-in users); `trip_id → trips(id)`.
- Duplicate prevention: partial unique index on `(user_id, provider_hotel_id, room_id, checkin, checkout)` where `status IN ('in_progress','pending','confirmed')`; `client_reference` is unique and is sent to the hotel provider.
- `final_price` is `NUMERIC(14,2)` in `currency`, with `price_source`, `price_certainty` and `sandbox = true` (constraint: always true in this build).
- A booking is `confirmed` only if `provider_booking_id IS NOT NULL` and `provider_status = 'CONFIRMED'` (CHECK).
- `step` is only meaningful while `in_progress`; steps can only advance in order, enforced by the service and by `step_order` monotonic check.
- `payment_attempts.stripe_payment_intent_id` unique; amount and currency must equal the booking's accepted price when `status = 'succeeded'`.
- A refund id is recorded when a payment is refunded; `failed` bookings with a succeeded payment must have `refund_id` set or `refund_pending = true`.
- Guest details and special requests are stored as JSON on the booking; no card data of any kind is stored.

## State transitions

```
in_progress(verify → price → guest → confirm → pay)
   ├─ payment succeeded + provider confirmed ─────────→ confirmed
   ├─ payment succeeded + provider timeout/unknown ───→ pending ─(reconcile)→ confirmed | failed(refund)
   ├─ payment succeeded + provider refused ───────────→ failed (refund)
   ├─ room gone / user abandons / payment never made ─→ failed (no charge)
   └─ price change → stays in_progress until accepted or abandoned
```
`confirmed` and `failed` are terminal.

## DDL fragment (007)

```sql
CREATE TABLE bookings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),   -- also the provider clientReference
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trip_id               UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  status                TEXT NOT NULL DEFAULT 'in_progress'
                        CHECK (status IN ('in_progress','pending','confirmed','failed')),
  step                  TEXT NOT NULL DEFAULT 'verify'
                        CHECK (step IN ('verify','price','guest','confirm','pay','done')),
  provider              TEXT NOT NULL,                       -- 'liteapi'
  provider_hotel_id     TEXT NOT NULL,
  hotel_name            TEXT NOT NULL,
  room_id               TEXT NOT NULL,
  room_name             TEXT NOT NULL,
  checkin               DATE NOT NULL,
  checkout              DATE NOT NULL CHECK (checkout > checkin),
  adults                INTEGER NOT NULL CHECK (adults >= 1),
  children_ages         INTEGER[] NOT NULL DEFAULT '{}',
  rooms                 SMALLINT NOT NULL DEFAULT 1,         -- Updated 2026-10-13: number of rooms booked (1-10, enforced by the API)
  offer_id              TEXT NOT NULL,
  prebook_id            TEXT,
  shown_price           NUMERIC(14,2) NOT NULL,              -- price displayed when the room was picked
  final_price           NUMERIC(14,2),                       -- accepted price after prebook
  currency              CHAR(3) NOT NULL,
  price_source          TEXT NOT NULL DEFAULT 'liteapi',
  price_certainty       TEXT NOT NULL DEFAULT 'confirmed'
                        CHECK (price_certainty IN ('confirmed','estimated','unavailable')),
  sandbox               BOOLEAN NOT NULL DEFAULT true CHECK (sandbox),
  price_change_accepted BOOLEAN NOT NULL DEFAULT false,
  cancellation          JSONB,                               -- policy text, refundable, free-until date
  guest                 JSONB,                               -- name, email, phone, special requests
  provider_booking_id   TEXT,
  provider_status       TEXT,
  hotel_confirmation_code TEXT,
  failure_reason        TEXT,
  refund_pending        BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at          TIMESTAMPTZ,
  CHECK (status <> 'confirmed' OR (provider_booking_id IS NOT NULL AND provider_status = 'CONFIRMED'))
);
CREATE UNIQUE INDEX bookings_no_duplicates
  ON bookings (user_id, provider_hotel_id, room_id, checkin, checkout)
  WHERE status IN ('in_progress','pending','confirmed');
CREATE INDEX bookings_user_idx ON bookings (user_id, created_at DESC);
CREATE INDEX bookings_trip_idx ON bookings (trip_id);

CREATE TABLE payment_attempts (
  id                       BIGSERIAL PRIMARY KEY,
  booking_id               UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT NOT NULL UNIQUE,
  amount                   NUMERIC(14,2) NOT NULL,
  currency                 CHAR(3) NOT NULL,
  status                   TEXT NOT NULL CHECK (status IN ('created','awaiting_return','succeeded','failed','refunded')),
  failure_code             TEXT,
  refund_id                TEXT,
  test_mode                BOOLEAN NOT NULL DEFAULT true CHECK (test_mode),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payment_attempts_booking_idx ON payment_attempts (booking_id);

CREATE TABLE confirmation_messages (
  id         BIGSERIAL PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  channel    TEXT NOT NULL DEFAULT 'email' CHECK (channel = 'email'),
  to_address TEXT NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('sent','failed','not_configured')),
  error      TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX confirmation_messages_booking_idx ON confirmation_messages (booking_id, attempted_at DESC);
```

### Added 2026-10-13: flights (constitution 3.5.0)

```sql
-- trip_transport gains (plan 005 table):
--   provider_ref TEXT   -- the provider's offer id, when the option can be booked (Duffel test flights)

CREATE TABLE flight_bookings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trip_id           UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  offer_id          TEXT NOT NULL,
  order_id          TEXT,
  booking_reference TEXT,
  airline           TEXT,
  origin            TEXT,
  destination       TEXT,
  departure_at      TIMESTAMPTZ,
  arrival_at        TIMESTAMPTZ,
  total             NUMERIC(14,2),
  currency          CHAR(3),
  passengers        JSONB NOT NULL,
  status            TEXT NOT NULL CHECK (status IN ('confirmed','failed')),
  failure_reason    TEXT,
  email_status      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX flight_bookings_one_confirmed ON flight_bookings (trip_id) WHERE status = 'confirmed';
```

Flight rules: a row is inserted only after the airline service confirms the order (`status = 'confirmed'`); two simultaneous requests are settled by the unique index (the second gets 409 `duplicate`). A trip with a confirmed `flight_bookings` row, or a hotel booking that is `confirmed`, `pending` or has `refund_pending`, cannot be deleted (see plan 008).
