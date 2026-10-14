# Feature Specification: Destination Recommendations

> Amended 2026-10-13 (implementation sync): No behaviour change. Banner and background photos follow the chosen destination (see docs/UI-SPEC.md, Visual layer).

**Feature Branch**: `004-destination-recommendations`

**Created**: 2026-10-10

**Status**: Draft

**Input**: User description: "When no destination is chosen, the agent ranks suggested destinations against budget, season, activities, transport and safety, and states a reason for each. Search results shows ranked destination recommendations when no destination is set."

## Goal

Help a traveler who does not yet know where to go by presenting a short, ranked list of destinations that fit their trip, each with plain reasons, and let them pick one.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See ranked destinations with reasons (Priority: P1)

A traveler whose trip brief has no destination proceeds to the search results screen and sees destinations ranked best fit first. Each shows its rank, name, a fit score and a short reason covering budget, season, activities, transport and safety.

**Why this priority**: It is the whole feature; without it a traveler with no destination is stuck.

**Independent Test**: With a brief that has no destination, open search results; confirm a ranked list appears, each with reasons across the five factors.

**Acceptance Scenarios**:

1. **Given** a trip with no destination, **When** the traveler opens search results, **Then** ranked recommendations are shown beneath the header and trip summary.
2. **Given** recommendations are shown, **When** the traveler reads one, **Then** it shows rank, destination name, a fit score and one stated reason per relevant factor (budget fit, season, activities, transport, safety).
3. **Given** a trip with a destination already set, **When** search results open, **Then** no recommendations are shown.
4. **Given** estimated costs appear in a reason, **When** shown, **Then** they carry the Estimated label.

---

### User Story 2 - Choose a destination (Priority: P1)

The traveler selects a recommended destination. It becomes the trip's destination and the screen switches to the Hotels/Transport view for that destination.

**Why this priority**: Choosing is the outcome that moves the trip forward.

**Independent Test**: Select the second-ranked destination; confirm it is set on the trip and the comparison view opens for it.

**Acceptance Scenarios**:

1. **Given** a ranked list, **When** the traveler selects a destination, **Then** it is stored as the trip's destination and the comparison view for it is shown.
2. **Given** a destination chosen from the list, **When** the traveler returns to the conversation, **Then** the trip-so-far panel shows it.

---

### User Story 3 - Ask for different options (Priority: P2)

The traveler asks for alternatives or changes a constraint (budget, season, interests) and the list is refreshed with newly ranked results and fresh reasons.

**Why this priority**: Improves fit, but one list already delivers value.

**Independent Test**: Lower the budget in conversation; confirm the list re-ranks and reasons change accordingly.

**Acceptance Scenarios**:

1. **Given** a ranked list, **When** the traveler changes a brief field affecting ranking, **Then** the list is re-ranked and each reason matches the new field values.
2. **Given** the traveler asks for alternatives, **When** the request completes, **Then** different destinations are listed without repeating those already dismissed.

### Edge Cases

- No destination fits (for example a very low budget): the screen says so, names the factor that limited results and suggests adjusting it.
- Fewer matches than the usual list length: show what exists without padding.
- A factor with no usable data (for example no safety information): the reason says it could not be assessed rather than omitting or guessing.
- Two destinations with equal scores: ranking is stable and consistent between views.
- Brief too thin to rank (no budget or season): the screen asks the traveler to add the missing details instead of ranking.
- First request ever for a brief or region: a first list appears within about 10 seconds marked "Refining"; scores and reasons may change when the refinement finishes, and the change is visible (not silent).
- Refinement fails or times out: the first list stays, marked "Based on limited data", with the reason.
- Provider-sourced descriptive text shown in a reason is visually set apart from the agent's own explanation and is not acted on as instructions.
- A destination chosen then cleared by the traveler returns to the recommendation list.

## Empty, Loading and Error States

- **Loading**: a placeholder list with a "finding destinations" message while ranking runs.
- **Empty**: "No destinations fit this trip yet" with the limiting factor and a prompt to adjust it.
- **Error**: if ranking fails or times out, a visible message with retry; no partial or invented list is shown.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When a trip has no destination, search results MUST show ranked destination recommendations.
- **FR-002**: Recommendations MUST be ranked against five factors: budget, season, activities, transport and safety.
- **FR-003**: Each recommendation MUST show its rank, destination name, a fit score and a stated reason for each relevant factor.
- **FR-004**: All facts and figures in recommendations MUST come from the agent's tools; the agent MUST NOT invent any.
- **FR-005**: Estimated figures MUST carry a certainty label (Estimated); figures that could not be determined MUST show Unavailable.
- **FR-006**: The traveler MUST be able to select a recommended destination, which MUST set it on the trip.
- **FR-007**: After selection the screen MUST switch to the Hotels/Transport view for that destination.
- **FR-008**: The traveler MUST be able to request alternatives and have the list refreshed after changing a ranking-relevant field.
- **FR-009**: When a destination is already set, recommendations MUST NOT be shown.
- **FR-010**: Provider-supplied text MUST be displayed as quoted data and MUST NOT be followed as instructions.
- **FR-011**: A first recommendation request for a brief MUST show a ranked first list quickly from fast live signals (without waiting for destination knowledge to be gathered), mark it as still being refined, and update it in place as more is learned; the ranking MUST NOT depend on destination knowledge having been gathered in advance.
- **FR-012**: A list MUST NOT be padded with invented destinations; when fewer than three destinations have enough real data, the screen MUST say how many were found and which factor limited the rest.

### Key Entities

- **Recommendation**: A suggested destination for one trip with a rank, fit score and reasons.
- **Reason**: A statement for one factor (budget, season, activities, transport or safety) with its certainty label.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A traveler with a ready brief sees ranked recommendations in under 10 seconds.
- **SC-002**: 100% of recommendations show a reason for each factor that applies or an explicit "could not be assessed".
- **SC-003**: 0 recommendations contain a figure that did not come from a tool result.
- **SC-004**: A traveler can choose a destination and reach the comparison view in two selections or fewer.
- **SC-005**: Changing a ranking-relevant field re-ranks the list in 100% of test cases.

## Non-Goals

- No hotel or transport results, prices per option, or comparison tables (comparison feature).
- No collection of trip details (intake feature).
- No multi-destination sequencing or itineraries.
- No destination photos galleries, reviews or maps.
- No saving or favouriting destinations.

## Assumptions

- The recommendation list shows a short ranked set (about 3–5 destinations).
- The fit score is shown as a percentage-style bar for scanning, not as a decision on its own.
- "Season" is judged from the trip's dates or window.
- Safety reasons are a brief, sourced summary, not a travel advisory.
