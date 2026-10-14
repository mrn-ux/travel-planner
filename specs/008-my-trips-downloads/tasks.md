---
description: "Task list for My Trips and Plan Downloads"
---

# Tasks: My Trips and Plan Downloads

**Input**: `/specs/008-my-trips-downloads/` (plan.md, spec.md, research.md, data-model.md, contracts/trips-api.md, quickstart.md)

**Prerequisites**: plan 001 Phases 1-2; plan 002 `requireUser`; plan 003 trips; plan 006 `trip_budget_totals`, itinerary tables and plan response; plan 007 `bookings`; plan 005 selections. No new tables.

**Tests**: None (manual `quickstart.md`).

**Format**: `- [ ] T### [P?] [US#?] Description with file path`

---

## Phase 1: Setup

- [X] T001 Add `pdfkit` (and `@types/pdfkit`) to `api/package.json`
- [X] T002 [P] (Inter from `@fontsource/inter`, WOFF, OFL 1.1: Latin and Latin Extended subsets, text drawn in runs) Decide and bundle one open-licence TTF font (Latin plus extended coverage) in `api/assets/fonts/` and note its licence in `README.md` (research R1)

---

## Phase 2: Foundational

- [X] T003 Implement `api/src/plan-file/format.ts`: server-side `formatMoney`, `formatDate`, `formatDuration` equivalent to `web/src/lib/format.ts` (shared rules: em dash for missing values, never `NaN`/`undefined`/`null`/`Invalid Date`)
- [X] T004 Implement `api/src/plan-file/buildPlanData.ts` `buildPlanData(tripId)`: in one transaction read the trip brief, selected hotel/transport, latest booking, itinerary days/items, `trip_budget_summary`/`trip_budget_totals`, returning plain data with currency, certainty and source on every price

---

## Phase 3: User Story 1 - Review and open saved trips (Priority: P1) MVP

**Goal**: one card per saved trip with accurate status.

**Independent Test**: three trips in different states; cards accurate; **Open** goes to the right planner.

- [X] T005 [US1] Implement `api/src/trips/listTrips.ts`: one SQL statement for `WHERE trips.user_id = $1 AND trips.status <> 'draft' ORDER BY trips.updated_at DESC` with `LEFT JOIN LATERAL` for the latest booking and `trip_budget_totals(trip.id)`, mapping to `TripCard` per `contracts/trips-api.md` (hotel status `not_booked|pending|confirmed|failed`, transport `compare_only|not_selected`)
- [X] T006 [US1] Implement `GET /api/trips` in `api/src/trips/routes.ts` behind `requireUser` (note: plan 003 owns `/api/trips` POST/GET by id; register the list route before `/:id`)
- [X] T007 [US1] Build `web/src/pages/trips/TripCard.tsx` per UI-SPEC 2.8 and frame 1o: design `Card` with destination(s) and date range as the title (or "Destination not chosen"), one-line status with filled/hollow dots (hotel filled only when confirmed, transport hollow), the estimated total as a `KPICard` with certainty badge and "Partial" note, primary **Open** (`/trip/:tripId`) and secondary **Download**
- [X] T008 [US1] Build `web/src/pages/trips/MyTripsPage.tsx`: title *My trips* (`2xl`), grid of cards three per row desktop and one on mobile (frame M7), 16 px gaps, wrapped in `RequireAuth`, with skeleton cards while loading and an error with Retry

---

## Phase 4: User Story 2 - Download the current plan (Priority: P1)

**Goal**: a fresh PDF on every request.

**Independent Test**: download, change the trip, download again; the second file reflects the change; all sections present.

- [X] T009 [US2] Implement `api/src/plan-file/renderPdf.ts` with `pdfkit` (embedded font): title with destination/dates/travelers/budget currency, selected hotel (price, certainty, booking status/reference), selected transport ("Compare only", estimated price labelled with its basis), day-by-day itinerary (Morning/Afternoon/Evening, time, duration, cost + certainty, opening hours, travel minutes), budget breakdown (six categories, estimated total, budget, remaining, categories without a real figure, "partial" note), footer (generation time, certainty note, sandbox note, source attributions); "Not yet available" for empty sections
- [X] T010 [US2] Implement `GET /api/trips/:id/plan.pdf` in `api/src/routes/planFile.ts`: owner check (session or draft key, else 404), stream `application/pdf` with `Content-Disposition: attachment` and a sanitised filename, no stored copy, 500 `{ error }` with no partial file on failure
- [X] T011 [US2] Implement `web/src/lib/download.ts`: authenticated fetch to a blob and save via an object URL, button state "Preparing your plan" disabled until done, ignore repeated clicks, inline error with Retry, 401 follows the shared redirect
- [X] T012 [US2] Wire **Download** on each `TripCard.tsx`
- [X] T013 [US2] Wire the planner header **Download** button in `web/src/pages/trip/TripPlannerPage.tsx` (plan 006) to the same `download.ts`

---

## Phase 5: User Story 3 - Empty and new states (Priority: P2)

**Goal**: first-run experience.

**Independent Test**: a new account sees the empty state and the button goes to `/`.

- [X] T014 [US3] Add the empty state to `MyTripsPage.tsx` using `EmptyState`: "No trips yet - plan your first one." with a primary **Plan a trip** button to `/`
- [X] T015 [US3] Make a trip that has no destination or no itinerary still download and render sensible cards (em dashes, "Not yet available"), verifying the PDF for an empty trip

---

## Phase 6: Polish

- [X] T016 [P] Search the PDF text of three sample trips for `NaN`, `undefined`, `null`, `Invalid Date` (none allowed) and confirm money/date/duration formats
- [X] T017 [P] Verify isolation: a second account gets 404 for another user's `plan.pdf` and `GET /api/trips` lists only its own trips
- [X] T018 Run every step of `specs/008-my-trips-downloads/quickstart.md` and fix failures
- [X] T019 [P] (desktop checked in the browser against frame 1o; mobile is a single column; not compared frame by frame against M7) Run `scripts/check-tokens.sh` and compare the page with frames 1o and M7

---

## Phase 7: Sync with the 2026-10-13 implementation

- [X] T020 [US1] Show booked flights on the card: `listTrips.ts` reads the confirmed `flight_bookings` reference; `TripCard.tsx` fills the transport dot and says "Flight booked" with the reference; places and budget lines added
- [X] T021 [US1] Delete a trip: `deleteTrip` in `api/src/trips/service.ts` and `DELETE /api/trips/:id` in `api/src/trips/routes.ts` (409 `has_booking` with a confirmed or pending hotel booking or a confirmed flight); `TripCard.tsx` ghost **Delete** with a confirmation `Modal`, hidden for trips with bookings; `deleteMyTrip` in `web/src/lib/myTrips.ts`
- [X] T022 [US1] `MyTripsPage.tsx`: `PageHero` band above the *My trips* heading (visual refresh); updated empty-state text; `listTrips` recalculates each trip's budget before reading

---

## Dependencies & Execution Order

- Phase 1 -> Phase 2 -> Phase 3 (MVP) -> Phase 4 -> Phase 5 -> Phase 6. Phases 3 and 4 can overlap after T004.
- T004 needs plan 006's tables/functions and plan 007's `bookings`; T013 needs plan 006's planner page.

## Parallel Opportunities

T002; T003 with T004; T007 with T005-T006; T016, T017, T019.

## Implementation Strategy

MVP = Phases 1-3 (list and open). Add the PDF download (Phase 4) next, then the empty-state polish (Phase 5).
