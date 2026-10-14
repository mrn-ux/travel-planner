# Data Model: Hotel and Transport Comparison

## Entities

- **Selected hotel**: the hotel (and optionally room) chosen for a trip, with a snapshot of what was shown.
- **Selected transport**: the transport option chosen for a trip.
- **Chosen place** (added 2026-10-13): a place to visit the traveler ticked for the trip, with a snapshot of its name, kind, coordinates, opening hours and entry as the map data stated them (`trip_places`).
- **Geocode cache entry**: a cached Nominatim result.
- Updated 2026-10-13: the trip itself also carries the places the search needs: `trips.dest_city`, `dest_country_name` (the traveler's city and country picks), `origin_city`, `origin_country_name` (start place, saved from the Transport tab) and `accommodation_preference` (lodging type filter). Flight bookings are stored in `flight_bookings` (constitution 3.5.0), not here.

Hotel search results, room lists, reviews and timetable options are **not stored** except through the generic `http_cache` (content/reviews only) and the selections above; rates and availability are never cached.

## Relationships and rules

- `trip_hotels.trip_id` and `trip_transport.trip_id → trips.id` (cascade). One selected hotel and one selected transport per trip (unique on `trip_id`); selecting again replaces the row.
- `trip_places (trip_id, place_id)` is the primary key (a place is chosen once per trip); `place_id` is the OpenStreetMap id (`node/123`) or a Wikidata id (`Q123`, country lists). `entry_kind` is `free`, `paid` or `unknown`; `opening_hours` and `charge` are `NULL` when the source does not state them (never filled in). Details are copied from the live list on the server, never taken from the browser.
- `trip_transport.provider` is `transitous` or `duffel`; `provider_ref` holds the Duffel offer id for a bookable test flight (`price_source` then `duffel-sandbox`), else `NULL`.
- Price fields are `NUMERIC(14,2)` with currency, `price_source`, `price_certainty`, `fetched_at`; `NULL` price means unavailable. `sandbox` is `true` for every LiteAPI row.
- Nights = `checkout - checkin`, always ≥ 1.
- `geocode_cache.query_key` is the lower-cased, trimmed, whitespace-collapsed query plus country code.
- Ownership is inherited from the trip; there is no separate user column.

## State transitions

Selection: none → selected → replaced (a new row replaces the old). A selected hotel later becomes *booked* via plan 007 (status read through `bookings`, not stored here).

## DDL fragment (005)

```sql
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
  provider         TEXT NOT NULL,                  -- 'transitous' or 'duffel'
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
  price_source     TEXT NOT NULL,                  -- 'transitous-fare', 'faro-estimate' or 'duffel-sandbox' ('none' when no price)
  price_basis      TEXT,                           -- estimate assumptions shown to the traveler
  price_low        NUMERIC(14,2),
  price_high       NUMERIC(14,2),
  price_certainty  TEXT NOT NULL CHECK (price_certainty IN ('confirmed','estimated','unavailable')),
  schedule_certainty TEXT NOT NULL CHECK (schedule_certainty IN ('confirmed','estimated','unavailable')),
  source_url       TEXT,
  provider_ref     TEXT,                           -- added 2026-10-13: the provider's offer id when bookable (Duffel test flights)
  fetched_at       TIMESTAMPTZ NOT NULL,
  selected_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Added 2026-10-13: places to visit the traveler chose (the itinerary of plan 006 is built from these).
CREATE TABLE trip_places (
  trip_id       UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  place_id      TEXT NOT NULL,                 -- OpenStreetMap id, for example 'node/123' (or a Wikidata Q id)
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
```
