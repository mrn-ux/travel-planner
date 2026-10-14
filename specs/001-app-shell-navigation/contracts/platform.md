# Platform Contract: API conventions shared by all plans

## Base
- All endpoints live under `/api`, same origin as the web app. JSON in, JSON out.

## Authentication headers
- `Authorization: Bearer <session token>` for signed-in requests (plan 002).
- ~~`X-Trip-Key`~~: no longer used (updated 2026-10-13: trip routes always have a signed-in user, so no key is issued; the legacy code paths (`web/src/lib/api.ts` forwarding a stored key, `api/src/trips/routes.ts` reading it, `claimTrip`, `deleteStaleDrafts`) remain but are inert). Amended 2026-10-13 (constitution 3.4.0): login comes first. There are no anonymous visitors or draft trips; every screen except /login and every API route except sign-in, health, public config and the admin refresh requires a signed-in user.

## Error shape
```json
{ "error": "human-readable message" }
```
The body is always `{ error: string }` (repository convention in `CLAUDE.md`). Semantics are carried by the HTTP status: 400 validation, 401 no/expired session, 403 not owner, 404 not found, 409 conflict, 422 rule violation, 429 throttled, 502 provider failure, 504 provider timeout. Validation failures add a `fields` object (field name to message) next to `error`. Endpoints that need to return structured detail with a failure (for example a booking price change with old and new prices) do so with a 409 whose body adds fields next to `error`; `error` is always present and is a string.

## Provenance envelope (every fact that originates outside the database)
```json
{
  "source": "liteapi",
  "source_url": "https://api.liteapi.travel/v3.0/hotels/rates",
  "fetched_at": "2026-10-10T09:30:00Z",
  "certainty": "confirmed",
  "sandbox": true
}
```
`certainty` is `confirmed | estimated | unavailable`. `sandbox` is present and `true` for LiteAPI and Stripe results. The UI renders `certainty` with `CertaintyBadge` and passes nothing else through to styling.

## Public config
`GET /api/config/public` → `{ "stripePublishableKey": "pk_test_..." }`. It MUST NOT return Ollama settings, other keys or internal URLs.

## Route protection
Updated 2026-10-13: `api/src/index.ts` mounts `GET /api/health`, `GET /api/config/public` and `/api/auth` first; every other `/api` route passes `requireUser` except `/api/admin/*` (its own token) and `GET /api/places/destination-photo` (the public photo shown behind the login page). Unknown `/api` paths return 404 `{ "error": "Not found" }`.

## Health
`GET /api/health` → `{ "status": "ok" }` once the database is reachable.

## Configuration contract (api/src/config.ts)
- Reads required variables (plan 001 research R8) once at start; if any is missing, the API exits with a message naming the variable.
- `STRIPE_SECRET_KEY` must start with `sk_test_` and `STRIPE_PUBLISHABLE_KEY` with `pk_test_`, else the API refuses to start (enforced by `StripePaymentProvider` on construction: live keys are refused).
