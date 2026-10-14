# Research: Authentication and Session Management

## R1. Password hashing
- **Decision**: `bcrypt` (native) ≥ 6.0.0, cost 12, in a `node:20-slim` API image.
- **Rationale**: Required by the brief. Versions before 5 truncate long passwords; prebuilt Linux binaries exist for glibc and musl but are best-effort, so the glibc slim image avoids build risk.
- **Alternatives**: `bcryptjs` (pure JS, slower, acceptable fallback); argon2 (not requested).
- **Limit**: bcrypt only uses the first 72 bytes; password max length is enforced at 72 bytes with a message.

## R2. Session tokens
- **Decision**: `crypto.randomBytes(32).toString('base64url')` returned once to the client; the DB stores only `sha256(token)` hex, user id, `expires_at`, `revoked_at`. The web app keeps the token in `localStorage` and sends `Authorization: Bearer` (as the brief specifies); inactivity expiry is `SESSION_TTL_DAYS` (default 7), sliding on use.
- **Rationale**: A fast hash is fine for a high-entropy token; a database leak does not reveal usable tokens.
- **Trade-off**: localStorage is readable by any script on the origin; mitigated by no third-party scripts except Stripe.js (loaded only on the booking page) and React's escaping.

## R3. Login throttling
- **Decision**: `login_attempts(email_lower, attempted_at, success)`; 5 or more failures for an email in 15 minutes returns 429 "Too many attempts. Try again in a few minutes.", counted in SQL. A per-IP count (20 failures in the same window; the API runs behind the nginx proxy with `trust proxy` so the real client address is used) uses the same table.
- **Alternatives**: in-memory limiter (lost on restart, wrong with multiple API replicas).

## R4. Google sign-in
- **Decision**: Authorization-code flow with PKCE and `state`, performed by the API: `GET /api/auth/google/start` redirects to Google; `GET /api/auth/google/callback` exchanges the code at Google's token endpoint, verifies the ID token with `jose` against Google's JWKS (`iss`, `aud`, `exp`, `nonce`), and requires `email_verified: true`.
- **Return address**: `${PUBLIC_BASE_URL}/api/auth/google/callback`. The API then redirects the browser to a web route that picks up a one-time code and exchanges it for the session token, so the token never travels in a URL.
- **Verification note**: endpoint URLs and claim names are standard OIDC and must be confirmed against Google's current discovery document at implementation time (not fetched during planning).

## R5. Account linking
- **Decision**: Sign-in with Google uses `(provider, provider_subject)` first; otherwise, if the verified email matches an existing user, the identity is added to that user (spec FR-014); otherwise a user is created. An unverified provider email is refused.

## R6. Anonymous trip hand-over (superseded: Amended 2026-10-13 (constitution 3.4.0): login comes first. There are no anonymous visitors or draft trips; every screen except /login and every API route except sign-in, health, public config and the admin refresh requires a signed-in user.)
- **Decision**: Login and sign-up accept an optional `tripKey`; after authenticating, the API calls plan 003's `claimTrip(tripKey, userId)` in the same request so the in-progress trip survives the redirect.

## R7. Return path
- **Decision**: The web app saves `returnTo` (an internal path only; anything not starting with `/` or containing `//` is discarded) in `sessionStorage` before redirecting to `/login`, and navigates there after success. Plan 001's api client does the redirect on 401.

## R8. Profile & preferences
- **Decision**: The avatar menu's "Profile & preferences" opens a panel (no new route) showing email, name and a small preferences form (preferred currency, default transport and accommodation), stored in `user_preferences`. Preferred currency pre-fills new trips' budget currency (plan 003).

## R9. Login screen and Google error codes (added 2026-10-13)
- **Decision**: `/login` is a full-page Ha Long Bay photo (Wikipedia lead photo through the public `GET /api/places/destination-photo`, the one image route that works signed out) with a welcome panel and the sign-in card side by side; a ThemePicker sits top right. Sign-up validates name, email, password (8+) and confirmation in the browser, and the API repeats the checks and returns `fields`. Google failures come back as `/login?error=<code>`: `cancelled`, `expired`, `unverified_email`, `not_configured`, `failed`.
- **Session on the client**: `web/src/lib/auth.tsx` (`AuthProvider`, `useAuth`) checks a stored token once at start (`GET /api/auth/me`), exposes `login`, `signup`, `completeExchange`, `logout`, `savePreferences`; log out also clears the remembered trip id.
