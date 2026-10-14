---
description: "Task list for Authentication and Session Management"
---

# Tasks: Authentication and Session Management

**Input**: `/specs/002-authentication-sessions/` (plan.md, spec.md, research.md, data-model.md, contracts/auth-api.md, contracts/providers.md, quickstart.md)

**Prerequisites**: plan 001 Phases 1-2 complete (`api/src/config.ts`, `db.ts`, `http.ts`, `errors.ts`, `web/src/lib/api.ts`, router, shell).

**Tests**: None (manual `quickstart.md`).

**Format**: `- [ ] T### [P?] [US#?] Description with file path`

---

## Phase 1: Setup

- [X] T001 Add API dependencies `bcrypt` (>= 6) and `jose` to `api/package.json` and their types; keep the API image on `node:20-slim` in `api/Containerfile`
- [X] T002 [P] Append the 002 DDL fragment from `data-model.md` (`users`, `auth_identities`, `sessions`, `login_attempts`, `oauth_states`, `user_preferences`) to `db/init.sql`
- [X] T003 [P] Add optional `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `PUBLIC_BASE_URL`, `SESSION_TTL_DAYS` to `api/src/config.ts` and confirm they are in `.env.example`

---

## Phase 2: Foundational

**CRITICAL**: complete before any user story.

- [X] T004 Implement `api/src/auth/passwords.ts`: `hashPassword` (bcrypt cost 12), `verifyPassword`, and `validatePassword` (8 to 72 bytes)
- [X] T005 Implement `api/src/auth/sessions.ts`: `createSession(userId)` (32 random bytes base64url, store sha256 hex, `expires_at` from `SESSION_TTL_DAYS`), `lookupSession(token)` (valid when not revoked and not expired, slide expiry), `revokeSession(token)`
- [X] T006 Implement `api/src/auth/middleware.ts`: `optionalUser` (now used by one route only) and `requireUser` reading `Authorization: Bearer`, attaching `req.user = { id, email, name }`, returning 401 per the platform error shape
- [X] T007 [P] Implement `api/src/auth/throttle.ts`: record attempts in `login_attempts`, `isThrottled(email, ip)` (more than 5 failures in 15 minutes, counted in SQL)
- [X] T008 [P] Implement `web/src/lib/session.ts`: store/read/clear the token in `localStorage` (wrapped in try/catch), `getToken()`/`setToken()`/`clearToken()`, and `saveReturnTo(path)`/`peekReturnTo()`/`popReturnTo()` in `sessionStorage` accepting internal paths only (start with `/`, no `//`) (updated 2026-10-13: the signed-in user and preferences live in `web/src/lib/auth.tsx`, `AuthProvider` and `useAuth`, not in `session.ts`)
- [X] T009 Implement `web/src/components/RequireAuth.tsx`: no token -> `saveReturnTo(location)` and redirect to `/login`; wrap the routes in `web/src/router.tsx` (updated 2026-10-13: login comes first, so `RequireAuth` wraps the whole `Shell` layout, i.e. every route but `/login` and `/auth/complete`; `/trips` and the booking route keep a second wrapper)

---

## Phase 3: User Story 1 - Sign up and log in (Priority: P1) MVP

**Goal**: create an account and log in with email and password.

**Independent Test**: sign up, log out, log in; wrong credentials refused with one generic message.

- [X] T010 [US1] Implement `POST /api/auth/signup` in `api/src/auth/routes.ts`: validate email format and password rules, lower-case/trim email, insert `users` + `auth_identities(provider='password')` in one transaction, 409 on duplicate email, return `{ token, user }`
- [X] T011 [US1] Implement `POST /api/auth/login` in `api/src/auth/routes.ts`: throttle check (429), verify password, record attempt, generic 401 "Incorrect email or password", return `{ token, user }`
- [X] T012 [US1] Implement `GET /api/auth/me` and `PUT /api/auth/preferences` in `api/src/auth/routes.ts` (preferred currency, default transport/accommodation upsert into `user_preferences`)
- [X] T013 [US1] Mount the auth router in `api/src/index.ts` under `/api/auth` and ensure logs never include request bodies for these routes
- [X] T014 [US1] Build `web/src/pages/login/LoginPage.tsx` per `docs/UI-SPEC.md` 2.2 and the frames 1a/1b in `docs/design/Faro Screens.dc.html`: 400 px card, no shell, Email and Password fields (updated 2026-10-13: the card now sits on the full-page Ha Long Bay photo beside a welcome panel, see plan Reconciliations; heading "Welcome back" / "Create your account" replaces the 3xl wordmark), primary **Log in**, error area ("Incorrect email or password"), toggle link to sign-up mode (Name, Confirm password, **Create account**, **Already have an account? Log in**), 16 px field gaps
- [X] T015 [US1] Wire the form in `LoginPage.tsx` to `lib/api.ts`: disable the button while submitting, show field errors (invalid email, short password, mismatch, duplicate email with link to log in), keep the email but never the password, store the session and navigate to `popReturnTo()` or `/`
- [X] T016 [US1] Redirect an already signed-in user from `/login` to `/` in `LoginPage.tsx`

---

## Phase 4: User Story 2 - Plan first, sign in later (Priority: P1)

**Goal**: login comes first: every screen but /login redirects to login and returns to the page asked for (amended 2026-10-13; the original goal kept planning screens public).

**Independent Test**: signed out, open `/search`, sign in, return to `/search`. (Superseded the plan-first flow: login comes first.)

- [X] T017 [US2] (superseded by login-first: the hand-over is no longer used) Implement an anonymous-trip hand-over hook in `api/src/auth/routes.ts`: accept optional `tripKey` on signup, login and exchange and call `claimTrip(tripKey, userId)` from `api/src/trips/service.ts` (added by plan 003; until then guard with a no-op import)
- [X] T018 [US2] Ensure `api/src/auth/middleware.ts` exports `requireUser` for the bookings routes (plan 007) and `GET /api/trips` (plan 008) and that it is now applied to every `/api` route except auth, health, public config and the admin refresh (`api/src/index.ts`)
- [X] T019 [US2] Update `web/src/lib/api.ts` so a 401 clears the token, saves `returnTo` and redirects to `/login` without dropping the trip key stored by plan 003
- [X] T020 [US2] On successful sign-in/up in `LoginPage.tsx`, (superseded: the stored `tripKey` is still sent if present but no draft exists any more) navigate to the saved `returnTo`

---

## Phase 5: User Story 3 - Log out and session safety (Priority: P2)

**Goal**: logout revokes the session; expiry returns the user to login with work preserved.

**Independent Test**: log out, press Back, confirm no protected data; expire a session in the database and confirm redirect.

- [X] T021 [US3] Implement `POST /api/auth/logout` in `api/src/auth/routes.ts` (revoke the presented session, 204)
- [X] T022 [US3] Wire **Log out** in `web/src/components/AvatarMenu.tsx` to the API, then `clearToken()` (and the remembered trip id) and navigate to `/`, which redirects to `/login`
- [X] T023 [P] [US3] Make `AvatarMenu.tsx` show **Profile & preferences** as an in-menu panel (email, name, preferred currency, default transport and accommodation) backed by `GET/PUT /api/auth/...` (no new route)
- [X] T024 [US3] Delete expired and long-revoked sessions and old `login_attempts` and expired `oauth_states` in a small daily cleanup (`cleanupAuthTables` in `api/src/auth/sessions.ts`, called from the `api/src/index.ts` start-up timer)

---

## Phase 6: User Story 1b - Continue with Google (Priority: P2)

**Verification note**: the Google flow is implemented against endpoints confirmed from Google's discovery document, but it has NOT been exercised end to end because no Google OAuth credentials were available. Verified: `/api/auth/providers` reports `google: false` when unconfigured, `/api/auth/google/start` redirects to `/login?error=not_configured`, and the button is shown disabled with an explanation. Still to do with real credentials: sign in, return to the requested screen, same email -> same account (quickstart step 8).

**Goal**: Google sign-in via OpenID Connect; Apple is not supported.

**Independent Test**: choose **Continue with Google**, sign in, return signed in; same email signs in to the same account.

- [X] T025 [US1b] Create `api/src/providers/identity/IdentityProvider.ts` per `contracts/providers.md` (`id: 'google'`, `isConfigured`, `authorizationUrl`, `completeSignIn`, `VerifiedIdentity`)
- [X] T026 [US1b] Implement `api/src/providers/identity/GoogleIdentityProvider.ts`: authorisation-code flow with PKCE and `state`/`nonce`, code exchange via `fetchJson`, ID-token verification with `jose` against Google's JWKS (`iss`, `aud`, `exp`, `nonce`), require `email_verified`; confirm endpoint URLs against Google's discovery document before coding (research R4)
- [X] T027 [US1b] Implement `GET /api/auth/providers`, `GET /api/auth/google/start`, `GET /api/auth/google/callback`, `POST /api/auth/exchange` in `api/src/auth/routes.ts` using `oauth_states` (10-minute expiry, one-time code), account linking per research R6 (match by subject, then verified email, else create), refusing unverified emails
- [X] T028 [US1b] Add the "or" divider and **Continue with Google** button to `LoginPage.tsx` under the primary button in both modes, disabled with a "Not configured" note when `/api/auth/providers` says `google: false`
- [X] T029 [US1b] Add the web route/handler `/auth/complete` (a small component rendered outside the shell) that exchanges the one-time code, stores the session and navigates to the returned `returnTo`

---

## Phase 7: Polish

- [X] T030 Confirm `LoginPage.tsx` shows exactly one social button (Google) and no Apple control, and compare it with frames 1a, 1b and M1 in the updated `docs/design/Faro Screens.dc.html` and `Mobile Screens.dc.html`
- [X] T031 [P] Search `api/` for any `console.log`/logger call that could print passwords, tokens or Google codes and remove them
- [ ] T032 Run every step of `specs/002-authentication-sessions/quickstart.md` and fix failures (steps 1-7 and 9 done and passing; step 8 needs Google credentials; step 10 isolation passes: user B gets 404 on user A's trip for GET, PATCH, recommendations, messages and destination; only step 8 needs Google credentials)
- [X] T033 [P] Run `scripts/check-tokens.sh` (from plan 001) and fix any hard-coded colours in `web/src/pages/login/`

---

## Dependencies & Execution Order

- Phase 1 -> Phase 2 -> Phase 3 (US1, MVP) -> Phase 4 (US2, needs plan 003's `claimTrip` to be fully effective) -> Phase 5 (US3) -> Phase 6 (US1b) -> Phase 7.
- T004-T006 before T010-T012; T008 before T009 and T014; T025 before T026 before T027 before T028.
- Plans 007 and 008 need T006 (`requireUser`).

## Parallel Opportunities

T002 and T003; T007 and T008; T023 alongside T021-T022; T031 and T033.

## Implementation Strategy

MVP = Phases 1-3 (email/password sign-up and login). Then Phase 4, 5, then Google (Phase 6).

---

## Phase 8: Implementation sync (added 2026-10-13)

- [X] T034 `api/src/auth/accounts.ts` holds account logic (password user creation with 409 on duplicate email, `signInWithIdentity` linking by subject then verified email, `getPreferences`/`savePreferences`); `api/src/auth/tripHandover.ts` keeps the legacy draft-trip hook (inert since login-first)
- [X] T035 `/login` visual refresh: full-page Ha Long Bay photo (`PageBackdrop bold`, public `GET /api/places/destination-photo`), welcome panel (headline, four benefit bars, test-mode note), `ThemePicker` top right, card heading "Welcome back" / "Create your account"; Google error codes (`cancelled`, `expired`, `unverified_email`, `not_configured`, `failed`) shown from `/login?error=`
- [X] T036 `web/src/lib/auth.tsx` (`AuthProvider`, `useAuth`) replaces the `getUser()` stub; `web/src/components/RequireAuth.tsx` wraps the whole shell layout (login first)
