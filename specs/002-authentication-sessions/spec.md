# Feature Specification: Authentication and Session Management

> Amended 2026-10-13 (implementation sync): The login screen is a full-page Ha Long Bay photo with a welcome panel on the left (Faro name and headline in warm yellow, four colour-highlighted benefit bars, a test-mode note) and the sign-in card on the right. Sign-up asks for name, email, password and confirmation. The trip form is empty after every logout and login.

**Feature Branch**: `002-authentication-sessions`

**Created**: 2026-10-10

**Updated**: 2026-10-10 (Google sign-in brought into scope; layout per `docs/UI-SPEC.md` 2.2)

**Status**: Draft

**Input**: User description: "Email and password accounts, plus Google sign-in. A sign-up screen creates an account; a login screen grants access. Passwords are hashed, never stored or logged in plain text. There is a logout. Login comes first: every screen except the login screen requires a signed-in session, and reaching one without it redirects to login and returns there afterwards." (Amended 2026-10-13; the original text let home, search, planner and hotel details be used without signing in.)

## Goal

Let travelers create an account and sign in with email and password, keep them signed in safely, and guard booking and saved trips — without getting in the way of planning a trip before having an account.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign up and log in (Priority: P1)

A traveler opens the login screen, which offers both sign-up and login. They create an account with an email and password and are signed in, or they log in to an existing account.

**Why this priority**: No signed-in feature (booking, saved trips) works without it.

**Independent Test**: Create an account, log out, log back in with the same credentials, and confirm access; confirm wrong credentials are refused.

**Acceptance Scenarios**:

1. **Given** the login screen, **When** the traveler submits a new valid email and a valid password in sign-up, **Then** an account is created and they are signed in.
2. **Given** an existing account, **When** the traveler submits the correct email and password, **Then** they are signed in.
3. **Given** an existing account, **When** the traveler submits a wrong password or unknown email, **Then** a single generic "email or password is incorrect" message is shown and no hint reveals which was wrong.
4. **Given** sign-up with an email that already has an account, **When** submitted, **Then** a clear message says the email is in use and offers login.
5. **Given** sign-up with an invalid email or too-short password, **When** submitted, **Then** the specific field shows a message and no account is created.

---

### User Story 1b - Continue with Google (Priority: P2)

Beneath an "or" divider the login screen offers **Continue with Google**. Choosing it takes the traveler to the provider, and on success they return signed in.

**Why this priority**: Faster sign-in, but email/password already delivers access.

**Independent Test**: Choose each button with a test account; confirm sign-in, return to the requested screen, and that the same email signs in to the same account next time.

**Acceptance Scenarios**:

1. **Given** the login screen, **When** the traveler chooses Continue with Google and approves, **Then** they are signed in and returned to the screen they originally requested.
2. **Given** a first-time social sign-in, **When** it succeeds, **Then** an account is created for the provider's verified email and name.
3. **Given** the traveler cancels or Google fails, **When** they return, **Then** the login screen shows a clear message and no account is created.
4. **Given** Google sign-in that is not configured, **When** the screen loads, **Then** its button is disabled with an explanation.

---

### User Story 2 - Plan first, sign in later (Priority: P1)

A visitor with no account can use nothing but the login screen. Whatever screen they try to open, they are sent to the login screen; after signing up or logging in they return to the screen they asked for. (Amended 2026-10-13 (constitution 3.4.0): login comes first. There are no anonymous visitors or draft trips; every screen except /login and every API route except sign-in, health, public config and the admin refresh requires a signed-in user.)

**Why this priority**: It is the product's defining access rule: no account wall in front of planning.

**Independent Test**: As a signed-out visitor, open `/search`; confirm the redirect to login, sign in, and confirm return to `/search`.

**Acceptance Scenarios**:

1. **Given** a signed-out visitor, **When** they open the home, search results, trip planner or hotel details screens, **Then** each redirects to the login screen.
2. **Given** a signed-out visitor, **When** they open a booking URL, **Then** they are redirected to the login screen.
3. **Given** a signed-out visitor, **When** they open the my-trips screen, **Then** they are redirected to the login screen.
4. **Given** a visitor redirected to login, **When** they sign in or sign up, **Then** they land on the screen they originally requested.
5. **Given** a signed-in traveler, **When** they open the login screen, **Then** they are taken to the home screen.

---

### User Story 3 - Log out and session safety (Priority: P2)

A signed-in traveler chooses "Log out" in the avatar menu and is signed out; protected screens are no longer reachable until they sign in again. Sessions end on their own after a period of inactivity.

**Why this priority**: Necessary for shared devices, but secondary to access itself.

**Independent Test**: Log out, press the browser's back button, and confirm protected data does not show; wait past the session lifetime and confirm re-login is required.

**Acceptance Scenarios**:

1. **Given** a signed-in traveler, **When** they select "Log out", **Then** the session ends and they are taken to the login screen.
2. **Given** a logged-out traveler, **When** they return to a protected screen via history, **Then** they are redirected to login and see no previous account data.
3. **Given** a session that has expired, **When** the traveler takes a protected action, **Then** they are redirected to login with their in-progress work preserved.

### Edge Cases

- Email addresses are compared case-insensitively; leading and trailing spaces are ignored.
- Repeated failed logins for one account slow further attempts and show a "try again later" message.
- Two browser tabs: logging out in one signs the other out on its next protected action.
- Redirect target is only ever an internal screen; an external address in the return path is ignored.
- There is no in-progress trip before sign-up: trips are created only by signed-in users.
- Browser back from login after success does not show the login form again.

## Empty, Loading and Error States

- **Loading**: submit control shows progress and is disabled to prevent double submission.
- **Empty**: not applicable beyond blank-field validation messages.
- **Error**: wrong credentials, duplicate email, invalid input, too many attempts, and service unavailable each show a clear message; the form keeps the entered email but never the password.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The login screen MUST offer both sign-up and login, and MUST be reachable without signing in.
- **FR-002**: Accounts MUST be created and accessed with an email and a password, or with Google sign-in.
- **FR-003**: Passwords MUST be stored only in an irreversibly protected form and MUST NOT be stored, shown or logged in plain text anywhere.
- **FR-004**: The system MUST validate email format and a minimum password length of 8 characters on sign-up.
- **FR-005**: Login failures MUST return one generic message that does not reveal whether the email exists.
- **FR-006**: A signed-in session MUST be represented by an opaque token the traveler cannot interpret, and MUST end on logout and after inactivity.
- **FR-007**: Every screen except the login screen MUST require a session, and every API route except sign-in, health, public configuration and the admin refresh MUST return 401 without one.
- **FR-008**: Booking and my trips MUST require a session; without one the traveler MUST be redirected to the login screen.
- **FR-009**: On redirect to login, the in-progress trip MUST be preserved and, after successful sign-in or sign-up, the traveler MUST return to the screen they requested.
- **FR-010**: The system MUST provide a logout that ends the session and removes access to protected screens and data.
- **FR-011**: Each trip, saved preference and booking MUST belong to exactly one account, and a signed-in traveler MUST only ever see and change their own.
- **FR-012**: The login screen MUST offer **Continue with Google** beneath an "or" divider; signing in with it MUST create or access the account for the verified email the provider returns, and no other sign-in method MUST be offered.
- **FR-014**: A Google sign-in whose email matches an existing email/password account MUST sign in to that same account only when the provider has verified the email; otherwise it MUST be refused with a message.
- **FR-015**: If Google sign-in is not configured for the deployment, its button MUST be shown disabled with an explanatory message and MUST NOT appear to work.
- **FR-013**: Repeated failed login attempts MUST be limited.

### Key Entities

- **Account**: A traveler identified by a unique email; holds a protected password credential.
- **Session**: A signed-in period for one account, identified by an opaque token, with an expiry.
- **Pending return**: The screen a visitor was trying to reach, kept while they sign in.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new traveler can create an account and be signed in in under 1 minute.
- **SC-002**: 100% of attempts to open booking or my trips without a session end on the login screen.
- **SC-003**: 100% of redirected sign-ins return the traveler to the requested screen with the in-progress trip unchanged.
- **SC-004**: A search of stored account data and application logs finds no plain-text passwords.
- **SC-005**: After logout, 0 protected screens or account data are viewable.
- **SC-006**: No traveler can view or change another account's trips or bookings.

## Non-Goals

- No sign-in method other than email/password and Google (no Apple, no other social providers); no enterprise single sign-on.
- No password reset, email verification, multi-factor authentication or account deletion in this build.
- No profile editing and no roles or admin accounts.
- No navigation bar content (shell feature); only the logout behaviour it triggers.

## Assumptions

- Minimum password length is 8 characters with no other composition rules.
- Sessions end after a fixed period of inactivity (assumed 7 days).
- Failed-login limiting allows a handful of attempts before a short cool-down.
- Without password reset, a forgotten password is out of scope for this workshop build.
- Google accounts have no password and cannot use the email/password form.
