---
description: "Task list for Budget and Itinerary Generation"
---

# Tasks: Budget and Itinerary Generation

**Input**: `/specs/006-budget-itinerary-generation/` (plan.md, spec.md, research.md, data-model.md, contracts/planner-api.md, quickstart.md)

**Prerequisites**: plan 001 Phases 1-2; plan 003 trips/agent registry; plan 004 `registry.ts` (to register Overpass and Frankfurter); plan 005 selections and `fareEstimate.ts` and `TransportProvider.roadTime`.

**Tests**: None (manual `quickstart.md`).

**Format**: `- [ ] T### [P?] [US#?] Description with file path`

---

## Phase 1: Setup

- [X] T001 Append the 006 DDL fragment from `data-model.md` (`fx_rates`, `budget_items`, `budget_proposals`, `itinerary_days`, `itinerary_items`, functions `trip_budget_summary`, `trip_budget_totals`, `convert_amount`) to `db/init.sql`

---

## Phase 2: Foundational

**CRITICAL**: complete before any user story.

- [X] T002 [P] Implement `api/src/providers/knowledge/FrankfurterSource.ts`: fetch `https://api.frankfurter.dev/v2/rates` for the needed base (parameter `quotes`, `providers=ecb` if accepted; confirm the live v2 contract first), store rows in `fx_rates` with `source_url` and `fetched_at`, 24 h lifetime; register it in `api/src/providers/knowledge/registry.ts`
- [X] T003 [P] (Updated 2026-10-13: tries four public Overpass instances in order; adds `fetchPlaces` for the Places tab and `fetchDetailsNear`, see research implementation notes) Implement `api/src/providers/knowledge/OverpassSource.ts`: `POST https://overpass-api.de/api/interpreter` for `tourism=attraction`, `historic`, `museum` around the destination coordinates (`out center tags`, 25 s timeout, identifying User-Agent, serial, wait 30 s after 429), keep `name`, `opening_hours`, `fee`, `wikidata`, coordinates, 7-day lifetime, "© OpenStreetMap contributors (ODbL)" attribution; register it in the registry
- [X] T004 [P] Implement `api/src/itinerary/hours.ts`: parse common OSM `opening_hours` forms (`Mo-Fr 09:00-17:00; Sa 10:00-14:00; Su off`, `24/7`, `PH off` using Nager.Date holiday chunks) and `isOpen(parsed, weekday, start, end)`; unparseable input makes the attraction ineligible
- [X] T005 Implement `api/src/budget/convert.ts` calling the SQL function `convert_amount` and `api/src/tools/convertCurrency.ts` (returns `estimated`, or `unavailable` when no stored rate); register the tool

---

## Phase 3: User Story 1 - See the running budget (Priority: P1) MVP

**Goal**: category breakdown with totals computed by SQL.

**Independent Test**: category sums equal the total and remaining equals budget minus total in `psql` and in the UI.

- [X] T006 [US1] Implement `api/src/budget/recalc.ts` `recalcBudget(tripId)`: rebuild `budget_items` from the selected hotel (nights x nightly + taxes), selected transport (real fare or fare estimate), itinerary activity costs, food estimate (per-person daily allowance), local transport estimate, miscellaneous percentage (one constant, default 5%), converting with `convert_amount` into the trip currency; unavailable costs are stored with `amount_trip NULL`
- [X] T007 [US1] Implement the `calculate_budget` tool (in `api/src/tools/planTools.ts`) and the budget part of `GET /api/trips/:id/plan` in `api/src/routes/plan.ts` using `trip_budget_summary` and `trip_budget_totals`, returning `categoriesWithoutRealFigure`, `partial`, and `overBudget` (computed in SQL); no money arithmetic in TypeScript
- [X] T008 [US1] Call `recalcBudget` from the selection routes (plan 005 `PUT/DELETE .../selection/*`) and from itinerary edits so the breakdown always updates
- [X] T009 [P] [US1] Build `web/src/pages/trip/BudgetColumn.tsx`: Card with `BudgetBreakdown` (stacked bar in the fixed chart colours, legend, Estimated total / Budget / Remaining in over-budget or under-budget colour), em dash plus Unavailable badge for categories without a real figure, "partial total" note, 320 px column
- [X] T010 [P] [US1] Build `web/src/pages/trip/SelectedLists.tsx`: **Selected hotels** and **Selected transport** with filled dot only for a confirmed booking (hotel) and always hollow for transport, per frame 1g

---

## Phase 4: User Story 3 - Day-by-day itinerary (Priority: P1)

**Goal**: morning/afternoon/evening days that respect opening hours and travel time.

**Independent Test**: no activity violates opening hours or travel time; meals and rests appear.

- [X] T011 [US3] Implement `api/src/itinerary/generate.ts` per research R5: candidate attractions ranked by interest similarity (embeddings from plan 003/004) and Wikidata presence, slots morning 09:00-12:30, afternoon 14:00-18:00, evening 19:00-22:00, lunch and dinner blocks, at least one rest block per day, travel minutes from `TransportProvider.roadTime`, accept a stop only if travel fits and the visit lies inside parsed hours that weekday, first/last day aligned to the selected transport times when known, store rows in `itinerary_days`/`itinerary_items` with `opening_hours_checked` (Updated 2026-10-13: candidates are the chosen places in `trip_places`; places with unstated hours are planned with `opening_hours_checked = false`; the first/last-day alignment to transport times was replaced by arrival/departure-day notes; see T024)
- [X] T012 [US3] Implement the `search_attractions` and `create_itinerary` tools (both in `api/src/tools/planTools.ts`, together with `calculate_budget`; separate files were not created), register both, and add the itinerary part of `GET /api/trips/:id/plan` plus `POST /api/trips/:id/plan/generate` in `api/src/routes/plan.ts`
- [X] T013 [US3] Implement `DELETE /api/trips/:id/plan/items/:itemId` and `POST /api/trips/:id/plan/items/:itemId/swap` (re-time the day, refuse a closed/unreachable swap with 422) in `api/src/routes/plan.ts`, then call `recalcBudget`
- [X] T014 [P] [US3] Build `web/src/pages/trip/ItineraryColumn.tsx`: one `DayItineraryCard` per day in date order with morning/afternoon/evening, duration, cost + badge, opening-hours note, travel-time connector, meal/rest blocks, rest-day card, skeleton and empty states ("No itinerary yet - choose a destination and dates")

---

## Phase 5: User Story 2 - Resolve an overspend (Priority: P1)

**Goal**: banner with individually checkable proposals and **Apply selected**.

**Independent Test**: over budget -> banner with savings; apply one; only it applies; banner hides once within budget.

- [X] T015 [US2] Implement `api/src/budget/proposals.ts`: generators for lower hotel tier (cheaper hotel with a live confirmed rate), train instead of flight (only when a train price is known and arrives in time), fewer paid attractions (highest known fees), different dates (+/- 3 days with live rate lookups); each returns `{ kind, description, saving (SQL difference), currency, certainty, payload }` and is not offered when the saving cannot be established from real figures
- [X] T016 [US2] Implement `POST /api/trips/:id/plan/proposals/apply` (transaction applying only the checked ids, recompute, 409 if no longer valid) and `POST .../proposals/:pid/dismiss` in `api/src/routes/plan.ts`; include `proposals` in the plan response while over budget
- [X] T017 [US2] Build `web/src/pages/trip/OverBudgetBanner.tsx` per UI-SPEC 2.5 and frame 1g: `over-budget` styling, overage text, one checkbox row per proposal with its saving, primary **Apply selected** (disabled until something is checked), hidden when within budget, message "no savings could be established" when empty

---

## Phase 6: User Story 4 - Planner layout (Priority: P2)

**Goal**: header, conditional banner, two-column body.

**Independent Test**: bands appear in the right order in both over- and under-budget states.

- [X] T018 [US4] Build `web/src/pages/trip/TripPlannerPage.tsx` for `/trip/:tripId` per UI-SPEC 2.5 and frames 1g/M4: header with destination and dates in `2xl`, secondary **Download** (behaviour from plan 008 T015) and ~~ghost **Edit in chat** (navigates to `/?tripId=`)~~ (not rendered in the current code, 2026-10-13), the banner, then a grid of flexible itinerary column and fixed 320 px budget column (stacking on mobile), bands 24 px apart
- [X] T019 [US4] Wire loading, empty ("Select a hotel and transport to complete your budget"), and error-with-retry (keeping the last plan visible) states in `TripPlannerPage.tsx`

---

## Phase 7: Polish

- [X] T020 [P] In `psql` verify `SELECT * FROM trip_budget_summary(...)` and `trip_budget_totals(...)` agree with the UI strings for three trips (complete, partial, converted currency)
- [X] T021 [P] Block the Overpass host and confirm generation reports attractions Unavailable with no invented activities and the last good plan retained
- [X] T022 Run every step of `specs/006-budget-itinerary-generation/quickstart.md` and fix failures
- [X] T023 [P] Run `scripts/check-tokens.sh` and compare the planner with frames 1g and M4

---

## Phase 8: Implementation sync (Updated 2026-10-13)

- [X] T024 [US3] Build the itinerary around the chosen places: `generate.ts` reads `trip_places`, plans places with unstated hours as "check before you go" (`opening_hours_checked = false`), adds generation `notes`, uses one `roadMatrix` call; the `CHECK (kind <> 'activity' OR opening_hours_checked)` in `db/init.sql` was dropped; `ItineraryColumn.tsx` shows "Opening hours not stated: check before you go"
- [X] T025 [US4] Gate and auto-generate in `TripPlannerPage.tsx`: "Choose places to visit first" until a place is chosen (plan 005 Places tab); the itinerary is generated automatically when absent, when no activity was scheduled, or when the set of chosen places changed (signature kept in the browser); failure shows "Try again"; destination hero picture
- [X] T026 [US1] Budget totals: `api/src/budget/plan.ts` `buildPlan` recomputes the budget on every read and returns `itemCount`, `share`, `selectedPlaces`, booking-aware `selectedHotel`/`selectedTransport`; `BudgetColumn.tsx` shows each category (em dash when empty, "(partial)" when some items are unavailable) and the Estimated total, Budget and Remaining; `SelectedLists.tsx` adds the Places to visit list

---

## Dependencies & Execution Order

- Phase 8 (T024-T026) follows Phase 7 and needs plan 005 T034 (chosen places).
- Phase 1 -> Phase 2 -> Phase 3 (MVP) -> Phase 4 -> Phase 5 -> Phase 6 -> Phase 7. Phases 3 and 4 can overlap after T006; T015 needs T011 and plan 005's search tools.
- T002 and T003 need plan 004's `registry.ts`; T006 needs plan 005's selections and `fareEstimate.ts`; T011 needs T003, T004 and `roadTime`.
- Plan 008 reads `trip_budget_totals` (T001) and the plan response.

## Parallel Opportunities

T002, T003, T004; T009, T010; T014; T020, T021, T023.

## Implementation Strategy

MVP = Phases 1-3 (budget visible and correct). Then the itinerary (Phase 4), then proposals (Phase 5), then assemble the planner page (Phase 6; T018 can start earlier with placeholders).
