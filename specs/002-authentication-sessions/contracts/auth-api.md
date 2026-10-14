# Contract: Auth API

Conventions (error shape, headers) are in [platform contract](../../001-app-shell-navigation/contracts/platform.md).

| Method & path | Auth | Request | Success | Failures |
|---|---|---|---|---|
| `POST /api/auth/signup` | none | `{ name, email, password, tripKey? }` (`tripKey` legacy, inert) | 201 `{ token, user }` | 400 `{ error, fields }` (`name`, `email`, `password`); 409 email in use (`fields.email`) |
| `POST /api/auth/login` | none | `{ email, password, tripKey? }` (`tripKey` legacy, inert) | 200 `{ token, user }` | 401 generic "Incorrect email or password"; 429 throttled |
| `POST /api/auth/logout` | session | none | 204 (session revoked) | 401 |
| `GET /api/auth/me` | session | none | 200 `{ user, preferences }` | 401 |
| `PUT /api/auth/preferences` | session | `{ preferredCurrency, defaultTransport?, defaultAccommodation? }` | 200 `{ preferences }` | 400; 401 |
| `GET /api/auth/providers` | none | none | 200 `{ google: boolean }` (true when configured) | |
| `GET /api/auth/google/start?returnTo=&tripKey=` | none | | 302 to Google; 302 to `/login?error=not_configured` when the Google variables are unset | |
| `GET /api/auth/google/callback` | none | provider redirect | 302 to `/auth/complete?code=<one-time>` | 302 to `/login?error=<code>` |
| `POST /api/auth/exchange` | none | `{ code }` | 200 `{ token, user, returnTo }` (one-time code, valid 2 minutes) | 400 invalid/expired code |

`user` = `{ id, email, name }`. Validation: email must be a valid address; password 8–72 bytes. `name` is required (1-100 characters). Passwords and tokens never appear in responses other than the single `token` field, and never in logs.

## Guard behaviour (web)

- Login comes first (updated 2026-10-13): every route except `/login` and `/auth/complete` is inside `RequireAuth` (the whole shell layout; the booking and `/trips` routes are wrapped a second time): no session → save `returnTo` + redirect to `/login`. On the API side every route except `/api/auth/*`, health, public config, `/api/admin/*` and `GET /api/places/destination-photo` runs `requireUser`.
- Any API 401 clears the token, saves `returnTo`, redirects to `/login`.
- `/login` while signed in → `/`. After sign-in the user goes to the saved `returnTo` (internal paths only), else `/`. Log out clears the token and returns to `/`, which redirects to `/login`.

## Login screen states (UI-SPEC §2.2)

| State | Behaviour |
|---|---|
| Submitting | Primary button shows progress and is disabled |
| Wrong credentials | Error area: "Incorrect email or password" |
| Duplicate email (sign-up) | Field message with a link to switch to log in |
| Throttled | "Too many attempts. Try again in a few minutes." |
| Provider not configured | Google button disabled with the note "Google sign-in is not configured." |
| Social failure/cancel | `/login?error=<code>` (`cancelled`, `expired`, `unverified_email`, `not_configured`, `failed`) shows a message in the error area; no account created |
