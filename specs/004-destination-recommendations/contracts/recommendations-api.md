# Contract: Recommendations and Knowledge API

Conventions: [platform contract](../../001-app-shell-navigation/contracts/platform.md). "Owner" as in plan 003.

| Method & path | Auth | Request | Success | Failures |
|---|---|---|---|---|
| `GET /api/trips/:id/recommendations` | owner | | 200 `{ status, refining, limited, recommendations, insufficient?, note? }` (`limited`: refinement failed, "Based on limited data"; `note`: the season check was relaxed) where `status` is `loading` (nothing scored yet), `partial` (quick tier available, refining), `ready` (refined) or `insufficient` (names the limiting factor and how many were found) | 404; 502/504 |
| `POST /api/trips/:id/recommendations/refresh` | owner | `{ excluded?: string[] }` | 200 same shape (new ranking; dismissed destinations excluded) | 502/504 |
| `PUT /api/trips/:id/destination` | owner | `{ destination, countryCode? }` | 200 `{ trip }` (resolves the place via Open-Meteo geocoding, stores country code, coordinates, `dest_city` and `dest_country_name`; triggers ingestion if needed; `countryCode` is accepted but not used) | 400 place not found |
| `DELETE /api/trips/:id/destination` | owner | | 200 `{ trip }` (returns the screen to recommendations) | |
| `GET /api/knowledge/status?destination=` | session (Updated 2026-10-13: login first) | | 200 `{ destination, sources: [{ source, status, lastOk }] }` | |
| `POST /api/admin/refresh` | header `X-Admin-Token` | | 202 `{ started: true }` | 404 when `ADMIN_TOKEN` unset; 401 wrong token |

## Recommendation shape

```ts
type Recommendation = {
  rank: number; destination: string; countryCode: string | null; score: number; // 0-100
  completeness: 'quick' | 'full'; previousRank?: number;   // previousRank set when refinement moved it
  reasons: Array<{
    factor: 'budget' | 'season' | 'activities' | 'transport' | 'safety';   // budget and transport are always 'unavailable' today (Updated 2026-10-13)
    text: string;                 // "Could not be assessed" when data unavailable
    certainty: 'confirmed' | 'estimated' | 'unavailable';
    source: string; source_url: string | null; fetched_at: string | null;
    attribution?: string;         // licence credit for guide-derived text
  }>;
};
```

## Agent tools (registered in `api/src/agent/registry.ts`)

| Tool | Arguments | Result `data` |
|---|---|---|
| `search_knowledge` | `{ destination: string, query: string, limit?: number (≤8) }` | `[{ title, text, source, source_url, licence, attribution, fetched_at, expired: boolean, similarity }]`, certainty `estimated` if any item expired |
| `recommend_destinations` | `{ limit?: number (≤8) }` (uses the trip brief; offered to the chat model only when `recommendRequested` is set) | `Recommendation[]`, certainty `estimated`, note says budget and transport are not assessed |
| `get_weather` | `{ destination: string, start?: date, end?: date }` | daily forecast or climate normals |
| `get_travel_advisory` | `{ countryCode: string }` | `{ summary, alertStatus[], updatedAt }` |

All four return the standard envelope; an upstream failure yields `certainty: 'unavailable'`.

## UI (UI-SPEC §2.4, recommendation band)
- Cards three per row on desktop, one on mobile, ranked, each with reason list and score bar from the design system's DestinationCard.
- States: skeleton cards while `loading`; cards with a "Refining..." note while `partial` (rank changes highlighted when refinement completes); "Based on limited data" if refinement failed; "No destinations fit this trip yet — <limiting factor>" for `insufficient`; error with Retry.
- Selecting a card calls `PUT /destination`, then the band is replaced by the Hotels/Transport comparison band (plan 005).
- Attribution line under any guide-derived text: source name, link and licence.
