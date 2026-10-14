# Research: Destination Recommendations and Knowledge Base

Findings come from official documentation fetched during planning; anything unconfirmed is marked **UNVERIFIED** and must be checked against the live service when implementing.

## R1. pgvector usage
- **Decision**: `embedding vector(768)`; `CREATE INDEX … USING hnsw (embedding vector_cosine_ops)`; query `SELECT …, 1 - (embedding <=> $1::vector) AS similarity FROM knowledge_chunks WHERE destination = $2 ORDER BY embedding <=> $1::vector LIMIT $3`.
- **Filtered-search caveat**: HNSW applies the filter after the index scan, so a selective `destination` filter can return fewer than `LIMIT` rows. Each search runs in a transaction with `SET LOCAL hnsw.iterative_scan = relaxed_order` and `SET LOCAL hnsw.ef_search = 100`; at workshop scale an exact scan would also be fine.
- **Image / init**: `docker.io/pgvector/pgvector:pg16`, `CREATE EXTENSION IF NOT EXISTS vector;` in `init.sql` (runs only on an empty data directory). The `pg16` tag name is **UNVERIFIED**; the README lists tags such as `pg16-trixie`.

## R2. Embeddings
- **Decision**: `POST {OLLAMA_BASE_URL}/api/embed` `{ model: OLLAMA_EMBED_MODEL, input: [texts] }` → `{ embeddings }`; vectors are L2-normalised so cosine is right. Index and query use the same model. At first use the API embeds a probe string and refuses to ingest if the vector length is not **768**.
- **Candidates**: `nomic-embed-text` (768) is expected but **UNVERIFIED** as current; `embeddinggemma` dimension also **UNVERIFIED**. Check with a test call.

## R3. Chunking and dedupe
- **Decision**: Split text on headings/paragraphs into ~800-character chunks with 100-character overlap; `content_hash = sha256(source + destination + title + text)`. Upsert on `(source, destination, content_hash)`: existing rows only get `fetched_at` and `expires_at` refreshed (no re-embed); new text is embedded and inserted; chunks of that source/destination whose hash is no longer present are deleted.
- **Batching**: embed up to 16 chunks per request, serially.

## R4. Sources, lifetimes and policies

| Source | Used for | Endpoint (from docs) | Lifetime | Licence / attribution | Notes |
|---|---|---|---|---|---|
| MediaWiki (Wikivoyage, Wikipedia) | destination guides | `https://en.wikivoyage.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=…&format=json&formatversion=2` (same on en.wikipedia.org) | 30 days | CC BY-SA 4.0 (version for Wikivoyage **UNVERIFIED**); keep title, article URL, licence link | User-Agent required, format `Faro/0.1 (contact) …`; serial requests |
| Wikidata | entity facts (coordinates, country, population) | `wbsearchentities`, `wbgetentities` at `https://www.wikidata.org/w/api.php` | 30 days | CC0 | Honour 429 Retry-After; property ids from general knowledge **UNVERIFIED** |
| Open-Meteo | forecast, climate normals | `https://api.open-meteo.com/v1/forecast`, `https://archive-api.open-meteo.com/v1/archive`, geocoding `https://geocoding-api.open-meteo.com/v1/search` | 6 hours (forecast), 30 days (historical) | CC BY 4.0; credit Open-Meteo.com | **Free tier non-commercial only**; limits 600/min, 5,000/h, 10,000/day |
| GOV.UK Content API | FCDO travel advice | `https://www.gov.uk/api/content/foreign-travel-advice/<country-slug>` | 6 hours | Open Government Licence v3.0 ("Contains public sector information licensed under the Open Government Licence v3.0") | Fields: `description`, `details.alert_status`, `details.parts[].body` (HTML → text), `public_updated_at` |
| Nager.Date | public holidays | `https://nagerholidays.com/api/v4/Holidays/{CountryCode}/{Year}` (site moved from date.nager.at) | 30 days | open source; terms apply (licence **UNVERIFIED**) | "No rate limits" claimed |

Plan 006 adds Overpass (attractions and opening hours, 7 days) and Frankfurter (rates, 24 hours).

**Lifetimes requested**: advisories and forecasts 6h, exchange rates 24h, attractions and opening hours 7d, guides 30d. Sources not named in the brief (Wikidata, holidays, country facts, climate normals) use 30 days.

## R5. First-discussion ingestion
- **Decision**: `ensureDestinationKnowledge(destination)` runs when a destination is first set on any trip or first named in chat. It checks `ingest_state`; if never ingested it runs all sources (serially per host, in parallel across hosts) and marks the state per source. The request that triggered it returns immediately with `loading`, and the UI polls `GET /api/knowledge/status?destination=`. Ingestion is idempotent and guarded by an advisory lock per destination.
- **Destination identity**: normalised `name, country_code` from Open-Meteo geocoding (Nominatim is not used here to respect its 1 req/s budget).

## R6. Scheduler
- **Decision**: `node-cron` job at `REFRESH_CRON` (default `0 * * * *`, hourly) selects destinations referenced by saved trips (`trips.status <> 'draft'`; every trip is saved now) with any chunk where `expires_at < now()`, and re-ingests only the expired sources. (Anonymous draft trips no longer exist, so there is nothing else to delete.) `POST /api/admin/refresh` (header `X-Admin-Token` must equal `ADMIN_TOKEN`; with `ADMIN_TOKEN` unset the route returns 404) runs the same function once.

## R7. Expired entries
- **Decision**: Expired chunks stay searchable; the `search_knowledge` result marks them `certainty: 'estimated'` with a note "expired, refresh pending". Fresh chunks are `confirmed` only for facts the source itself states (e.g. advisory text); descriptive guide text is `estimated` by default because it is editorial.

## R8. Recommendation pipeline (two tiers, no dependence on a pre-filled knowledge base)

**Problem addressed**: with an empty knowledge base the previous design had no candidates to rank and had to ingest before answering, so a first request was slow and could return few destinations.

**Tier 0 - candidate discovery (live, cached 30 days)**
- Region hint from the brief (country, region or "Recommend somewhere"): resolved with Open-Meteo geocoding.
- Candidates come from **Wikidata** via a small SPARQL query on `https://query.wikidata.org/sparql`: places that are cities or tourist destinations and have an English Wikivoyage article, optionally within the hinted country/region, ordered by number of sitelinks (a popularity proxy), limit 40 (superseded: the implemented query is cities with more than 120 language editions, limit 80; see Implementation notes). Interest terms ("beaches", "temples", "hiking") also run a Wikivoyage full-text search (`action=query&list=search&srsearch=...&srnamespace=0`) to boost matches. Results are cached in `http_cache` for 30 days, so only the first-ever request pays this cost.
- With no region hint, candidates are the most-linked destinations worldwide, filtered in Tier 1.
- Property ids and the SPARQL shape are from general knowledge (**UNVERIFIED**); the endpoint has query timeouts, so the query is kept small and failure degrades to the Wikivoyage search results only.

**Tier 1 - quick scoring (target about 10 s, parallel across hosts, all cached)**
For the top 14 candidates (superseded 2026-10-13: was 20; then the best 8 shown), using only fast structured sources:
- **Season**: Open-Meteo historical archive for the travel month (temperature, rain days) compared with the traveler's stated preference (from interests/brief); if the traveler gave no preference, season is scored as a neutral factor and its reason states what the weather is.
- **Safety**: GOV.UK advisory (alert status, last update) for the destination's country.
- **Budget fit** (superseded 2026-10-13: not implemented in the ranking, always Unavailable; the hotel and transport comparison supplies prices later): a real nightly rate from the hotel provider's `min-rates` for the trip dates (sandbox, `confirmed`) plus the plan 005 transport fare estimate (`estimated`) compared with the budget; if the hotel call fails the factor is `unavailable`.
- **Transport** (superseded 2026-10-13: not implemented in the ranking, always Unavailable): Transitous reachability from the traveler's origin when an origin is known, else "could not be assessed".
- **Activities**: Wikivoyage search relevance from Tier 0 (a rough proxy, labelled as such) until Tier 2.
Result: ranked list with `completeness: 'quick'` and `refining: true`, returned as soon as at least 3 candidates have a score, even if others are still computing.

**Tier 2 - refinement (background, up to ~60 s)**
- Ingest the guides for the top 5 (MediaWiki, Wikidata, holidays, country facts), embed, then re-score *activities* with cosine similarity between the interests text and chunks, and attach guide-based reasons with citations.
- Ranking may change; the UI marks the list `Refining...` and updates in place when `completeness` becomes `full`, highlighting rank changes. If refinement fails, the list stays `quick` and says "Based on limited data".

**Minimum results**: if fewer than 3 candidates survive, the weakest-weighted threshold is relaxed once (stated in the reasons); if still fewer than 3, the screen shows what was found and the limiting factor. No destination is invented or padded.

**Scoring**: configurable weighted blend (constants in one file): budget fit 30, season 20, activities 20, transport 15, safety 15. A factor with no usable data scores neutral and its reason says "could not be assessed".

**Reasons**: templated sentences generated from tool-result numbers (not free model text), each with provenance.

## R9. Warm-up (optional background pre-ingestion)
- **Decision**: at API start a low-priority job, `knowledge/warmup.ts`, runs only if `WARMUP_DESTINATIONS > 0` (default 30): it asks Wikidata for the top N destinations by sitelinks (the same discovery query, no hand-written list), then ingests them serially at a polite rate (one destination at a time, respecting each source's spacing) so that later requests skip Tier 0 and Tier 2 waits. It never blocks start-up or requests, and it stops on repeated source failures.
- **Not seed data**: nothing is stored in `init.sql`; all rows come from live sources with their licences and expiry, and expire and refresh like any other entry.
- **Cost**: roughly N guide fetches plus embeddings after the first boot; `WARMUP_DESTINATIONS=0` disables it.

## R10. Progressive delivery to the UI
- **Decision**: `GET /api/trips/:id/recommendations` returns immediately with whatever exists (`status: loading` | `partial` | `ready`); the page polls every 2 seconds while `refining` is true (stops after 90 seconds with a visible note). Results in `trip_recommendations` carry `completeness` so a reload shows the same state. The agent's chat answer for the same trip reads the same stored list so chat and screen agree.

## Implementation notes (verified against the live services)

- **Embedding model**: `nomic-embed-text`, 768 dimensions. It needs task prefixes: `search_document: ` on chunks and `search_query: ` on queries (`api/src/knowledge/embed.ts`). Cosine similarities for relevant guide passages sit around 0.35 to 0.75, which is what `activitiesFromSimilarity` maps to 0-100.
- **Discovery**: one simple Wikidata SPARQL query (cities with more than 120 language editions, top 80), then `wbgetentities` for coordinates, country and the English Wikivoyage sitelink. Complex SPARQL times out. A Wikivoyage full-text search on the traveler's interests boosts matching cities. Search hits that are not in the city list are **not** geocoded into candidates: a title such as "England" resolves to a different place, and a wrong destination is worse than a missing one.
- **Rate limits**: Wikimedia returns HTTP 429 after bursts. Every Wikimedia and Wikidata call is spaced (400 ms to 1 s), cached 30 days and ingestion is serial.
- **Climate in the quick tier** is requested for the travel month only (about 30 days of data), not the whole year, because the archive API is the slowest call. The knowledge-base copy keeps the full year.
- **Country names** come from the ISO code, not from the source ("Kingdom of the Netherlands" has no FCDO page; "Netherlands" does).
- **Timing** (empty knowledge base, Ollama local): first ranked list 2 s with a warm HTTP cache, 15 to 25 s with a cold one (Open-Meteo archive lookups dominate); refinement of the top 5 about 12 s more. The "about 10 seconds" target is met only when the HTTP cache is warm, which warm-up (`WARMUP_DESTINATIONS`) helps with.
- **Relaxation**: if fewer than 3 destinations pass, the season threshold is relaxed once and the page says so. The safety exclusion is never relaxed.
- **Implemented ranking inputs (Updated 2026-10-13)**: season from Open-Meteo climate for the travel month (from the start date, else a month named in the date window), safety from GOV.UK FCDO alert status (hard filter: safety below 20 excluded, never relaxed; season below 30 relaxed once), activities from the Wikivoyage search rank (quick) or guide-passage similarity (refined, top 5 only). Budget and transport are Unavailable in the ranking. Weights stay 30/20/20/15/15 with neutral 50 for an unscored factor.
