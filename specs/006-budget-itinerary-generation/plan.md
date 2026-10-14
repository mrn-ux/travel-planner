# Implementation Plan: Budget and Itinerary Generation

**Branch**: `006-budget-itinerary-generation` | **Date**: 2026-10-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-budget-itinerary-generation/spec.md`. Shared stack: [plan 001](../001-app-shell-navigation/plan.md); agent runtime: [plan 003](../003-trip-intake-conversation/plan.md); selections: [plan 005](../005-hotel-transport-comparison/plan.md); knowledge registry: [plan 004](../004-destination-recommendations/plan.md).

## Summary

The trip planner screen `/trip/:tripId`: header, conditional over-budget banner with checkable proposals and **Apply selected**, and a two-column body (itinerary beside a 320px budget column holding the budget breakdown and the selected hotels/transport lists). Budget aggregation runs **in SQL** and reports categories with no real figure. Adds the Overpass attractions source and Frankfurter exchange-rate source (registered with plan 004's registry), currency conversion from stored rates, and the tools `search_attractions`, `convert_currency`, `calculate_budget`, `create_itinerary`.

**Updated 2026-10-13 (implementation sync)**: the planner opens only after at least one place to visit has been chosen on `/search?tab=places` (plan 005); until then `/trip/:tripId` shows "Choose places to visit first" with a button to that tab. The itinerary is built from the chosen places (table `trip_places`, plan 005) and is generated automatically when the plan opens and again when the set of chosen places changes (the browser remembers which set the stored itinerary was built from; edits are kept while the set is unchanged). Chosen places whose opening hours are not stated are scheduled and marked "check before you go". The page has a hero picture of the destination. The budget column shows a total for every category plus the chosen hotel, transport and places.

## Technical Context

**Language/Version**: TypeScript 5, Node 20, React 18

**Primary Dependencies**: `fetch`; no extra libraries (itinerary scheduling is plain TypeScript; opening-hours parsing uses a small purpose-written parser for the common OSM `opening_hours` forms, see research R4)

**Storage**: PostgreSQL: `fx_rates`, `budget_items`, `budget_proposals`, `itinerary_days`, `itinerary_items`, view/function `trip_budget_summary`

**Testing**: None; manual quickstart (with SQL checks that category sums equal the total)

**Target Platform**: Podman compose

**Project Type**: Web application

**Performance Goals**: Plan generated in under 15s for up to 10 days; budget recomputed in under 300 ms after a change

**Constraints**: Money is `NUMERIC(14,2)` end to end (no JS floats); totals and remaining computed by SQL; conversions use the stored Frankfurter rate for its date and are marked `estimated`; the itinerary never schedules an activity outside its *stated* opening hours or without enough travel time (Updated 2026-10-13: a place the traveler chose that states no hours is scheduled anyway and flagged "check before you go"; no hours are invented, and without any chosen places only places with readable hours are used)

**Scale/Scope**: Up to ~10 days, ~5 items per day

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| I Simplicity | Pass | Scheduler is one function over sorted candidates; proposals are four small generators. |
| II Multi-user | Pass | All reads/writes go through the owner-checked trip. |
| III Agent discipline | Pass | Costs, hours and travel times come from provider/DB tools; the model only phrases results. |
| IV Provider abstraction | Pass | Overpass and Frankfurter are `KnowledgeSource` implementations; routing uses `TransportProvider.roadTime`. |
| V Money | Pass | `NUMERIC(14,2)`; SQL aggregation; JS handles amounts as strings and only formats. |
| VI Certainty | Pass | Every budget item and itinerary cost has its own certainty; aggregates report which categories lack a real figure. |
| VII Design fidelity | Pass | Planner per UI-SPEC §2.5 using design `DayItineraryCard` and `BudgetBreakdown`. |
| VIII No silent failure | Pass | Loading skeletons, empty states, error with retry, partial-plan notices. |

## Project Structure

### Documentation (this feature)

```text
specs/006-budget-itinerary-generation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── planner-api.md
```

### Source Code

```text
api/src/providers/knowledge/{OverpassSource.ts,FrankfurterSource.ts}   # registered in plan 004's registry
api/src/providers/knowledge/WikidataPlaces.ts                          # country-wide places (plan 005 Places tab)
api/src/budget/{recalc.ts,proposals.ts,plan.ts,convert.ts,fx.ts}      # fills budget_items from selections; builds proposals; plan.ts assembles the Plan response
api/src/itinerary/{generate.ts,hours.ts,edit.ts}                      # scheduling + opening-hours check; delete / swap
api/src/tools/{planTools.ts,convertCurrency.ts}                       # planTools.ts registers search_attractions, calculate_budget, create_itinerary
api/src/routes/plan.ts
web/src/pages/trip/{TripPlannerPage.tsx,OverBudgetBanner.tsx,ItineraryColumn.tsx,BudgetColumn.tsx,SelectedLists.tsx}
```

**Structure Decision**: Budget and itinerary are separate folders but one route file, because the planner reads both in one response.

## Reconciliations With Other Documents

- **UI-SPEC §2.5**: header (destination + dates in `2xl`, secondary **Download**; ~~ghost **Edit in chat**~~ not rendered in the current code, superseded 2026-10-13, the trip is edited from the home form or `/search`); banner shows the overage, proposals as **individually checkable rows with savings** and a primary **Apply selected** that recalculates from only the checked rows; body: flexible itinerary column + fixed 320px budget column; budget column = stacked bar, legend, totals, then **Selected hotels** and **Selected transport** lists with filled/hollow dots (filled = booked) and, added 2026-10-13, a **Places to visit** list of the chosen places (kind, entry, hours as stated or "not stated"; "None chosen yet." when empty). The spec's "individually approvable" is satisfied by per-row checkboxes plus Apply selected (nothing applied before that).
- **Download control**: rendered here, behaviour owned by plan 008.
- **Dot meaning**: hotel dot filled only when a booking is `confirmed` (plan 007); transport dot is always hollow. Updated 2026-10-13: a Duffel test flight can now be booked (constitution 3.5.0), and then the transport line says "booked, reference ..." while its dot stays hollow; a train or bus reads "compared only, not booked".

## Complexity Tracking

No violations.
