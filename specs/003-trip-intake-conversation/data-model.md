# Data Model: Trip Intake and Conversation

## Entities

- **Trip**: one trip brief plus status. Owned by a user (anonymous drafts are no longer created: login comes first).

*Updated 2026-10-13*: the destination is split into `dest_city` and `dest_country_name` (the free-text `destination` is "City, Country", or just the country), and the start place into `origin_city` and `origin_country_name`. The DDL below matches `db/init.sql`.
- **Conversation message**: one message in a trip's chat (traveler or agent), with optional structured results (cards) carrying provenance.

## Relationships and rules

- `trips.user_id → users.id` (nullable until claimed). `CHECK (user_id IS NOT NULL OR anon_key_hash IS NOT NULL)`.
- `conversation_messages.trip_id → trips.id` (cascade delete); ordered by `created_at`, `id`.
- Brief validation: `adults ≥ 1` (at most 20), `children_ages` values 0–17 (at most 10 children; 0 is a baby under 1; negatives refused), `start_date ≥ today` when set, `end_date ≥ start_date`, `budget_amount > 0` (decimal, at most 2 places; zero and negatives refused in form and chat), ISO 4217 code shape for `budget_currency`. A city requires its country (destination and start place), else 400 with a field message. Setting a city or country builds `destination` and clears `recommend_requested`.
- Minimum set (`missingMinimum`, Updated 2026-10-13): destination (`destinationOrRecommend`), start and end dates (`datesOrDuration`), adults (`travelers`), budget, transport preference and accommodation preference.
- `duration_days` is stored when given; if both dates and duration exist they must agree (otherwise the patch is rejected with a conflict message).
- Money: `budget_amount NUMERIC(14,2)` with `budget_currency`, `budget_source = 'user'`, `budget_certainty = 'confirmed'`.
- Every trip read/write query filters by `user_id = $1` (signed in). (The `anon_key_hash = $1` branch for drafts is dormant: login comes first.)

## State transitions

Trip `status`: `draft` (no longer produced) → `saved` (created while signed in) → `booked` (a hotel booking confirmed, set by plan 007). A trip never goes back to `draft`.

## DDL fragment (003)

```sql
CREATE TABLE trips (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID REFERENCES users(id) ON DELETE CASCADE,
  anon_key_hash        TEXT,
  status               TEXT NOT NULL DEFAULT 'saved' CHECK (status IN ('draft','saved','booked')),
  title                TEXT,
  destination          TEXT,
  dest_city            TEXT,                   -- added; city part of the destination
  dest_country_name    TEXT,                   -- added; country part, as a name
  origin_city          TEXT,                   -- added; where the journey starts (optional)
  origin_country_name  TEXT,                   -- added
  destination_country  CHAR(2),
  destination_lat      DOUBLE PRECISION,
  destination_lon      DOUBLE PRECISION,
  recommend_requested  BOOLEAN NOT NULL DEFAULT false,
  start_date           DATE,
  end_date             DATE,
  date_window_text     TEXT,
  duration_days        INTEGER CHECK (duration_days > 0),
  adults               INTEGER CHECK (adults >= 1),
  children_ages        INTEGER[] NOT NULL DEFAULT '{}',
  budget_amount        NUMERIC(14,2) CHECK (budget_amount > 0),
  budget_currency      CHAR(3),
  budget_source        TEXT NOT NULL DEFAULT 'user',
  budget_certainty     TEXT NOT NULL DEFAULT 'confirmed'
                       CHECK (budget_certainty IN ('confirmed','estimated','unavailable')),
  transport_preference TEXT,
  accommodation_preference TEXT,
  interests            TEXT,
  special_requirements TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR anon_key_hash IS NOT NULL)
);
CREATE INDEX trips_user_idx ON trips (user_id, updated_at DESC);
CREATE UNIQUE INDEX trips_anon_key_unique ON trips (anon_key_hash) WHERE anon_key_hash IS NOT NULL;

CREATE TABLE conversation_messages (
  id         BIGSERIAL PRIMARY KEY,
  trip_id    UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user','agent')),
  content    TEXT NOT NULL,
  cards      JSONB,                      -- structured results with provenance, rendered beneath the bubble
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX conversation_messages_trip_idx ON conversation_messages (trip_id, id);
```
