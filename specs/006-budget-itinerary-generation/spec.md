# Feature Specification: Budget and Itinerary Generation

> Amended 2026-10-13 (implementation sync): The itinerary is built around the places the traveler chose; places whose opening hours are not stated may be scheduled and are marked 'check before you go' rather than blocking the plan. The plan is generated automatically when the trip plan opens and again when the chosen places change. The budget column shows the total for every category, the chosen hotel and transport, and marks partial totals.

**Feature Branch**: `006-budget-itinerary-generation`

**Created**: 2026-10-10

**Status**: Draft

**Input**: User description: "A running budget broken down by hotels, transportation, activities, food, local transport and miscellaneous, compared against the stated total. When the plan exceeds budget, the engine proposes specific, individually approvable changes and shows the resulting saving before anything is applied. A day-by-day itinerary with morning, afternoon and evening activities, each with an estimated duration and cost, travel time to the next stop, and meal or rest breaks. The agent never schedules something closed, unreachable in time, or outside its opening hours. The trip planner shows a header, an over-budget banner shown only while over budget, and a two-column body."

## Goal

Show the traveler what their trip will cost against what they said they can spend, help them fix an overspend with changes they approve one by one, and lay out a realistic day-by-day itinerary.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the running budget (Priority: P1)

On the trip planner, a budget breakdown shows amounts for hotels, transportation, activities, food, local transport and miscellaneous, with the estimated total, the stated budget and the remaining amount. Remaining is clearly positive or negative.

**Why this priority**: Budget is the traveler's main constraint and the planner's central number.

**Independent Test**: Open the planner for a trip with a selected hotel and transport; confirm category amounts add up to the total and the remaining equals budget minus total.

**Acceptance Scenarios**:

1. **Given** a trip with selections and an itinerary, **When** the planner opens, **Then** the breakdown shows all six categories, the estimated total, the budget and the remaining amount.
2. **Given** any amount in the breakdown, **When** displayed, **Then** it carries a Confirmed, Estimated or Unavailable label and category amounts sum exactly to the total.
3. **Given** the remaining amount is negative, **When** shown, **Then** it is displayed in the over-budget style; when positive, in the under-budget style.
4. **Given** a selection or itinerary item changes, **When** the change is applied, **Then** the breakdown updates immediately.

---

### User Story 2 - Resolve an overspend with approvable changes (Priority: P1)

When the plan exceeds the budget, a banner appears above the body listing specific proposed changes — for example a lower hotel tier, train instead of flight, fewer paid attractions, different dates — each with the saving it would produce. The traveler approves any of them individually; nothing changes until approved.

**Why this priority**: It turns a dead end ("too expensive") into a guided decision.

**Independent Test**: Make a trip over budget; confirm the banner lists changes with savings; approve one and confirm only that change applies and the totals update.

**Acceptance Scenarios**:

1. **Given** the plan exceeds budget, **When** the planner opens, **Then** the banner shows the overspend amount and a list of proposed changes, each with its saving.
2. **Given** a proposed change, **When** the traveler approves it, **Then** only that change is applied, the budget and itinerary update, and the banner reflects the new overspend.
3. **Given** a proposed change, **When** the traveler dismisses it, **Then** it is removed from the list and nothing else changes.
4. **Given** the plan is within budget, **When** the planner opens or becomes within budget after a change, **Then** the banner is not shown.
5. **Given** a change would break a rule (for example a train that cannot arrive in time), **When** proposals are built, **Then** it is not offered.

---

### User Story 3 - Read a day-by-day itinerary (Priority: P1)

The itinerary, beside the budget breakdown, has one card per day split into morning, afternoon and evening. Each activity shows its title, estimated duration and cost, opening-hours note when relevant, and the travel time to the next stop; meal and rest breaks are placed between activities.

**Why this priority**: The itinerary is the plan itself.

**Independent Test**: Generate an itinerary; check every activity falls within its opening hours and reachable in the time shown, and that every day has the three sections where activities exist.

**Acceptance Scenarios**:

1. **Given** a trip with dates and a destination, **When** the planner opens, **Then** one card per trip day is shown with morning, afternoon and evening sections.
2. **Given** each activity, **When** displayed, **Then** it shows title, estimated duration, cost with a certainty label and, where relevant, opening hours.
3. **Given** consecutive stops, **When** displayed, **Then** the travel time to the next stop is shown between them.
4. **Given** a day's schedule, **When** it is built, **Then** at least one meal or rest break appears and no activity is scheduled while closed, outside opening hours, or without enough travel time.
5. **Given** the traveler removes or swaps an activity, **When** applied, **Then** the day is re-timed, costs update and rules still hold.

---

### User Story 4 - Planner layout (Priority: P2)

The planner is laid out in order: a header with the destination and dates (hosting the download control defined elsewhere), the over-budget banner only while over budget, then two columns — the itinerary on one side; on the other the budget breakdown and the trip's selected hotel and transport.

**Why this priority**: Layout fidelity matters, but content comes first.

**Independent Test**: Open the planner in over- and under-budget states and confirm order and presence of each block.

**Acceptance Scenarios**:

1. **Given** the planner, **When** it loads, **Then** blocks appear in the order header, banner (conditional), two-column body.
2. **Given** the trip has a selected hotel and transport, **When** shown, **Then** they appear below the budget breakdown with their labels.

### Edge Cases

- No hotel or transport selected yet: the breakdown shows those categories as Unavailable with an em dash, and the total says it is partial.
- Missing cost for an activity: it is shown as Estimated with a range or as Unavailable, never as zero.
- Trip of one day, or a very long trip: the itinerary scales without empty days being padded.
- A day with no suitable activities shows an explicit rest/free day card.
- Over budget with no valid saving options: the banner says so and suggests raising the budget or changing dates.
- Applying a change invalidates another proposal: the list is recomputed.
- Different currencies in sources are shown in the trip's currency using a stated rate with an Estimated label.
- Activity closed on a given weekday or for a holiday is moved or replaced.
- Budget is exactly met: no banner, remaining shows "USD 0.00".

## Empty, Loading and Error States

- **Loading**: skeleton for the breakdown and day cards while the plan is generated.
- **Empty**: "No itinerary yet" with a prompt to choose a destination and dates; "Select a hotel and transport to complete your budget".
- **Error**: generation failure shows a message and retry; the last good plan stays visible if one exists.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The planner MUST show a budget breakdown by hotels, transportation, activities, food, local transport and miscellaneous, with the estimated total, the stated budget and the remaining amount.
- **FR-002**: Category amounts MUST sum exactly to the estimated total and remaining MUST equal budget minus total, to the cent.
- **FR-003**: Every amount MUST carry a Confirmed, Estimated or Unavailable label.
- **FR-004**: When the total exceeds the budget, the planner MUST show a banner with specific proposed changes, each with its resulting saving.
- **FR-005**: Proposed changes MUST include, where valid: a lower hotel tier, train instead of flight, fewer paid attractions, and different dates.
- **FR-006**: Each proposed change MUST be individually approvable, and nothing MUST change until the traveler approves it.
- **FR-007**: The banner MUST be hidden whenever the plan is within budget.
- **FR-008**: The itinerary MUST have one card per day with morning, afternoon and evening activities, each with estimated duration, cost, and travel time to the next stop, plus meal or rest breaks.
- **FR-009**: The itinerary MUST NOT schedule an activity that is closed, outside its opening hours or unreachable in the available time.
- **FR-010**: All costs, hours and travel times MUST come from the agent's tools and MUST NOT be invented.
- **FR-011**: The planner layout MUST be header, conditional banner, then a two-column body: itinerary beside budget breakdown and selected hotel and transport.
- **FR-012**: The planner MUST require a signed-in user (login first).
- **FR-013**: Changing selections, dates, travelers or activities MUST update budget and itinerary together.

### Key Entities

- **Budget**: The stated total and currency for a trip with computed category amounts, estimated total and remaining.
- **Budget change proposal**: A specific alternative (type, description, saving) the traveler can approve or dismiss.
- **Itinerary day / activity**: A dated day with time-of-day sections and activities (duration, cost, opening hours, travel time, break).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In review, 100% of breakdowns have category amounts summing to the total with no rounding discrepancy.
- **SC-002**: 0 scheduled activities violate opening hours or travel time in a review set of 20 generated itineraries.
- **SC-003**: 100% of proposed changes show their saving before approval and apply nothing until approved.
- **SC-004**: A traveler over budget can reach a within-budget plan, when one is possible, in under 2 minutes.
- **SC-005**: The planner generates and displays a plan in under 15 seconds for a trip of up to 10 days.

## Non-Goals

- No collection of the trip brief (intake) and no destination ranking.
- No hotel or transport searching or comparison (comparison feature) beyond showing what is already selected.
- No booking, payment or confirmation.
- No file download generation (downloads feature); the planner only hosts its control.
- No live maps, route optimisation or multi-destination sequencing.
- No group splitting of costs between travelers.

## Assumptions

- Activities, opening hours and costs come from the real data providers and the agent's tools.
- Meals are costed as Estimated unless a booked venue exists.
- Changes proposed are limited to the four types named; others may follow later.
- The itinerary assumes the arrival and departure times of the selected transport where known.
