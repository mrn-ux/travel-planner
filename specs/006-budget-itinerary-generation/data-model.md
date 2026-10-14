# Data Model: Budget and Itinerary Generation

## Entities

- **Exchange rate**: a stored rate for a currency pair and date with its source.
- **Budget item**: one costed thing in one of six categories, with original and trip-currency amounts, source and certainty.
- **Budget proposal**: a suggested change with its saving, which the traveler can apply or dismiss.
- **Itinerary day / item**: a dated day with scheduled activities, meals and rests.

## Relationships and rules

- All tables reference `trips(id)` with cascade delete; ownership is inherited from the trip.
- `budget_items.category` ∈ {hotels, transportation, activities, food, local_transport, miscellaneous}.
- `amount_trip` is `NULL` when the cost is unavailable; unavailable is never treated as 0. When `currency` differs from the trip currency, `amount_trip` is the SQL-converted value using `fx_rate_id` and `certainty` is forced to `estimated`.
- `trip_budget_summary(trip_id)` is the only place totals are computed (sum of non-null `amount_trip` per category; `remaining = budget_amount - total`).
- `itinerary_items.slot` ∈ {morning, afternoon, evening}; `kind` ∈ {activity, meal, rest}. ~~Activities require `opening_hours_checked = true` and a start/end that lies inside the parsed hours for that weekday.~~ Updated 2026-10-13: an activity whose hours are stated lies inside the parsed hours for that weekday and has `opening_hours_checked = true`; an activity for a chosen place that states no hours is stored with `opening_hours_checked = false` and `opening_hours_text = NULL` and shown as "check before you go" (the table `CHECK (kind <> 'activity' OR opening_hours_checked)` was dropped). Meals and rests also have `false`.
- Chosen places live in `trip_places` (plan 005 data model); `generate` plans exactly those rows when any exist, and `itinerary_items.source` is `overpass`, `wikidata` (country-list places) or `faro` (meals and rests).
- `travel_minutes_to_next` and its certainty come from the transport provider's road time; `NULL` for the last item of a day.
- A proposal `status` moves `proposed → applied | dismissed`; applied proposals change `budget_items`/`itinerary_items` in the same transaction.

## State transitions

Proposal: proposed → applied (terminal) or dismissed (terminal); regenerating proposals supersedes `proposed` rows only. Plan: regenerated automatically when the trip plan opens with no itinerary or with a different set of chosen places (Updated 2026-10-13), or on demand; previous itinerary rows are replaced for the affected days. Budget rows (`budget_items`) are rebuilt from scratch by `recalcBudget` on every plan read and every selection or itinerary change.

## DDL fragment (006)

```sql
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
  -- Updated 2026-10-13: the CHECK (kind <> 'activity' OR opening_hours_checked) was removed. opening_hours_checked is false for a
  -- chosen place that does not state its hours: it is planned and shown as "check before you go".
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
```
