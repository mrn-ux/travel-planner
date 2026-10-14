# Implementation Plan: My Trips and Plan Downloads

**Branch**: `008-my-trips-downloads` | **Date**: 2026-10-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-my-trips-downloads/spec.md`. Shared stack: [plan 001](../001-app-shell-navigation/plan.md); auth: [plan 002](../002-authentication-sessions/plan.md); plan data: [plan 006](../006-budget-itinerary-generation/plan.md); bookings: [plan 007](../007-booking-confirmation/plan.md).

## Summary

The `/trips` screen (grid of trip cards with Open and Download) and the plan download: a PDF generated on every request from the trip's current database state (destination, dates, day-by-day itinerary, selected hotel and transport, budget breakdown, with certainty labels). No new tables: both features read what plans 003–007 store.

> Updated 2026-10-13: the page also lets the owner **delete** a trip that has no booking (`DELETE /api/trips/:id`, refused with 409 `has_booking` otherwise), the cards show hotel room and total, the transport line with a booked flight's reference, chosen places and the budget, and the page opens with a hero band ("Your adventures") above the *My trips* heading.

## Technical Context

**Language/Version**: TypeScript 5, Node 20, React 18

**Primary Dependencies**: `pdfkit` (pure JavaScript PDF generation, streamed to the response)

**Storage**: Reads `trips`, `trip_hotels`, `trip_transport`, `trip_places`, `itinerary_*`, `budget_*` (via `trip_budget_summary`), `bookings`, `flight_bookings`. The PDF and the list write nothing (the list first recalculates each trip's budget through `recalcBudget`, which refreshes budget rows); only the delete endpoint removes rows (Updated 2026-10-13)

**Testing**: None; manual quickstart (open the PDF and compare with the planner)

**Target Platform**: Podman compose; downloads handled by the browser

**Project Type**: Web application

**Performance Goals**: List loads in under 1s for 50 trips; PDF ready in under 10s for a 10-day trip (target well under 3s since nothing is fetched from providers)

**Constraints**: The file is generated fresh per request with no stored copy; money comes from SQL as decimal strings; nothing renders NaN/undefined/null/invalid dates; no other user's data is ever reachable

**Scale/Scope**: Tens of trips per user

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| I Simplicity | Pass | One list query, one PDF function; no storage, queue, or template engine. |
| II Multi-user | Pass | The list and delete endpoints require a session and filter by `user_id`; `plan.pdf` resolves the trip through the owner check (session; the planner's draft key is still accepted by `ownerOf`); an unowned trip is a 404. |
| III Agent discipline | n/a | No agent involvement; the file reproduces stored, labelled data. |
| IV Provider abstraction | Pass | No providers called at all. |
| V Money | Pass | Amounts printed from SQL strings via the shared formatter; no arithmetic in JS. |
| VI Certainty | Pass | Every price/schedule printed with its Confirmed/Estimated/Unavailable label; missing sections say "not yet available". |
| VII Design fidelity | Pass | Cards follow UI-SPEC §2.8 and the design `Card`/`KPICard`; the PDF uses the system's wording and format rules (PDF typography is not specified by the mockups). |
| VIII No silent failure | Pass | Loading skeleton, empty state, error with retry; failed download shows a message and no partial file. |

## Project Structure

### Documentation (this feature)

```text
specs/008-my-trips-downloads/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── trips-api.md
```

### Source Code

```text
api/src/trips/listTrips.ts           # one SQL query -> trip cards
api/src/trips/{routes.ts,service.ts}  # GET /api/trips, DELETE /api/trips/:id (deleteTrip), Updated 2026-10-13
api/src/plan-file/{buildPlanData.ts,renderPdf.ts,format.ts}
api/src/routes/planFile.ts
web/src/pages/trips/{MyTripsPage.tsx,TripCard.tsx}
web/src/components/PageHero.tsx      # hero band with a destination photo
web/src/lib/{myTrips.ts,download.ts}   # list/delete calls; download = fetch with auth header -> blob -> save (usePlanDownload)
```

**Structure Decision**: `buildPlanData` collects plain data from SQL; `renderPdf` only lays it out, so the planner download button and the My trips card share one path.

## Reconciliations With Other Documents

- **UI-SPEC §2.8**: a single band with the title *My trips* in `2xl` and a grid of cards, three per row desktop, one on mobile, 16px apart; each card is a design-system Card with destination(s) and date range as the title, a one-line booking-status summary with filled/hollow dots for hotels and transport, the estimated total as a KPI-style value, a primary **Open** and a secondary **Download**; empty state with a primary button to `/`. Followed, plus (Updated 2026-10-13) a ghost **Delete** on trips without bookings, and a hero band (`PageHero`, title "Your adventures") above the *My trips* heading, added by the 2026-10-13 visual refresh (CLAUDE.md design amendment). The empty-state text is now "Your travel story starts here. Plan your first trip and it will wait for you in this space." with the **Plan a trip** button.
- **Trip route**: Open goes to `/trip/:tripId` (UI-SPEC), not a separate route.
- **SCOPE §8**: download is generated on request from current data, not kept in sync — matches the "fresh on every request" requirement.
- **Download format**: spec 008 assumed PDF; confirmed here.
- **Transport status**: trains and buses are never booked. The dot is filled only when a flight is booked in test mode (the card then says "Flight booked" with its reference, taken from the confirmed `flight_bookings` row); otherwise it is hollow and the card shows the selected option or "Transport: not selected". (Updated 2026-10-13: before the flight work the dot was always hollow.)
- **Deleting** (Updated 2026-10-13): a trip with a confirmed or pending hotel booking (or a refund pending) or a confirmed flight cannot be deleted. The card hides **Delete** and says "A trip with a booking cannot be deleted."; the API enforces the same rule (409 `has_booking`) in `deleteTrip`. Other trips are deleted with everything planned on them after a confirmation dialog.

## Complexity Tracking

No violations.
