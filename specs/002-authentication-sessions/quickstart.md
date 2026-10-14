# Quickstart: Authentication and Session Management

Prerequisites: [plan 001 quickstart](../001-app-shell-navigation/quickstart.md) running. For social sign-in, set the Google variables in `.env` and register `http://localhost:8080/api/auth/google/callback` as the Google redirect URI.

## Validate
1. **Sign up**: on `/login` (Ha Long Bay photo, welcome panel on the left, card on the right), switch to sign-up (name, email, password, confirm); create an account; confirm you land on `/`. In the database, `auth_identities.password_hash` starts with `$2` and no plain-text password appears in any table or in `podman compose logs api`.
2. **Login / wrong password**: log out; log in with a wrong password → "Incorrect email or password", same message for an unknown email.
3. **Throttle**: six wrong attempts for one email → throttled message.
4. **Login first**: signed out, open `/`, `/search`, `/trip/<id>`, `/hotels/<id>` or a booking URL → each redirects to `/login`; sign in → back at the page you asked for.
5. **Guards**: signed out, open `/trips` → `/login`; open a booking URL → `/login`; every `/api` route except auth, health, public config and the admin refresh returns 401.
6. **Logout**: log out; press Back; protected screens redirect, no account data visible. Token no longer works (`GET /api/auth/me` → 401).
7. **Expiry**: set a session's `expires_at` in the past; next protected action → `/login`, and after signing in you return to the screen you were on.
8. **Google**: choose **Continue with Google**; sign in with a test account → returned signed in; repeat with the same email → same account.
9. **Unconfigured provider**: with the Google variables unset the Google button is disabled with the note "Google sign-in is not configured."; opening `/api/auth/google/start` lands on `/login` with that message.
10. **Isolation**: sign in as two users; confirm one cannot fetch the other's trip by id (404/403).
11. **Profile & preferences** (added 2026-10-13): avatar menu → **Profile & preferences** shows name and email and saves preferred currency, default transport and accommodation (`PUT /api/auth/preferences`); reload and they are still set.
12. **Public photo only**: signed out, `GET /api/places/destination-photo` is the only `/api` call besides auth, health, public config and the admin refresh that answers without a session.
