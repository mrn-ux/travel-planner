# Contract: Planner API

Conventions: [platform contract](../../001-app-shell-navigation/contracts/platform.md). Requires a signed-in user (login first); "owner" as in plan 003.

| Method & path | Auth | Request | Success | Failures |
|---|---|---|---|---|
| `GET /api/trips/:id/plan` | owner | | 200 `Plan` (the budget is recomputed on every read, so dates, travelers, selections and the itinerary are always reflected) | 404; 502/504 |
| `POST /api/trips/:id/plan/generate` | owner | `{ days?: number[] }` (regenerate some days; the web page calls it with no body, automatically, see UI) | 200 `Plan` plus `notes: string[]` | 404 destination not found; 422 no destination/dates; 502/504 attractions or travel times unavailable (the stored plan is unchanged) |
| `POST /api/trips/:id/plan/proposals/apply` | owner | `{ proposalIds: number[] }` (the checked rows) | 200 `Plan` (recomputed) | 404 unknown id; 409 proposal no longer valid |
| `POST /api/trips/:id/plan/proposals/:pid/dismiss` | owner | | 200 `Plan` | |
| `DELETE /api/trips/:id/plan/items/:itemId` | owner | | 200 `Plan` (day re-timed) | 404 |
| `POST /api/trips/:id/plan/items/:itemId/swap` | owner | `{ attractionId }` | 200 `Plan` | 422 not open/unreachable, or hours not readable (a swap target must state readable hours; the web page only offers delete) |

The chosen places the plan is built from are managed with the places endpoints in plan 005's contract (`/api/trips/:id/places*`); `GET /plan` returns them as `selectedPlaces`.

## Shapes

```ts
type Plan = {
  trip: { id: string; title: string; destination: string|null; startDate: string|null; endDate: string|null; currency: string };
  budget: {
    categories: Array<{ category: 'hotels'|'transportation'|'activities'|'food'|'local_transport'|'miscellaneous';
                        amount: string; certainty: Certainty; missingCount: number;
                        itemCount: number; share: number }>;           // itemCount 0 = no figure (em dash); share = % of the total for the bar (added 2026-10-13)
    estimatedTotal: string; budget: string | null; remaining: string | null; currency: string;
    partial: boolean; categoriesWithoutRealFigure: string[];
  };
  overBudget: { over: boolean; amount: string | null };
  proposals: Array<{ id: number; kind: string; description: string; saving: string; currency: string; certainty: Certainty }>;
  itinerary: Array<{
    day: number; date: string; place: string|null;
    items: Array<{ id: number; slot: 'morning'|'afternoon'|'evening'; kind: 'activity'|'meal'|'rest'; title: string;
                   startsAt: string|null; durationMinutes: number|null;
                   cost: { amount: string|null; currency: string|null; certainty: Certainty };
                   openingHours: string|null; travelMinutesToNext: number|null; travelCertainty: Certainty|null;
                   source: string; sourceUrl: string|null }>;
  }>;
  // Updated 2026-10-13 (itinerary items also carry `openingHours: null` for a chosen place that does not state its hours):
  selectedHotel: { hotelId: string|null; name: string; booked: boolean; roomName: string|null; checkin: string; checkout: string;
                   price: Priced; total: Priced; sandbox: true } | null;      // a confirmed booking takes precedence over a selected room
  selectedTransport: { label: string; mode: string; operator: string|null; departureAt: string|null; price: Priced; scheduleCertainty: Certainty;
                       bookable: boolean; booked: boolean; bookingReference: string|null } | null;   // bookable only for a Duffel test flight
  selectedPlaces: Array<{ id: string; name: string; kind: string; openingHours: string|null;
                          entry: { kind: 'free'|'paid'|'unknown'; charge: string|null } }>;
  notes?: string[];                                                          // generate only, e.g. "Some chosen places do not state their opening hours ..."
  generatedAt: string;
};
```

`itinerary[].note` carries the arrival-day and departure-day notes. Transport is counted for the outbound and, when the trip has an end date, the return leg (same price assumed).

All amounts are decimal strings computed by the database; `overBudget.over` is `remaining < 0` computed in SQL.

## Agent tools

| Tool | Arguments | Result |
|---|---|---|
| `search_attractions` | `{ query?, limit? }` | attractions with `openingHours`, `openingHoursReadable`, `fee`, coordinates, provenance (Overpass) |
| `convert_currency` | `{ amount: string, from, to, date? }` | `{ converted: string, rate, rateDate }`, certainty `estimated`; `unavailable` if no stored rate |
| `calculate_budget` | `{}` (trip implied) | the `budget` block above plus `proposals` |
| `create_itinerary` | `{ days?: number[] }` | the `itinerary` block |

## UI (UI-SPEC §2.5)
- Updated 2026-10-13 (gate and auto-generate): with no chosen place the page shows "Choose places to visit first" and a **Choose places to visit** button (to `/search?tab=places`) and loads no plan. Otherwise, opening the page builds the itinerary automatically when there is none, when no activity was scheduled, or when the chosen places changed since it was built; while it runs the column says it is building from the chosen places; on failure it shows "The itinerary could not be built this time." with **Try again**. A hero picture of the destination sits above the header.
- Header: destination + dates in `2xl`; right: secondary **Download** (plan 008). ~~ghost **Edit in chat**~~ (not rendered in the current code).
- Banner (only while `overBudget.over`): `over-budget` styling, overage text, a checkbox row per proposal with its saving, primary **Apply selected** (disabled until something is checked). Hidden when within budget.
- Body: itinerary cards (design `DayItineraryCard`) beside a 320px column: `BudgetBreakdown` (stacked bar in the fixed chart colours, legend, totals), then **Selected hotels** and **Selected transport** with dots, then **Places to visit** (the chosen places).
- Categories without any figure show an em dash; a category with some unavailable items shows its sum followed by "(partial)". The card shows the Estimated total, Budget and Remaining, and a note that food, local transport and miscellaneous are Faro estimates and hotel rates are sandbox rates.
- An activity for a place with no stated hours shows "Opening hours not stated: check before you go".
- States: skeleton cards and bar while loading; "No itinerary yet: choose a destination and dates" when empty (or the generation notes when places were chosen but none could be scheduled); "Select a hotel and transport to complete your budget" for missing categories; error with Retry keeping the last plan visible.
