# Data Model: App Shell and Platform Foundation

The shell has no entities of its own (updated 2026-10-13: the chosen colour theme lives only in the browser's `localStorage`, key `faro.theme`). This plan owns the **base of `db/init.sql`** and the shared cache table.

## init.sql assembly rule

`db/init.sql` is one file, composed in this order from each plan's `data-model.md` "DDL fragment": 001 (this) → 002 → 003 → 004 → 005 → 006 → 007. Plan 008 adds no tables. No seed data, no migrations: the file only runs on an empty volume.

## DDL fragment (001)

```sql
CREATE EXTENSION IF NOT EXISTS vector;

-- Shared conventions:
--   money      NUMERIC(14,2), always with a currency CHAR(3), a source TEXT and a certainty
--   certainty  TEXT CHECK (certainty IN ('confirmed','estimated','unavailable'))
--   ids        UUID DEFAULT gen_random_uuid() (built in to PostgreSQL 16)

-- Outbound-request cache used by api/src/http.ts (never used for rates, availability or bookings)
CREATE TABLE http_cache (
  cache_key   TEXT PRIMARY KEY,           -- sha256 of provider + method + url + body
  provider    TEXT NOT NULL,
  status      INTEGER NOT NULL,
  body        JSONB,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX http_cache_expires_idx ON http_cache (expires_at);
```

## Client-side shared types (not persisted)

- `Certainty = 'confirmed' | 'estimated' | 'unavailable'`
- `Money = { amount: string; currency: string; certainty: Certainty }` where `amount` is a decimal string.
- `Provenance = { source: string; source_url: string | null; fetched_at: string | null; certainty: Certainty }` (see contracts/platform.md).
