# Contract: Trip and Conversation API

Conventions: [platform contract](../../001-app-shell-navigation/contracts/platform.md). "Owner" means the signed-in user (`Authorization`). *Updated 2026-10-13*: every route requires a signed-in user (login first); `X-Trip-Key` drafts are no longer produced.

| Method & path | Auth | Request | Success | Failures |
|---|---|---|---|---|
| `POST /api/trips` | required (login first) | `{}` or initial brief | 201 `{ trip }` | 400, 401 |
| `GET /api/trips/:id` | owner | | 200 `{ trip, missing: string[] }` | 404 (also when not the owner) |
| `PATCH /api/trips/:id` | owner | partial brief | 200 `{ trip, missing }` | 400 field errors; 409 dates/duration disagree |
| `GET /api/trips/:id/messages` | owner | | 200 `{ messages: Message[] }` | 404 |
| `POST /api/trips/:id/messages` | owner | `{ text }` (1–4000 chars, not blank) | 200 `{ userMessage, agentMessage, trip, missing }` | 400; 502/504 agent unavailable (the user message is still stored) |
| `POST /api/trips/:id/messages/retry` | owner | | 200 same as above | 409 nothing to retry; 502/504 |
| `GET /api/trips` | session | | 200 `{ trips }` (My trips) | 401 |
| `DELETE /api/trips/:id` | session | | 204 | 404; 409 `has_booking` when a booking exists |
| `GET /api/trips/latest` | session | | 200 `{ trip, missing }` for the signed-in user's most recently updated trip | 404 |
| `POST /api/trips/claim` | session | `{ tripKey }` | 200 `{ trip }` | 404 (superseded: kept for old drafts, no client produces a key) |

## Shapes

```ts
type Trip = {
  id: string; status: 'draft'|'saved'|'booked'; title: string|null;
  destination: string|null; recommendRequested: boolean;
  destinationCity: string|null; destinationCountry: string|null;   // names (Updated 2026-10-13)
  originCity: string|null; originCountry: string|null;
  startDate: string|null; endDate: string|null; dateWindowText: string|null; durationDays: number|null;
  adults: number|null; childrenAges: number[];
  budget: { amount: string; currency: string; source: 'user'; certainty: 'confirmed' } | null;
  transportPreference: string|null; accommodationPreference: string|null;
  interests: string|null; specialRequirements: string|null;
};
type Message = { id: number; role: 'user'|'agent'; content: string; cards: Card[]|null; createdAt: string };
```

`missing` lists the minimum fields not yet set (`destinationOrRecommend`, `datesOrDuration`, `travelers`, `budget`, and since 2026-10-13 `transport`, `accommodation`); **See results** is enabled when it is empty and every child's age is entered. `datesOrDuration` is missing until both start and end dates are set.

The PATCH body also accepts `destinationCity`, `destinationCountry`, `originCity`, `originCountry` (a city without its country is a 400). Country and city lists for the form come from `GET /api/places/countries`, `GET /api/places/cities?country=CC` and `GET /api/places/currencies` (country to currency).

## Rules
- The API never returns Ollama configuration or model names.
- A failed agent call returns an error but the stored user message stays; `retry` re-runs the last turn.
- `cards` elements always carry the provenance envelope for any figure they show.
