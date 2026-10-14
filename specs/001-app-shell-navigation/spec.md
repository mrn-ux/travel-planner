# Feature Specification: App Shell and Navigation

> Amended 2026-10-13 (implementation sync): The shell now also has a colour-theme picker (Ocean, Sunset, Forest, Violet; stored in the browser) beside the avatar menu, a Back button on every screen but Plan a trip, a full-page background photo behind the app (the chosen country; faint, under a 95% veil) and a solid content panel holding every screen except Plan a trip, so text never sits on a photo. Every screen opens with a photo banner (title and a friendly line over a dark wash). Default text weight is semibold. No photo credit or source label is shown anywhere. Layout regions and their order are unchanged. See docs/UI-SPEC.md, section Visual layer.

**Feature Branch**: `001-app-shell-navigation`

**Created**: 2026-10-10

**Status**: Draft

**Input**: User description: "Build a multi-user travel planner web application called Faro ... App shell and navigation: a top navigation bar holding the Faro name, Plan a trip and My trips navigation with the current one highlighted, and an avatar menu with Profile and Log out. Present on every screen except /login. Consistent across the app; does not change the page flow. Each screen has a loading state and an empty state. Nothing renders NaN, undefined, null or an invalid date. Money and dates are formatted consistently."

## Goal

Give every Faro screen (except the login screen) one consistent frame for orientation and movement, and define the display rules every screen follows so numbers, dates and labels never look broken.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Navigate between the two main areas (Priority: P1)

A traveler on any screen except the login screen sees a top bar with the Faro name, a "Plan a trip" link and a "My trips" link. The link for the area they are in is visibly highlighted. Selecting a link moves them to that area.

**Why this priority**: Without a consistent way to move between planning and saved trips, the product cannot be used as a whole.

**Independent Test**: Open the home screen and each other screen in turn; confirm the bar is identical, the correct link is highlighted, and each link goes to its area.

**Acceptance Scenarios**:

1. **Given** a traveler on the home screen, **When** the screen loads, **Then** the bar shows the Faro name, "Plan a trip" highlighted, and "My trips" not highlighted.
2. **Given** a traveler on the search results, trip planner, hotel details or booking screen, **When** the screen loads, **Then** "Plan a trip" is highlighted.
3. **Given** a traveler on the my-trips screen, **When** the screen loads, **Then** "My trips" is highlighted.
4. **Given** any screen except login, **When** the traveler selects the Faro name, **Then** they go to the home screen.
5. **Given** the login screen, **When** it loads, **Then** no navigation bar is shown.

---

### User Story 2 - Open the avatar menu (Priority: P2)

A traveler opens the avatar menu at the end of the bar and sees "Profile" and "Log out".

**Why this priority**: It is the one place account-level actions live, but planning works without it.

**Independent Test**: Open the menu on several screens; confirm both entries appear and the menu closes when the traveler clicks elsewhere or presses Escape.

**Acceptance Scenarios**:

1. **Given** a signed-in traveler, **When** they open the avatar menu, **Then** it lists "Profile" and "Log out".
2. **Given** the menu is open, **When** the traveler selects "Log out", **Then** the logout behaviour defined by the authentication feature runs.
3. **Given** the menu is open, **When** the traveler presses Escape or selects outside it, **Then** the menu closes and focus returns to the avatar.
4. **Given** a visitor who is not signed in, **When** they open any screen but `/login`, **Then** they are redirected to `/login` and no bar is shown. (Amended 2026-10-13 (constitution 3.4.0): login comes first. There are no anonymous visitors or draft trips; every screen except /login and every API route except sign-in, health, public config and the admin refresh requires a signed-in user.)

---

### User Story 3 - Every screen shows safe, consistently formatted values (Priority: P1)

On every screen, money, dates and missing values are displayed under one set of rules so nothing ever looks broken.

**Why this priority**: A single "NaN" or "Invalid Date" destroys trust in a product that quotes prices.

**Independent Test**: Load each screen with complete, partial and empty data; confirm no raw placeholders appear and all amounts and dates follow the formats below.

**Acceptance Scenarios**:

1. **Given** an amount of 1240 in a currency, **When** it is displayed, **Then** it reads like "USD 1,240.00" (currency code first, thousands separators, two decimals).
2. **Given** a date of 18 November 2026, **When** it is displayed, **Then** it reads "18 Nov 2026".
3. **Given** a value that is missing or cannot be read, **When** it would be displayed, **Then** an em dash or the screen's empty state is shown instead of NaN, undefined, null or an invalid date.
4. **Given** a price, availability check or schedule is shown anywhere, **When** it is displayed, **Then** it carries exactly one label: Confirmed, Estimated or Unavailable.

---

### User Story 4 - Every screen has a loading and an empty state (Priority: P2)

While a screen waits for data it shows a loading state; when there is nothing to show it shows an empty state that says why and what to do next.

**Why this priority**: Prevents blank or frozen-looking screens across the product.

**Independent Test**: Slow down or empty each screen's data and confirm the loading and empty states appear and the bar stays in place.

**Acceptance Scenarios**:

1. **Given** a screen whose data has not arrived, **When** it is displayed, **Then** a loading state is shown inside the screen while the bar remains visible and usable.
2. **Given** a screen with no data to show, **When** it is displayed, **Then** an empty state with a short message is shown.
3. **Given** a screen fails to load its data, **When** the failure occurs, **Then** an error message with a way to retry is shown; the bar stays in place.

### Edge Cases

- Very long account email or name in the avatar menu is truncated without breaking the bar layout.
- Narrow (phone-width) screens keep all bar elements reachable.
- Keyboard-only users can reach and operate the links and the avatar menu.
- A traveler's session ends while on a screen: the next request returns 401 and the traveler is sent to `/login`.
- Amounts of 0 display as "USD 0.00", not as an empty value; negative amounts show a leading minus.
- A currency code that is unknown is displayed as given, never dropped.

## Empty, Loading and Error States

- **Loading**: bar shown immediately; the screen area shows a loading indicator.
- **Empty**: each screen shows its own short empty message (defined by that screen's feature); the shell supplies the rule that one must exist.
- **Error**: a visible message and a retry action inside the screen area; the bar is unaffected.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The shell MUST appear at the top of every screen except the login screen.
- **FR-002**: The shell MUST contain the Faro name, a "Plan a trip" link, a "My trips" link and an avatar menu.
- **FR-003**: The link for the current area MUST be highlighted: "Plan a trip" for home, search results, trip planner, hotel details and booking; "My trips" for the my-trips screen.
- **FR-004**: The avatar menu MUST list "Profile" and "Log out" for a signed-in traveler and MUST close on Escape or an outside selection.
- **FR-005**: The shell MUST NOT change page flow: it MUST NOT add screens, redirects or steps of its own.
- **FR-006**: The shell MUST remain visually and positionally identical across screens.
- **FR-007**: Every screen MUST provide a loading state, an empty state and an error state.
- **FR-008**: No screen MAY display NaN, undefined, null or an invalid date; missing values MUST show an em dash or the empty state.
- **FR-009**: Every monetary amount MUST be shown as a currency code, a space, thousands separators and exactly two decimals.
- **FR-010**: Every date MUST be shown as day, three-letter month and four-digit year (for example "18 Nov 2026").
- **FR-011**: Every price, availability check and schedule shown by any screen MUST carry exactly one certainty label — Confirmed, Estimated or Unavailable — shown in words as well as colour, and never presented as more certain than its source supports.
- **FR-012**: The shell MUST be operable by keyboard and expose accessible names for its links and menu.

### Key Entities

- **Navigation area**: One of "Plan a trip" or "My trips"; determines which link is highlighted.
- **Account summary**: The signed-in traveler's displayed identity (email) used by the avatar menu.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On 100% of screens other than login, the shell is present and identical; on the login screen it is absent.
- **SC-002**: A reviewer scanning every screen with complete, partial and empty data finds zero occurrences of NaN, undefined, null or an invalid date.
- **SC-003**: 100% of displayed amounts and dates match the formats in FR-009 and FR-010.
- **SC-004**: A traveler can move from any screen to the other main area in one selection.
- **SC-005**: Every screen shows a loading, empty and error state when its data is pending, absent or failed.

## Non-Goals

- No sign-in, sign-up or logout logic (authentication feature).
- No separate Profile screen, account editing or preferences screen.
- No notifications, search box, breadcrumbs or secondary navigation.
- No content of any screen's body; only the frame and shared display rules.

## Assumptions

- "Profile" opens a small panel inside the menu showing the signed-in email; no dedicated Profile screen exists because the product has exactly seven screens. This is flagged for confirmation.
- Planning is no longer open to visitors: the bar is shown only to a signed-in user (login comes first).
- Booking is treated as part of "Plan a trip" for highlighting.
- Phone-width layout is supported but not the focus.
