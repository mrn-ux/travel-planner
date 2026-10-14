# Feature Specification: Hotel and Transport Comparison

> Amended 2026-10-13 (implementation sync): Search is a three-step flow, Hotels, Transport, Places to visit, with Next and Previous buttons, tabs that can be visited in any order, and what has been chosen shown again on return. Hotels: Guests and Rooms fields (rooms are added automatically when one room cannot hold the party), accommodation type (hotel, villa, cottage, guest house, apartment) and budget filters, results filtered to the chosen city, per-room-type choice. Transport: the start country and city are chosen from dropdowns and saved to the trip (the destination is fixed and cannot be reselected), a Book this flight button on each flight row, and an indicative fare estimate labelled Estimated where no timetable fare exists. Places to visit: the top 10 places for the city (or for the whole country when no city is chosen) with photos, opening hours and fees (or 'not stated'), tick-boxes, bulk add and a Chosen for your trip tag; the trip plan opens only after at least one place is chosen. Banner and background pictures match the tab: lodging photos on Hotels, vehicles on Transport, the chosen country on Places.

> Amended 2026-10-13 (constitution 3.5.0): flights from the airline test service can now be booked in test mode (chosen flight, live re-check, traveler names, confirmation reference, email). Trains and buses remain compare-only.

**Feature Branch**: `005-hotel-transport-comparison`

**Created**: 2026-10-10

**Status**: Draft

**Input**: User description: "Once a destination is set, the user can compare hotels and, separately, transport options, each sortable by price, rating, location or AI recommendation where that applies. Hotel booking is supported; flights, trains and buses are searched and compared only, never booked. Search results shows a Hotels/Transport tab pair, each with its own filters and a sortable comparison table. Hotel details shows a photo gallery, description, amenities, a map and reviews beside a room list and, once a room is picked, the price breakdown and a control to continue to booking."

## Goal

Let a traveler with a destination compare hotels and transport side by side, look closely at one hotel, and choose which hotel and transport belong in their plan.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Compare hotels (Priority: P1)

On the search results screen, once a destination is set, the traveler sees a Hotels/Transport tab pair with Hotels active. A filter bar and a comparison table list hotels with name, area, rating, price per night and its certainty label. The traveler sorts by price, rating, location or AI recommendation.

**Why this priority**: Choosing where to stay is the core decision after the destination.

**Independent Test**: Open Hotels for a destination; apply a price filter and each sort; confirm the table changes correctly and each price carries a label.

**Acceptance Scenarios**:

1. **Given** a destination is set, **When** search results open, **Then** the Hotels and Transport tabs are shown with Hotels active.
2. **Given** the hotel table, **When** the traveler sorts by price, rating, location or AI recommendation, **Then** rows reorder accordingly and the active sort shows a direction arrow.
3. **Given** the filter controls, **When** the traveler narrows by price range, rating, area or amenities, **Then** only matching hotels remain and the count is shown.
4. **Given** every price row, **When** displayed, **Then** it carries a Confirmed, Estimated or Unavailable label.
5. **Given** a row is Unavailable, **When** displayed, **Then** it shows an em dash for price and cannot be selected for the plan.

---

### User Story 2 - Compare transport (Priority: P1)

On the Transport tab the traveler sees flights, trains and buses (and similar) to the destination in a separate table with its own filters, sortable where it applies. They can mark one option as their selected transport but cannot book it.

**Why this priority**: Transport is a large share of any budget and shapes the plan.

**Independent Test**: Open Transport; filter by mode and sort by price; select an option; confirm it is stored as selected and no booking control exists.

**Acceptance Scenarios**:

1. **Given** the Transport tab, **When** it is opened, **Then** it shows its own filters (mode, price, duration, departure window) and its own sortable table.
2. **Given** the transport table, **When** the traveler sorts by price or AI recommendation, **Then** rows reorder; sort options that do not apply to transport are not offered.
3. **Given** a transport option, **When** the traveler selects it, **Then** it is stored on the trip as the selected transport.
4. **Given** any transport row, **When** displayed, **Then** it has no booking control and a note says transport is for comparison only.

---

### User Story 3 - Inspect a hotel and pick a room (Priority: P1)

Selecting a hotel opens its details page: a photo gallery, description, amenities, a map showing its location and reviews, beside a room list. When the traveler picks a room, the page shows the price breakdown and a control to continue to booking. The hotel can also be saved as the trip's selected hotel.

**Why this priority**: The details page is where a hotel choice becomes concrete.

**Independent Test**: Open a hotel; browse gallery; pick a room; confirm the breakdown appears with a label and the continue control is enabled.

**Acceptance Scenarios**:

1. **Given** a hotel from the table, **When** the traveler opens it, **Then** the gallery, description, amenities, map, reviews and room list are shown (signed in, like every screen).
2. **Given** the room list, **When** the traveler picks a room, **Then** the price breakdown (nightly rate, nights, taxes and fees, total) is shown with a certainty label and the continue-to-booking control appears.
3. **Given** a room that is Unavailable, **When** displayed, **Then** it cannot be picked and says why.
4. **Given** the traveler selects the hotel for the plan, **When** confirmed, **Then** it is stored on the trip as the selected hotel.
5. **Given** the continue control is used, **When** selected, **Then** the traveler is handed to the booking flow.

### Edge Cases

- Filters that match nothing show an empty state with a "clear filters" action.
- Equal values under a sort keep a stable, consistent order.
- Missing rating, photos, map location or reviews: the section shows a short "not available" message and the rest of the page still loads.
- Hotel and review text from the provider is shown quoted or in a secondary style and is never followed as an instruction.
- Results change between viewing and selecting (price moved): the page shows the current price and its label; final price handling belongs to booking.
- Dates or travelers changed in the trip refresh results and keep the active sort and filters where they still apply.
- Very large result sets are paged or limited with a visible count.
- Selecting a different hotel or transport replaces the previously selected one after a clear notice.

## Empty, Loading and Error States

- **Loading**: table skeleton rows per tab and a gallery placeholder on the details page.
- **Empty**: "No hotels match these filters" / "No transport found for these dates" with a way to adjust; "Choose a destination first" if none is set.
- **Error**: provider failure or timeout shows a message with retry per tab or section; the other tab and sections remain usable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Once a destination is set, search results MUST show a Hotels/Transport tab pair, each with its own filters and a sortable comparison table.
- **FR-002**: The hotel table MUST be sortable by price, rating, location and AI recommendation.
- **FR-003**: The transport table MUST be sortable by price and AI recommendation, and by other options only where they apply to transport.
- **FR-004**: Every price and availability shown MUST carry a Confirmed, Estimated or Unavailable label.
- **FR-005**: Hotel and transport data MUST be obtained only through the hotel and transport provider interfaces, never directly from a named provider.
- **FR-006**: The hotel details page MUST show a photo gallery, description, amenities, a map of the hotel's location and reviews, beside a room list, for a signed-in traveler (login first).
- **FR-007**: Picking a room MUST show a price breakdown and a control to continue to booking.
- **FR-008**: The traveler MUST be able to set one selected hotel and one selected transport option on the trip.
- **FR-009**: Trains, buses and the other ground modes MUST NOT be bookable; they are compared only. A flight from the airline test service can be booked in test mode (spec 007); flights with no such offer are compared only.
- **FR-010**: The map MUST show the hotel's static location only, with no live or route features.
- **FR-011**: Provider-supplied text (descriptions, reviews) MUST be shown as quoted data and MUST NOT be treated as instructions.
- **FR-012**: Filters and sort choices MUST persist while the traveler switches tabs on the same screen.
- **FR-013**: Where no real price exists for a transport option, the system MAY show a rule-based indicative price, which MUST be labelled Estimated, identified as an estimate rather than a quote, and MUST NOT be shown as Confirmed; real timetable times stay Confirmed, and flight departure and arrival times remain Unavailable.

### Key Entities

- **Hotel offer**: A hotel with area, rating, amenities, photos, description, reviews and rooms.
- **Room**: A bookable room type at a hotel with a nightly price, availability and a certainty label.
- **Transport option**: A way to reach the destination (mode, times, duration, price, label).
- **Selection**: The hotel and transport option chosen for a trip.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A traveler can find, filter, sort and open a hotel in under 2 minutes.
- **SC-002**: 100% of displayed prices and availability checks carry a certainty label.
- **SC-003**: 100% of sort options reorder rows correctly in review.
- **SC-004**: 0 transport options expose a booking control.
- **SC-005**: A failure in one tab or details section leaves 100% of the others usable.

## Non-Goals

- No hotel booking steps, payment or confirmations (booking feature).
- No booking of flights, trains or buses.
- No destination ranking (recommendations feature).
- No budget totals, over-budget handling or itinerary (budget feature).
- No live maps, route optimisation or directions.
- No user-written reviews or ratings.

## Assumptions

- Hotel filters: price range, rating, area, amenities; transport filters: mode, price, duration, departure window.
- Prices are per night for hotels and per traveler or per trip as stated on each row.
- The "AI recommendation" order reflects the trip brief and is explained with a short reason per row.
- Real providers supply the hotel and transport data (hotels in sandbox mode; transport schedules from public timetable data; transport and flight prices shown as labelled estimates from an indicative fare model; flight departure and arrival times Unavailable).
