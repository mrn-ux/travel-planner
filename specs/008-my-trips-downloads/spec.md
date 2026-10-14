# Feature Specification: My Trips and Plan Downloads

> Amended 2026-10-13 (implementation sync): My trips has a photo banner ('Your adventures') and a card per trip with destination, dates, hotel, transport and places status, budget and estimated total, and Open, Download and Delete. A trip can be deleted from its card after a confirmation; its related rows go with it.

**Feature Branch**: `008-my-trips-downloads`

**Created**: 2026-10-10

**Status**: Draft

**Input**: User description: "From the trip planner or my trips, the user can download the current plan as a file — destinations, dates, the day-by-day itinerary, selected hotels and transportation, and the budget breakdown — generated fresh from the trip's current data on each request. My trips shows a card per saved trip with its destination, dates, booking status for hotels and transport, estimated total, and controls to open or download it."

## Goal

Give a signed-in traveler one place to see all their saved trips at a glance and open any of them, and let them take a complete, up-to-date copy of a plan with them as a file.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review and open saved trips (Priority: P1)

The my-trips screen shows one card per saved trip with its destination, dates, booking status for the hotel and for transport, the estimated total, and controls to open or download it. Opening a trip goes to its planner.

**Why this priority**: It is how travelers return to their work.

**Independent Test**: With three saved trips in different states, open my trips and confirm each card is accurate and "Open" goes to the right planner.

**Acceptance Scenarios**:

1. **Given** a signed-in traveler with saved trips, **When** they open my trips, **Then** one card per trip is shown, most recently updated first.
2. **Given** a trip card, **When** displayed, **Then** it shows destination, dates, hotel booking status, transport status, estimated total with its certainty label, and Open and Download controls.
3. **Given** a card, **When** the traveler selects Open, **Then** that trip's planner is shown with its current data.
4. **Given** a trip without a destination yet, **When** its card is shown, **Then** destination shows an em dash and the card reads "Destination not chosen".
5. **Given** the traveler has only their own trips, **When** my trips loads, **Then** no other account's trips are ever shown.

---

### User Story 2 - Download the current plan (Priority: P1)

From the trip planner or a my-trips card, the traveler downloads the current plan as a file containing destination, dates, the day-by-day itinerary, selected hotel and transport, and the budget breakdown. The file is generated fresh from the trip's current data on each request.

**Why this priority**: Travelers need the plan offline and shareable.

**Independent Test**: Download a plan, change the trip, download again; confirm the second file reflects the change and both contain every required section.

**Acceptance Scenarios**:

1. **Given** the planner, **When** the traveler selects Download in the header, **Then** a file is generated from the trip's current data and downloaded.
2. **Given** a my-trips card, **When** the traveler selects Download, **Then** the same kind of file is generated for that trip.
3. **Given** a trip that was changed since the last download, **When** downloaded again, **Then** the new file shows the changes and no stale content.
4. **Given** the file, **When** opened, **Then** it contains destination, dates, the day-by-day itinerary, selected hotel and transport, the budget breakdown, and each price and schedule with its certainty label, using the standard money and date formats.
5. **Given** a section with no data yet (for example no itinerary), **When** the file is produced, **Then** the section says it is not yet available rather than being blank or showing placeholders.

---

### User Story 3 - Empty and new states (Priority: P2)

A traveler with no saved trips sees an empty state inviting them to plan their first trip, with a control that goes to the home screen.

**Why this priority**: First-run experience, secondary to returning use.

**Independent Test**: Sign in with a new account and open my trips.

**Acceptance Scenarios**:

1. **Given** no saved trips, **When** my trips opens, **Then** "No trips yet — plan your first one" is shown with a Plan a trip button to the home screen.

### Edge Cases

- Download while the trip is being updated: the file uses the latest committed data and the traveler is told the time it was generated.
- Very large itineraries produce a complete file without truncation.
- A trip deleted or inaccessible between listing and download shows a clear "trip not found" message and no file.
- Missing or failed data for part of a plan: the file is still produced with that section marked unavailable, and the traveler is warned.
- Special characters in names and activity titles appear correctly in the file.
- Repeated rapid Download selections produce a single download.
- Trip with a pending booking shows "Pending confirmation" status, not Confirmed.
- Hotel statuses: Not booked, Pending confirmation, Confirmed, Failed; transport shows "Flight booked" with its reference once a flight is booked in test mode, otherwise the selected option or "not selected" (trains and buses cannot be booked).
- Signed-out access to my trips redirects to login (authentication feature); downloads require a signed-in session for the owning account.
- Files never contain other travelers' data or payment details.

## Empty, Loading and Error States

- **Loading**: card skeletons while the list loads; Download shows "Preparing your plan" and is disabled until done.
- **Empty**: "No trips yet — plan your first one" with a button.
- **Error**: list failure shows a message with retry; download failure shows a message with retry and no partial file.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: My trips MUST require a signed-in session and MUST show only the signed-in traveler's trips.
- **FR-002**: My trips MUST show one card per saved trip with destination, dates, hotel booking status, transport status, estimated total with its certainty label, and Open and Download controls.
- **FR-003**: Open MUST take the traveler to that trip's planner.
- **FR-004**: The trip planner header and each my-trips card MUST offer a Download control.
- **FR-005**: Downloading MUST produce a file containing destination, dates, the day-by-day itinerary, selected hotel and transport, and the budget breakdown.
- **FR-006**: The file MUST be generated fresh from the trip's current data on every request and MUST NOT be a stored or cached copy.
- **FR-007**: Every price, availability and schedule in the file MUST carry a Confirmed, Estimated or Unavailable label, and amounts and dates MUST use the standard formats.
- **FR-008**: Sections without data MUST say they are unavailable rather than appearing blank or showing NaN, undefined, null or invalid dates.
- **FR-009**: A trip a traveler does not own MUST NOT be listable, openable or downloadable by them.
- **FR-010**: My trips MUST provide loading, empty and error states.
- **FR-011**: Download MUST report failure to the traveler and MUST NOT deliver partial files.

### Key Entities

- **Saved trip**: A traveler's trip with brief, selections, plan and booking statuses.
- **Trip card**: The summary of a saved trip shown on my trips.
- **Plan file**: The downloadable document generated from a trip's current data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A traveler can find and open a saved trip in under 15 seconds from my trips.
- **SC-002**: 100% of downloaded files contain all five required sections or an explicit unavailable note.
- **SC-003**: A change to a trip appears in the next download in 100% of test runs.
- **SC-004**: 0 trips or files are accessible to an account that does not own them.
- **SC-005**: A plan file is ready within 10 seconds for a trip of up to 10 days.

## Non-Goals

- No trip creation, editing, duplication, archiving or deletion.
- No sharing, emailing or public links for plans.
- No booking, payment or confirmation resend (booking feature).
- No budget or itinerary generation (budget feature); the file only reproduces it.
- No search, filter or sort of the trip list beyond a default order.
- No transport booking status beyond "Flight booked" (test mode) and the selected option.

## Assumptions

- The download is a single printable document (PDF) in this build; the format can change later without changing this behaviour.
- The default order of trip cards is most recently updated first.
- "Saved trip" means any trip belonging to the signed-in traveler's account.
- Estimated total on a card is the planner's current estimated total.
