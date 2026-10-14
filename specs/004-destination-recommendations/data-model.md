# Data Model: Destination Recommendations and Knowledge Base

## Entities

- **Knowledge chunk**: a piece of retrieved text with citation, licence, destination, embedding and freshness window.
- **Ingest state**: per destination and source, when it was last fetched and whether it succeeded.
- **Trip recommendation**: one ranked destination for one trip with a score and reasons.

## Relationships and rules

- `trip_recommendations.trip_id → trips.id` (cascade); ranks unique per trip; replaced wholesale when the list is regenerated.
- `knowledge_chunks` is shared reference data with no user reference. Unique on `(source, destination, content_hash)`.
- Never stored here: hotel rates, availability, departures (enforced by the sources list; no hotel/transport source is registered).
- Freshness: a chunk is *fresh* while `expires_at > now()`; afterwards still searchable but returned as `estimated`.
- `embedding` is exactly 768 dimensions; inserts with another length fail.
- `reasons` is an array of `{ factor, text, certainty, source, source_url, fetched_at, attribution? }` (`attribution` is the licence credit for guide-derived text).

## State transitions

*Updated 2026-10-13*: `trip_recommendations` rows are regenerated when the ranking hash (`brief_hash`: budget, dates or date window, duration, interests, transport preference, adults, children's ages) changes; destination, country and city edits do not change it. The DDL below matches `db/init.sql`. Only the top 5 rows become `full`; the rest stay `quick`.

`ingest_state.status`: `pending` → `ok` | `failed`; `failed` retries on the next scheduler run. Recommendation set: `quick` (first list) → `full` (after refinement) per row; regenerated wholesale on a brief change (no history). Candidate lists live in `http_cache`, not in a table.

## DDL fragment (004)

```sql
CREATE TABLE knowledge_chunks (
  id           BIGSERIAL PRIMARY KEY,
  source       TEXT NOT NULL,              -- 'wikivoyage','wikipedia','wikidata','open-meteo','govuk-fcdo','nager','overpass','frankfurter'
  source_url   TEXT NOT NULL,
  licence      TEXT NOT NULL,
  attribution  TEXT NOT NULL,              -- text shown with the chunk (CC BY-SA credit etc.)
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
```
