# Feature Specification: Trip Intake and Conversation Flow

> Amended 2026-10-13 (implementation sync): The Trip details form now has Destination country and Destination city dropdowns (the city list follows the country; the countries and cities come from the hotel provider), required-field markers, children's ages 0 to 17 (0 for a baby under 1; negatives refused), a budget that must be a positive amount, and a budget currency that follows the destination country (a world country-to-currency mapping, shown as code plus name; a budget already saved keeps its own currency). The New trip button is a solid primary button. The chat asks friendly fixed questions and fills the same form. The page photo and banner follow the chosen city and country.

**Feature Branch**: `003-trip-intake-conversation`

**Created**: 2026-10-10

**Updated**: 2026-10-11 (home layout aligned to `docs/UI-SPEC.md` §2.3: editable trip form beside the chat; New trip action added)

**Status**: Draft

**Input**: User description: "The agent collects, in conversation, a trip's destination (optional), dates or an approximate window, duration, number of adult and child travelers, a total budget in the traveler's preferred currency, a transport preference, an accommodation preference, free-form activities and interests, and free-text special requirements. It asks concise follow-up questions for whatever is missing and never asks for something already given. Trip context persists across the conversation and, once saved, across sessions." Layout per `docs/UI-SPEC.md` §2.3 and `docs/SCOPE.md` §4: a trip form column beside a chat column.

## Goal

Turn a traveler's trip description into a complete trip brief, either by editing a form or by chatting with the agent (the two always show the same information), and let them proceed as soon as enough is known.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Describe a trip in conversation (Priority: P1)

On the home screen the chat column shows the headline "Where do you want to go?" with three starter chips — **I know my destination**, **Recommend somewhere for me**, **Just exploring** — before the first message. Selecting a chip sends a canned opening message; the traveler can instead type their own. Once a message is sent, the headline and chips are replaced by the message history with a pinned input row (text field and **Send**). The agent extracts what it can and asks concise follow-up questions for what is missing.

**Why this priority**: The conversation is the product's front door and the way most travelers will fill the brief.

**Independent Test**: Send "Somewhere warm in November for a week, two adults, about 3,000 USD"; confirm the form fields fill in those values and the agent asks only about what is still missing.

**Acceptance Scenarios**:

1. **Given** a new home screen, **When** it loads, **Then** the chat shows the headline, the three starter chips and the pinned input row.
2. **Given** the traveler selects a starter chip or sends a message, **When** it is sent, **Then** the headline and chips are replaced by the message history, agent messages left-aligned and traveler messages right-aligned.
3. **Given** a message that supplies several fields, **When** the agent replies, **Then** every supplied field is captured at once and shown in the form.
4. **Given** required information is missing, **When** the agent replies, **Then** it asks short follow-up questions as a list for those fields only, never for something already given.
5. **Given** the traveler corrects an earlier answer in chat, **When** it is sent, **Then** the stored value is replaced and the form reflects it immediately.

---

### User Story 2 - Fill and edit the trip form (Priority: P1)

A trip form column on the left holds every field in this order: Destination, Dates, Duration, Travelers, Budget, Transport preference, Accommodation preference, Activities / interests, Special requirements. Each field is editable directly (text inputs, date pickers, number inputs, dropdowns with the current value preselected) without chatting. Changes update the trip immediately and the chat reflects the same information. A **See results** button sits beneath the form and is enabled once the minimum fields are set.

**Why this priority**: Gives the traveler full manual control and a clear moment to move on; the form is always available.

**Independent Test**: Fill the form without sending any chat message; confirm **See results** enables exactly when the minimum set is complete and the agent's next message does not re-ask those fields.

**Acceptance Scenarios**:

1. **Given** no fields collected, **When** the form is shown, **Then** each field is empty or shows "Not set yet" and **See results** is disabled with a hint of what is missing.
2. **Given** the minimum fields are set, **When** the form updates, **Then** **See results** is enabled.
3. **Given** the traveler edits any field in the form, **When** they commit the edit, **Then** the trip state updates and the agent uses the new value in later replies without asking for it.
4. **Given** the traveler selects **See results** with a destination set, **When** the screen changes, **Then** they reach search results showing hotel and transport comparison.
5. **Given** the traveler selects **See results** with "Recommend somewhere for me" chosen and no destination, **When** the screen changes, **Then** they reach search results showing destination recommendations.
6. **Given** the traveler fills the form without chatting, **When** they later open the chat, **Then** the agent knows the form's values.

---

### User Story 3 - Trip context persists (Priority: P2)

The traveler's brief stays through the conversation, through moving to other screens and back, and — once the trip is saved to an account — across later sessions.

**Why this priority**: Prevents re-entering information, but the first conversation delivers value without it.

**Independent Test**: Fill the brief, navigate to search results and back; sign in, close the browser, return, and confirm the brief is restored.

**Acceptance Scenarios**:

1. **Given** a partially filled brief, **When** the traveler navigates away and returns to the home screen, **Then** the form and chat history are as they left them.
2. **Given** a signed-in traveler with a saved trip, **When** they return in a new session, **Then** the trip's form values and conversation are restored.
3. ~~Given a signed-out visitor with a brief, when they sign in, the brief is kept.~~ Superseded: there is no signed-out brief (login comes first).
4. **Given** the traveler chooses **Edit in chat** from a trip planner, **When** they arrive, **Then** the home screen shows that trip's brief and conversation.

### User Story 4 - Start a new trip (Priority: P3)

A **New trip** button in the trip form's header lets the traveler start over with a blank trip without losing the one they were working on (when signed in).

**Why this priority**: Without it a traveler is stuck editing one trip forever; planning a second trip is a normal need, but the first trip delivers value without it.

**Independent Test**: Fill part of a trip, choose **New trip**, confirm; the form and chat are empty. Sign in as the owner and confirm the first trip is still in My trips.

**Acceptance Scenarios**:

1. **Given** the current trip has any detail or any message, **When** the traveler chooses **New trip**, **Then** a confirmation asks them to confirm and says what happens to the current trip.
2. **Given** a signed-in traveler confirms, **When** the new trip opens, **Then** the form and chat are blank, the starter chips are shown, and the previous trip remains saved in their account.
3. ~~Visitor case~~ Superseded: every traveler is signed in, so the previous trip always stays in My trips.
4. **Given** the current trip is still empty (no details and no messages), **When** the screen is shown, **Then** the **New trip** button is disabled so empty trips are not piled up.
5. **Given** the traveler cancels the confirmation, **When** it closes, **Then** nothing changes.
6. **Given** a new trip was created, **When** the traveler reloads or returns later, **Then** the new trip is the one shown.

---

### Edge Cases

- Ambiguous values (for example "next spring", "a few of us") prompt one clarifying question rather than a guess.
- Conflicting values (dates that disagree with the stated duration) are pointed out and the traveler chooses.
- Budget given without a currency: the agent asks for it or uses the traveler's preferred currency and says so.
- Child travelers given without ages: the agent asks for ages only if needed to proceed.
- Past dates, zero adults, or a negative budget are refused with an explanation, both in chat and in the form.
- A form edit and a chat message arriving close together: the latest committed value wins and both views show it.
- Empty or whitespace-only messages are not sent.
- Very long messages and pasted text are accepted up to a stated limit with a clear message beyond it.
- A message that tries to give the agent instructions unrelated to the trip is treated as conversation content, not as a change to the agent's rules.
- The agent states no figure, availability or booking as fact; those come from other features.
- On a narrow screen the form stacks above the chat.
- Choosing **New trip** while the assistant is still replying: the button is disabled until the reply finishes, so no reply lands in the wrong trip.
- Creating the new trip fails (network or server): the current trip stays open and an error with a retry is shown.

## Empty, Loading and Error States

- **Empty**: headline with starter chips in the chat; empty or "Not set yet" form fields.
- **Loading**: a visible "agent is working" indicator after a message is sent; the form and input stay usable for editing and drafting.
- **Error**: if the agent cannot reply, a message appears in the history with a retry action; the traveler's message is not lost and the form is unchanged. Form saves that fail show an inline message and keep the typed value.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The home screen MUST show two columns: a trip form column (fixed 360px on desktop) and a chat column (flexible), stacking on narrow screens with the form above the chat.
- **FR-002**: The form MUST contain, in order: Destination, Dates, Duration, Travelers, Budget, Transport preference, Accommodation preference, Activities / interests, Special requirements, each directly editable at any time.
- **FR-003**: The agent MUST collect the same fields in conversation, and form and chat MUST always reflect the same trip state.
- **FR-004**: The chat MUST show the headline and three starter chips (**I know my destination**, **Recommend somewhere for me**, **Just exploring**) before the first message, and the message history with a pinned input row (text field and **Send**) afterwards.
- **FR-005**: The agent MUST ask concise follow-up questions for missing required information as a short list, and MUST NOT ask for information already given in chat or the form.
- **FR-006**: The minimum fields to proceed MUST be: a destination or an explicit "recommend one" choice; dates or duration; travelers (at least one adult); and a budget with currency.
- **FR-007**: **See results** MUST be disabled until the minimum fields are set, MUST say what is missing, and MUST lead to the search results screen when enabled.
- **FR-008**: The traveler MUST be able to correct any field by chat or in the form.
- **FR-009**: Trip context MUST persist across the conversation and screen changes and, for a signed-in traveler, across sessions once saved.
- **FR-010**: The agent MUST NOT invent prices, availability, schedules or confirmations in the conversation.
- **FR-011**: Text a traveler types MUST NOT be able to change the agent's rules or capabilities.
- **FR-012**: Every failure to reach the agent MUST be shown to the traveler with a retry action.
- **FR-013**: Agent and form MUST apply the same validation (no past dates, at least one adult, positive budget).
- **FR-014**: The trip form's header MUST hold a **New trip** button, disabled while the current trip has no details and no messages.
- **FR-015**: Choosing **New trip** MUST ask for confirmation, then open a blank trip; the previous trip MUST remain saved (every traveler is signed in; there are no visitors).
- **FR-016**: The new trip MUST become the one shown on reload and on later visits.

### Key Entities

- **Trip brief**: The collected fields for one trip (destination, dates/window, duration, adults, children, budget and currency, transport preference, accommodation preference, interests, special requirements, "recommend one" choice).
- **Conversation**: The ordered messages between traveler and agent for one trip.
- **Starter chip**: A suggested first message shown before any message exists.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A traveler can reach an enabled **See results** with a complete minimum brief in under 3 minutes, by form or by chat, and with no more than 6 agent questions.
- **SC-002**: In test conversations, the agent asks for an already-supplied field (by chat or form) 0 times.
- **SC-003**: After every message or form edit, form and chat agree on 100% of fields.
- **SC-004**: 100% of saved trips restore their full brief in a new session.
- **SC-005**: Every agent failure produces a visible message and retry, with 0 lost traveler messages.

## Non-Goals

- No destination ranking or reasons (destination recommendations feature).
- No hotel or transport results, budgets, or itineraries.
- No account, sign-in or saved-trip list screens.
- No voice input, file attachments or multi-language support.
- No multi-destination trip sequencing.

## Assumptions

- The traveler's preferred currency defaults to the one last used or the most common for their locale, and is shown in the Budget field.
- Trips are saved automatically; every traveler is signed in (login comes first).
- English is assumed for conversation.
- Starter chips send fixed canned opening messages.
- Layout and field order follow `docs/UI-SPEC.md` §2.3 exactly; where the earlier version of this spec described a read-only "trip so far" panel beside the conversation, that panel is replaced by the editable form.
