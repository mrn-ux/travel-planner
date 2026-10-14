# Implementation Plan: Destination Recommendations (plus knowledge base)

**Branch**: `004-destination-recommendations` | **Date**: 2026-10-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-destination-recommendations/spec.md`. Shared stack and conventions: [plan 001](../001-app-shell-navigation/plan.md); agent runtime: [plan 003](../003-trip-intake-conversation/plan.md).

## Summary

Ranked destination recommendations on `/search` when no destination is set, with a reason per factor, delivered in two tiers so a first-ever request is fast and does not depend on a pre-filled knowledge base (research R8-R10). This plan owns the **knowledge base**: a pgvector table fed by small knowledge-source providers (MediaWiki for Wikivoyage/Wikipedia, Wikidata, Open-Meteo, GOV.UK travel advice, Nager.Date holidays, REST Countries), first-discussion ingestion, a `node-cron` refresher, `POST /api/admin/refresh`, and the tools `search_knowledge`, `recommend_destinations`, `get_weather`, `get_travel_advisory`. Overpass attractions and Frankfurter rates register as sources from plan 006.

## Technical Context

**Language/Version**: TypeScript 5, Node 20, React 18

**Primary Dependencies**: `node-cron`, Ollama `/api/embed` over `fetch`, `pg` (vectors passed as text with `::vector`)

**Storage**: PostgreSQL + pgvector: `knowledge_chunks` (HNSW cosine index), `ingest_state`, `trip_recommendations`

**Testing**: None; manual quickstart

**Target Platform**: Podman compose

**Project Type**: Web application

**Performance Goals**: A first ranked list ("quick tier") within about 10s even when the knowledge base is empty; the refined list ("full tier") within about 60s, updating in place; repeat requests under 3s from caches

**Constraints**: Public APIs are best-effort: every request has a timeout, goes through the shared cache and per-host spacing; a failed source returns `unavailable`, never a fallback; Wikipedia/Wikivoyage CC BY-SA attribution kept with every chunk; hotel rates, availability and departures are never written to the knowledge base

**Scale/Scope**: Tens of destinations, thousands of chunks (index is optional at this size but required by the brief)

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| I Simplicity | Pass | Each source is one small file implementing `KnowledgeSource`; ingestion is one function; no queue system. |
| II Multi-user | Pass | Knowledge is shared reference data (no user data). Recommendations rows are scoped by trip, which is owner-checked. |
| III Agent discipline | Pass | Reasons are produced from tool results only; model text is never a source of figures. |
| IV Provider abstraction | Pass | `KnowledgeSource` interface with one real implementation per source; chosen by registry config. |
| V Money | Pass | Any amount shown (e.g. indicative costs) comes with currency and certainty; no float math. |
| VI Certainty | Pass | Fresh chunk = `confirmed`; past `expires_at` = `estimated`; failed fetch = `unavailable`. |
| VII Design fidelity | Pass | Destination recommendation cards per design system and UI-SPEC §2.4. |
| VIII No silent failure | Pass | Loading / empty / error per spec; ingestion failures are logged and surfaced as unavailable factors. |

## Project Structure

### Documentation (this feature)

```text
specs/004-destination-recommendations/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── recommendations-api.md
    └── knowledge-sources.md
```

### Source Code

```text
api/src/providers/knowledge/
├── KnowledgeSource.ts            # interface
├── MediaWikiSource.ts            # Wikivoyage + Wikipedia guides
├── WikidataSource.ts
├── OpenMeteoSource.ts            # forecast + climate
├── GovUkAdviceSource.ts          # FCDO travel advice
├── NagerHolidaysSource.ts
└── registry.ts                   # lists sources incl. 006's Overpass and Frankfurter
api/src/knowledge/
├── ingest.ts                     # fetch -> chunk -> embed -> upsert by content_hash
├── chunk.ts, embed.ts, search.ts # cosine query with destination filter
└── refresh.ts                    # scheduler job + admin trigger
api/src/tools/                    # search_knowledge, recommend_destinations, get_weather, get_travel_advisory
api/src/recommendations/{discover.ts,quick.ts,refine.ts,score.ts,service.ts,routes.ts}  # candidate discovery, quick tier, background refinement, weighted blend, generation/persistence, HTTP routes (Updated 2026-10-13: routes live here, not in api/src/routes/)
api/src/knowledge/ensure.ts       # first-discussion ingestion and knowledge status
api/src/knowledge/warmup.ts       # background pre-ingestion at start (WARMUP_DESTINATIONS)
web/src/pages/search/RecommendationBand.tsx
```

**Structure Decision**: Knowledge code is separate from providers so the agent, routes and scheduler share one ingest function.

## Reconciliations With Other Documents

- **Layout**: UI-SPEC §2.4 puts the recommendation band between the header and the comparison band, three cards per row, shown only when no destination is set; selecting one sets the destination and replaces the band with the comparison band. Followed exactly.
- **Open-Meteo licence**: the free API is for non-commercial use only; README says so and the project must stay non-commercial (flagged in plan 001 R9).
- **REST Countries: dropped.** Its v3.1 API is deprecated and the replacement needs a key. Country names come from the ISO code (`Intl.DisplayNames`) and place facts from Wikidata.
- **Nager.Date** moved to `nagerholidays.com` (v4 path `/api/v4/Holidays/{CountryCode}/{Year}`); implemented against that, to be confirmed live.
- **Empty-knowledge-base weakness (owner request)**: replaced the "seed candidates from the knowledge base" idea with live candidate discovery (Wikidata + Wikivoyage), a quick tier scored from fast structured signals, and background refinement (research R8-R10). No seed data is added; the optional warm-up job only fetches from live sources.
- *Updated 2026-10-13 (implementation sync)*: the quick tier scores **season** (Open-Meteo climate for the travel month), **safety** (GOV.UK FCDO) and **activities** (Wikivoyage search rank) only. **Budget** and **transport** are always reported as Unavailable ("Could not be assessed") because no hotel-rate or fare input is used at ranking time; the comparison band supplies those figures later. Only the top 5 are refined to `full`.
- *Updated 2026-10-13*: login comes first, so every route here requires a signed-in user (the admin refresh is the only exception, guarded by `X-Admin-Token`). Home now has a Destination country dropdown, so the recommendation band appears only for a trip with no destination (for example one started from the chat chip **Recommend somewhere for me**, or after `DELETE /destination`); **See results** itself still needs a destination (`missingMinimum`).
- The knowledge-source list in the brief (Overpass, Frankfurter) is split: they are registered from plan 006 because budget and itinerary own their data.

## Complexity Tracking

| Item | Why needed | Simpler alternative rejected because |
|---|---|---|
| `node-cron` scheduler | Required by the brief | Manual-only refresh would let advisories and forecasts go stale |
