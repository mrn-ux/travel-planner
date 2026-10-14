-- Faro schema. Postgres runs this file once, on first boot of an empty data volume
-- (to re-apply after a change: `podman compose down -v`). No seed data, no migrations.
-- Sections are appended in plan order: 001 -> 002 -> 003 -> 004 -> 005 -> 006 -> 007.
-- Conventions: money NUMERIC(14,2) with a currency CHAR(3), a source and a certainty
-- ('confirmed' | 'estimated' | 'unavailable'); ids UUID DEFAULT gen_random_uuid().

-- ===== 001: platform =====
CREATE EXTENSION IF NOT EXISTS vector;

-- Outbound-request cache used by api/src/http.ts (never used for rates, availability or bookings).
CREATE TABLE http_cache (
  cache_key   TEXT PRIMARY KEY,           -- sha256 of provider + method + url + body
  provider    TEXT NOT NULL,
  status      INTEGER NOT NULL,
  body        JSONB,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX http_cache_expires_idx ON http_cache (expires_at);

-- ===== 002: authentication and sessions =====
CREATE TABLE users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email              TEXT NOT NULL,
  name               TEXT NOT NULL DEFAULT '',
  preferred_currency CHAR(3) NOT NULL DEFAULT 'USD',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

CREATE TABLE auth_identities (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL CHECK (provider IN ('password','google')),
  provider_subject TEXT,                 -- null for password
  password_hash    TEXT,                 -- bcrypt, only for provider = 'password'
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((provider = 'password' AND password_hash IS NOT NULL AND provider_subject IS NULL)
      OR (provider <> 'password' AND provider_subject IS NOT NULL AND password_hash IS NULL))
);
CREATE UNIQUE INDEX auth_identity_subject_unique ON auth_identities (provider, provider_subject)
  WHERE provider_subject IS NOT NULL;
CREATE UNIQUE INDEX auth_identity_one_password ON auth_identities (user_id) WHERE provider = 'password';

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,           -- sha256 hex of the opaque token
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE login_attempts (
  id           BIGSERIAL PRIMARY KEY,
  email_lower  TEXT NOT NULL,
  ip           TEXT,
  success      BOOLEAN NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_email_idx ON login_attempts (email_lower, attempted_at);

CREATE TABLE oauth_states (
  state         TEXT PRIMARY KEY,
  provider      TEXT NOT NULL CHECK (provider = 'google'),
  nonce         TEXT NOT NULL,
  code_verifier TEXT,
  return_to     TEXT,
  trip_key      TEXT,
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,  -- set on one-time exchange rows (state = the code)
  expires_at    TIMESTAMPTZ NOT NULL
);

CREATE TABLE user_preferences (
  user_id               UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  preferred_currency    CHAR(3) NOT NULL DEFAULT 'USD',
  default_transport     TEXT,
  default_accommodation TEXT,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 003: trips and conversation =====
CREATE TABLE trips (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID REFERENCES users(id) ON DELETE CASCADE,
  anon_key_hash            TEXT,
  status                   TEXT NOT NULL DEFAULT 'saved' CHECK (status IN ('draft','saved','booked')),
  title                    TEXT,
  destination              TEXT,
  dest_city                TEXT,                  -- the city part of the destination, when one was given
  dest_country_name        TEXT,                  -- the country part, as a name
  origin_city              TEXT,                  -- where the journey starts: city (optional)
  origin_country_name      TEXT,                  -- and country
  destination_country      CHAR(2),
  destination_lat          DOUBLE PRECISION,
  destination_lon          DOUBLE PRECISION,
  recommend_requested      BOOLEAN NOT NULL DEFAULT false,
  start_date               DATE,
  end_date                 DATE,
  date_window_text         TEXT,
  duration_days            INTEGER CHECK (duration_days > 0),
  adults                   INTEGER CHECK (adults >= 1),
  children_ages            INTEGER[] NOT NULL DEFAULT '{}',
  budget_amount            NUMERIC(14,2) CHECK (budget_amount > 0),
  budget_currency          CHAR(3),
  budget_source            TEXT NOT NULL DEFAULT 'user',
  budget_certainty         TEXT NOT NULL DEFAULT 'confirmed'
                           CHECK (budget_certainty IN ('confirmed','estimated','unavailable')),
  transport_preference     TEXT,
  accommodation_preference TEXT,
  interests                TEXT,
  special_requirements     TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
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

-- ===== 004: knowledge base and recommendations =====
CREATE TABLE knowledge_chunks (
  id           BIGSERIAL PRIMARY KEY,
  source       TEXT NOT NULL,              -- wikivoyage, wikipedia, wikidata, open-meteo, govuk-fcdo, nager, overpass, frankfurter
  source_url   TEXT NOT NULL,
  licence      TEXT NOT NULL,
  attribution  TEXT NOT NULL,              -- shown with the chunk (CC BY-SA credit etc.)
  destination  TEXT NOT NULL,              -- normalised "Name, CC"
  title        TEXT NOT NULL,
  chunk_text   TEXT NOT NULL,
  content_hash CHAR(64) NOT NULL,
  embedding    vector(768) NOT NULL,
  fetched_at   TIMESTAMPTZ NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  UNIQUE (source, destination, content_hash)
);
CREATE INDEX knowledge_chunks_embedding_idx
  ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX knowledge_chunks_destination_idx ON knowledge_chunks (destination, source);
CREATE INDEX knowledge_chunks_expiry_idx ON knowledge_chunks (expires_at);

CREATE TABLE ingest_state (
  destination  TEXT NOT NULL,
  source       TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('pending','ok','failed')),
  last_attempt TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_ok      TIMESTAMPTZ,
  error        TEXT,
  PRIMARY KEY (destination, source)
);

CREATE TABLE trip_recommendations (
  id           BIGSERIAL PRIMARY KEY,
  trip_id      UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  rank         INTEGER NOT NULL CHECK (rank > 0),
  destination  TEXT NOT NULL,
  country_code CHAR(2),
  score        NUMERIC(5,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
  reasons      JSONB NOT NULL,
  completeness TEXT NOT NULL DEFAULT 'quick' CHECK (completeness IN ('quick','full')),
  previous_rank INTEGER,                   -- set when refinement moved the destination
  brief_hash   TEXT NOT NULL,              -- the ranking-relevant part of the brief this list was made for
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  refined_at   TIMESTAMPTZ,
  UNIQUE (trip_id, rank)
);

-- ===== 005: hotel and transport selections, geocoding cache =====
CREATE TABLE trip_places (
  trip_id       UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  place_id      TEXT NOT NULL,                 -- OpenStreetMap id, for example 'node/123'
  name          TEXT NOT NULL,
  kind          TEXT NOT NULL,
  lat           DOUBLE PRECISION NOT NULL,
  lon           DOUBLE PRECISION NOT NULL,
  opening_hours TEXT,                          -- as the map data states it, else NULL
  entry_kind    TEXT NOT NULL,                 -- 'free', 'paid' or 'unknown'
  charge        TEXT,
  selected_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (trip_id, place_id)
);

CREATE TABLE trip_hotels (
  trip_id           UUID PRIMARY KEY REFERENCES trips(id) ON DELETE CASCADE,
  provider          TEXT NOT NULL,                 -- 'liteapi'
  provider_hotel_id TEXT NOT NULL,
  name              TEXT NOT NULL,
  stars             NUMERIC(2,1),
  rating            NUMERIC(3,1),
  city              TEXT,
  latitude          DOUBLE PRECISION,
  longitude         DOUBLE PRECISION,
  photo_url         TEXT,
  room_name         TEXT,
  checkin           DATE NOT NULL,
  checkout          DATE NOT NULL CHECK (checkout > checkin),
  nightly_rate      NUMERIC(14,2),
  total_price       NUMERIC(14,2),
  currency          CHAR(3),
  price_source      TEXT NOT NULL,
  price_certainty   TEXT NOT NULL CHECK (price_certainty IN ('confirmed','estimated','unavailable')),
  sandbox           BOOLEAN NOT NULL DEFAULT true,
  source_url        TEXT,
  fetched_at        TIMESTAMPTZ NOT NULL,
  selected_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE trip_transport (
  trip_id          UUID PRIMARY KEY REFERENCES trips(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL,                  -- 'transitous'
  mode             TEXT NOT NULL,                  -- flight, train, bus, ferry, ...
  origin           TEXT NOT NULL,
  destination      TEXT NOT NULL,
  departure_at     TIMESTAMPTZ,
  arrival_at       TIMESTAMPTZ,
  duration_minutes INTEGER,
  transfers        INTEGER,
  operator         TEXT,
  price            NUMERIC(14,2),
  currency         CHAR(3),
  price_source     TEXT NOT NULL,                  -- 'transitous-fare' or 'faro-estimate'
  price_basis      TEXT,                           -- estimate assumptions shown to the traveler
  price_low        NUMERIC(14,2),
  price_high       NUMERIC(14,2),
  price_certainty  TEXT NOT NULL CHECK (price_certainty IN ('confirmed','estimated','unavailable')),
  schedule_certainty TEXT NOT NULL CHECK (schedule_certainty IN ('confirmed','estimated','unavailable')),
  source_url       TEXT,
  provider_ref     TEXT,                           -- the provider's offer id, when the option can be booked (Duffel test flights)
  fetched_at       TIMESTAMPTZ NOT NULL,
  selected_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A flight booked in the provider's test mode. One confirmed flight per trip: a second attempt is refused (duplicate prevention).
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

CREATE TABLE geocode_cache (
  query_key    TEXT PRIMARY KEY,
  latitude     DOUBLE PRECISION,
  longitude    DOUBLE PRECISION,
  display_name TEXT,
  bounding_box JSONB,
  found        BOOLEAN NOT NULL,
  source_url   TEXT NOT NULL,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 006: budget, exchange rates, itinerary =====
CREATE TABLE fx_rates (
  id         BIGSERIAL PRIMARY KEY,
  base       CHAR(3) NOT NULL,
  quote      CHAR(3) NOT NULL,
  rate_date  DATE NOT NULL,
  rate       NUMERIC(18,8) NOT NULL CHECK (rate > 0),   -- a rate, not money
  source     TEXT NOT NULL,
  source_url TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  UNIQUE (base, quote, rate_date, source)
);

CREATE TABLE budget_items (
  id           BIGSERIAL PRIMARY KEY,
  trip_id      UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  category     TEXT NOT NULL CHECK (category IN
                 ('hotels','transportation','activities','food','local_transport','miscellaneous')),
  label        TEXT NOT NULL,
  amount       NUMERIC(14,2),            -- original amount, NULL when unavailable
  currency     CHAR(3),
  amount_trip  NUMERIC(14,2),            -- in trip currency (via fx_rates when converted)
  fx_rate_id   BIGINT REFERENCES fx_rates(id),
  source       TEXT NOT NULL,
  source_url   TEXT,
  certainty    TEXT NOT NULL CHECK (certainty IN ('confirmed','estimated','unavailable')),
  fetched_at   TIMESTAMPTZ,
  ref_type     TEXT,                     -- 'hotel','transport','itinerary_item'
  ref_id       TEXT,
  CHECK (amount IS NULL OR currency IS NOT NULL)
);
CREATE INDEX budget_items_trip_idx ON budget_items (trip_id, category);

CREATE TABLE budget_proposals (
  id          BIGSERIAL PRIMARY KEY,
  trip_id     UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('lower_hotel_tier','train_instead_of_flight','fewer_paid_attractions','different_dates')),
  description TEXT NOT NULL,
  saving      NUMERIC(14,2) NOT NULL CHECK (saving > 0),
  currency    CHAR(3) NOT NULL,
  certainty   TEXT NOT NULL CHECK (certainty IN ('confirmed','estimated','unavailable')),
  payload     JSONB NOT NULL,
  status      TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','applied','dismissed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX budget_proposals_trip_idx ON budget_proposals (trip_id, status);

CREATE TABLE itinerary_days (
  id        BIGSERIAL PRIMARY KEY,
  trip_id   UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_no    INTEGER NOT NULL CHECK (day_no > 0),
  day_date  DATE NOT NULL,
  place     TEXT,
  note      TEXT,
  UNIQUE (trip_id, day_no)
);

CREATE TABLE itinerary_items (
  id                      BIGSERIAL PRIMARY KEY,
  day_id                  BIGINT NOT NULL REFERENCES itinerary_days(id) ON DELETE CASCADE,
  slot                    TEXT NOT NULL CHECK (slot IN ('morning','afternoon','evening')),
  position                INTEGER NOT NULL,
  kind                    TEXT NOT NULL CHECK (kind IN ('activity','meal','rest')),
  title                   TEXT NOT NULL,
  starts_at               TIME,
  duration_minutes        INTEGER CHECK (duration_minutes > 0),
  latitude                DOUBLE PRECISION,
  longitude               DOUBLE PRECISION,
  opening_hours_text      TEXT,
  opening_hours_checked   BOOLEAN NOT NULL DEFAULT false,
  cost                    NUMERIC(14,2),
  cost_currency           CHAR(3),
  cost_certainty          TEXT NOT NULL DEFAULT 'unavailable' CHECK (cost_certainty IN ('confirmed','estimated','unavailable')),
  travel_minutes_to_next  INTEGER,
  travel_certainty        TEXT CHECK (travel_certainty IN ('confirmed','estimated','unavailable')),
  source                  TEXT NOT NULL,
  source_url              TEXT,
  fetched_at              TIMESTAMPTZ,
  -- opening_hours_checked is false for a chosen place that does not state its hours: it is planned and shown as "check before you go".
  UNIQUE (day_id, slot, position)
);

-- Totals are computed here, never in application code.
CREATE FUNCTION trip_budget_summary(p_trip UUID)
RETURNS TABLE (category TEXT, amount NUMERIC(14,2), item_count BIGINT, missing_count BIGINT, worst_certainty TEXT)
LANGUAGE sql STABLE AS $$
  SELECT c.category,
         COALESCE(SUM(b.amount_trip), 0)::NUMERIC(14,2),
         COUNT(b.id),
         COUNT(b.id) FILTER (WHERE b.amount_trip IS NULL),
         CASE WHEN COUNT(b.id) = 0 THEN 'unavailable'
              WHEN bool_or(b.certainty = 'unavailable' OR b.amount_trip IS NULL) THEN 'unavailable'
              WHEN bool_or(b.certainty = 'estimated') THEN 'estimated' ELSE 'confirmed' END
  FROM (VALUES ('hotels'),('transportation'),('activities'),('food'),('local_transport'),('miscellaneous')) AS c(category)
  LEFT JOIN budget_items b ON b.trip_id = p_trip AND b.category = c.category
  GROUP BY c.category
$$;

CREATE FUNCTION trip_budget_totals(p_trip UUID)
RETURNS TABLE (estimated_total NUMERIC(14,2), budget NUMERIC(14,2), remaining NUMERIC(14,2),
               currency CHAR(3), categories_without_real_figure TEXT[])
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(SUM(s.amount),0)::NUMERIC(14,2),
         t.budget_amount,
         (t.budget_amount - COALESCE(SUM(s.amount),0))::NUMERIC(14,2),
         t.budget_currency,
         COALESCE(array_agg(s.category) FILTER (WHERE s.worst_certainty = 'unavailable'), '{}')
  FROM trips t, trip_budget_summary(p_trip) s
  WHERE t.id = p_trip
  GROUP BY t.budget_amount, t.budget_currency
$$;

-- Conversion uses the stored rate for its date (nearest earlier); result is always estimated.
CREATE FUNCTION convert_amount(p_amount NUMERIC, p_from CHAR(3), p_to CHAR(3), p_date DATE)
RETURNS TABLE (converted NUMERIC(14,2), fx_rate_id BIGINT)
LANGUAGE sql STABLE AS $$
  SELECT round(p_amount * r.rate, 2)::NUMERIC(14,2), r.id
  FROM fx_rates r
  WHERE r.base = p_from AND r.quote = p_to AND r.rate_date <= p_date
  ORDER BY r.rate_date DESC, r.fetched_at DESC
  LIMIT 1
$$;

-- ===== 007: bookings, payment attempts, confirmation messages =====
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
  rooms                 SMALLINT NOT NULL DEFAULT 1,
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
