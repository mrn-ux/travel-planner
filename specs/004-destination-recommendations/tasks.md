---
description: "Task list for Destination Recommendations (plus knowledge base)"
---

# Tasks: Destination Recommendations (plus knowledge base)

**Input**: `/specs/004-destination-recommendations/` (plan.md, spec.md, research.md, data-model.md, contracts/recommendations-api.md, contracts/knowledge-sources.md, quickstart.md)

**Prerequisites**: plan 001 Phases 1-2; plan 003 T003-T008 (Ollama client, tool registry, trips service). Quick-tier budget fit uses plan 005's hotel provider and fare estimator if available; otherwise that factor is Unavailable.

**Tests**: None (manual `quickstart.md`).

**Format**: `- [ ] T### [P?] [US#?] Description with file path`

---

## Phase 1: Setup

- [X] T001 Append the 004 DDL fragment from `data-model.md` (`knowledge_chunks` with HNSW index, `ingest_state`, `trip_recommendations`) to `db/init.sql`
- [X] T002 [P] Add `node-cron` to `api/package.json`; add `REFRESH_CRON` (default `0 * * * *`), `WARMUP_DESTINATIONS` (default 30), `ADMIN_TOKEN` (empty disables) to `api/src/config.ts` and confirm they are in `.env.example`

---

## Phase 2: Foundational (knowledge base)

**CRITICAL**: complete before any user story.

- [X] T003 Define `api/src/providers/knowledge/KnowledgeSource.ts` per `contracts/knowledge-sources.md` (`DestinationRef`, `FetchResult`, `SourceDocument`, `KnowledgeSource`)
- [X] T004 [P] Implement `api/src/knowledge/chunk.ts`: split text on headings/paragraphs into about 800-character chunks with 100-character overlap and compute `content_hash = sha256(source + destination + title + text)`
- [X] T005 [P] Implement `api/src/knowledge/embed.ts`: batch up to 16 chunks per `embed()` call from plan 003 and verify the vector length is 768 on first use (refuse and report an error otherwise)
- [X] T006 Implement `api/src/knowledge/ingest.ts` `ingestDestination(dest, sources)`: fetch each source, chunk, skip chunks whose `(source, destination, content_hash)` already exist (only refresh `fetched_at` and `expires_at`), embed and insert new chunks, delete vanished chunks of that source, update `ingest_state`, guard with a Postgres advisory lock per destination
- [X] T007 Implement `api/src/knowledge/search.ts` `searchKnowledge(destination, queryEmbedding, limit)`: transaction with `SET LOCAL hnsw.iterative_scan = relaxed_order` and `SET LOCAL hnsw.ef_search = 100`, cosine query `ORDER BY embedding <=> $1::vector LIMIT $3`, returning citations, licence, attribution and an `expired` flag
- [X] T008 [P] Implement `api/src/providers/knowledge/MediaWikiSource.ts` (Wikivoyage and Wikipedia guides via `action=query&prop=extracts&explaintext=1`, 30-day TTL, CC BY-SA attribution string with article title and URL)
- [X] T009 [P] Implement `api/src/providers/knowledge/WikidataSource.ts` (`wbsearchentities`/`wbgetentities` facts, 30-day TTL, CC0 attribution)
- [X] T010 [P] Implement `api/src/providers/knowledge/OpenMeteoSource.ts` (forecast 6 h TTL, historical/climate normals via the archive API 30 days, geocoding API for coordinates, CC BY 4.0 attribution)
- [X] T011 [P] Implement `api/src/providers/knowledge/GovUkAdviceSource.ts` (`/api/content/foreign-travel-advice/<slug>`, summary, `alert_status`, parts converted to text, 6 h TTL, OGL v3.0 attribution)
- [X] T012 [P] Implement `api/src/providers/knowledge/NagerHolidaysSource.ts` (`https://nagerholidays.com/api/v4/Holidays/{CountryCode}/{Year}`, 30 days; live path confirmed). REST Countries is dropped (deprecated API)
- [X] T013 Implement `api/src/providers/knowledge/registry.ts` listing the sources above and exposing `register(source)` so plan 006 can add Overpass and Frankfurter; reject any source id outside the allowed list (no hotel/transport sources)
- [X] T014 Implement `api/src/tools/searchKnowledge.ts`, `getWeather.ts`, `getTravelAdvisory.ts` per `contracts/recommendations-api.md`, registered in `api/src/agent/registry.ts`, each returning the provenance envelope with `estimated` for expired chunks and `unavailable` on source failure

---

## Phase 3: User Story 1 - See ranked destinations with reasons (Priority: P1) MVP

**Goal**: first ranked list within about 10 seconds on an empty knowledge base, refined in the background.

**Independent Test**: with `knowledge_chunks` empty, a brief with no destination yields at least three ranked cards marked "Refining..." and later the refined list.

- [X] T015 [US1] Implement `api/src/recommendations/discover.ts`: run one simple Wikidata SPARQL query (cities ordered by sitelink count, limit 80), hydrate with `wbgetentities` (coordinates, country, English Wikivoyage sitelink), boost with a Wikivoyage full-text search over the traveler's interests, cache 30 days; no candidates come from search hits alone
- [X] T016 [US1] Implement `api/src/recommendations/quick.ts`: for the top 20 candidates in parallel gather season (climate for the travel month), safety (GOV.UK), budget fit and transport (Updated 2026-10-13: always Unavailable in the ranking, no hotel or fare input; 14 candidates are scored, not 20) and a Wikivoyage relevance proxy; return the best 8 with `completeness: 'quick'` once at least 3 have scores
- [X] T017 [US1] Implement `api/src/recommendations/score.ts`: weighted blend (budget 30, season 20, activities 20, transport 15, safety 15) in one constants object, neutral score for a factor with no data, and templated reason sentences built from tool-result numbers with provenance (never free model text); relax the lowest-weight threshold once when fewer than 3 survive and state it
- [X] T018 [US1] Implement `api/src/recommendations/refine.ts`: background job ingesting guides for the top 5 (`ingestDestination`), re-scoring activities by cosine similarity between the interests text and chunks, attaching guide-based reasons with citations, storing `completeness: 'full'` and `previousRank`; on failure keep the quick list and mark it "Based on limited data"
- [X] T019 [US1] Implement `api/src/tools/recommendDestinations.ts` and the routes (built in `api/src/recommendations/routes.ts` with `service.ts`; Updated 2026-10-13): `GET /api/trips/:id/recommendations` (status `loading|partial|ready|insufficient`, `refining`), `POST /api/trips/:id/recommendations/refresh` (supports `excluded`), persisted in `trip_recommendations`; register the tool in the agent registry
- [X] T020 [US1] Build `web/src/pages/search/RecommendationBand.tsx` per `docs/UI-SPEC.md` 2.4 and frames 1e/M3: heading "Recommended destinations", three cards per row desktop and one on mobile using `DestinationCard` with reason list and score bar, skeleton while `loading`, "Refining..." note and rank-change highlight while `partial`, "Based on limited data" on failed refinement, insufficient/empty state naming the limiting factor and the count found, error with Retry; poll every 2 s while `refining` (stop after 90 s with a note)
- [X] T021 [US1] Show attribution (source, link, licence) under any guide-derived reason text in `RecommendationBand.tsx`

---

## Phase 4: User Story 2 - Choose a destination (Priority: P1)

**Goal**: selecting a card sets the trip's destination and switches to the comparison band.

**Independent Test**: select the second card; destination stored; Hotels/Transport band shown.

- [X] T022 [US2] Implement `PUT /api/trips/:id/destination` and `DELETE /api/trips/:id/destination` in `api/src/recommendations/routes.ts` (set/clear `destination`, `dest_city`, `dest_country_name`, `destination_country`, coordinates via Open-Meteo geocoding) and trigger `ensureDestinationKnowledge` in the background
- [X] T023 [US2] Implement `api/src/knowledge/ensure.ts` `ensureDestinationKnowledge(dest)` (checks `ingest_state`, runs `ingestDestination` when never ingested) and `GET /api/knowledge/status?destination=`
- [X] T024 [US2] In `web/src/pages/search/SearchPage.tsx` show `RecommendationBand` only when the trip has no destination and replace it with the comparison band (plan 005) after `PUT /destination`; reflect the destination on the home form

---

## Phase 5: User Story 3 - Ask for different options (Priority: P2)

**Goal**: refresh the list after changing a ranking field or asking for alternatives.

**Independent Test**: lower the budget; the list re-ranks with changed reasons.

- [X] T025 [US3] Re-generate recommendations (`api/src/recommendations/service.ts`, keyed by `brief_hash`) whenever a ranking-relevant brief field changes (budget, dates, duration, interests, transport preference, travelers) and expose "View alternatives" via `POST .../refresh` with `excluded`
- [X] T026 [US3] Add a **View alternatives** secondary button to `RecommendationBand.tsx` that posts dismissed destinations and shows the new list

---

## Phase 6: Scheduler, warm-up and admin

- [X] T027 Implement `api/src/knowledge/refresh.ts`: select destinations referenced by non-draft trips with expired chunks, re-ingest only expired sources (per-source lifetimes from research R4), (the draft-trip cleanup from plan 003 T025 is now a no-op: login first, no drafts)
- [X] T028 Schedule `refresh.ts` with `node-cron` at `REFRESH_CRON` in `api/src/index.ts` and implement `POST /api/admin/refresh` (header `X-Admin-Token` equals `ADMIN_TOKEN`; 404 when `ADMIN_TOKEN` is unset, 401 on mismatch)
- [X] T029 Implement `api/src/knowledge/warmup.ts`: if `WARMUP_DESTINATIONS > 0` after start-up, fetch the top N destinations from Wikidata (same discovery query) and ingest them serially without blocking requests, stopping on repeated source failures; call it from `api/src/index.ts`

---

## Phase 7: Polish

- [X] T030 [P] Confirm `SELECT DISTINCT source FROM knowledge_chunks` never includes a hotel or transport provider
- [X] T031 Run every step of `specs/004-destination-recommendations/quickstart.md` (including the empty-knowledge-base timing and failed-refinement checks) and fix failures
- [X] T032 [P] Run `scripts/check-tokens.sh` and compare `RecommendationBand.tsx` with frames 1e and M3 in `docs/design/Faro Screens.dc.html` / `Mobile Screens.dc.html`

---

## Dependencies & Execution Order

- Phase 1 -> Phase 2 -> Phase 3 (MVP) -> Phase 4 -> Phase 5; Phase 6 any time after Phase 2; Phase 7 last.
- T003 before T008-T013; T004/T005 before T006; T015-T017 before T019; T018 needs T006.
- Plan 006 depends on T013 (registry) and plan 005's hotel provider is optional for T016.

## Parallel Opportunities

T002; T004, T005; T008-T012; T030 and T032.

## Implementation Strategy

MVP = Phases 1-3 (live discovery plus quick ranking and the cards UI), then Phase 4 (choose), then refinement polish (T018 can follow immediately after MVP), scheduler and warm-up last.
