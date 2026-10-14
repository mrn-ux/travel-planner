# Research: App Shell and Platform Foundation

## R1. Tailwind version and token mapping
- **Decision**: Tailwind CSS **3.4** with `tailwind.config.ts`; theme values are read from `docs/design/tokens/colors.css`, `typography.css`, `spacing.css`, `radius.css`, `shadow.css` and written into the config.
- **Rationale**: The requirement is a `tailwind.config` that holds every colour, size, radius and shadow. v4 only reaches a JS config through `@config` and drops several config features; v3.4 is the zero-risk path with Vite.
- **Alternatives**: Tailwind v4 with `@theme` CSS tokens: rejected, it would put values in CSS rather than the config.
- **Updated 2026-10-13**: `bg`, `surface-muted`, `border`, `border-strong`, `accent`, `accent-hover`, `accent-soft` now read CSS variables (`--c-*` in `web/src/index.css`) so four colour themes (ocean = the original palette, sunset, forest, violet) can be switched with `data-theme` on `<html>`; extra tokens added for the visual layer (`shadow lift`, `photo-*` colours for text over photos, sizes `nav`, `banner`, `swatch`, `menu-w`, `panel-w`, `login-wide`). Theme choice is stored in `localStorage` only (`web/src/lib/theme.ts`).
- **Detail**: Colours use the names from `docs/design/uploads/DESIGN-SYSTEM.md` §7 (`bg`, `surface`, `surface-muted`, `border`, `border-strong`, `text`, `text-secondary`, `text-muted`, `accent`, `accent-hover`, `accent-soft`, `confirmed`, `estimated`, `unavailable`, `over-budget`, `under-budget`, `danger`, `focus-ring`) plus the six chart colours and `modal-backdrop`. `fontSize` uses the seven token pairs; `borderRadius` `sm/md/lg/full`; `boxShadow` `raised/overlay/modal`. Spacing keeps Tailwind defaults but `theme.spacing` is restricted to 0, 1, 2, 3, 4, 6, 8, 12, 16 (the 4px steps) so off-grid utilities do not compile.

## R2. Fonts
- **Decision**: Load Spectral (400/500/600) and Inter (400/500/600) from Google Fonts in `web/index.html`, as instructed; `fontFamily.display` and `fontFamily.sans` in the config.

## R3. Money, date, duration formatting
- **Decision**: One module `lib/format.ts`. `formatMoney(amount: string, currency: string)` formats a **decimal string** from the API with `Intl.NumberFormat('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})` applied to the digit string split (no `Number()` on money), prefixed by the ISO code: `USD 1,240.00`. `formatDate(iso)` gives `18 Nov 2026` via fixed English month abbreviations. `formatDuration(minutes)` gives `2h 15m`. Any null, undefined, empty or unparsable input returns an em dash.
- **Rationale**: Constitution V and spec FR-008/009/010; avoids float rounding.

## R4. Routes
- **Decision**: Follow `docs/UI-SPEC.md` §1: `/login`, `/`, `/search`, `/trip/:tripId`, `/hotels/:hotelId`, `/trip/:tripId/book/:hotelId`, `/trips`. "Plan a trip" is active on every route except `/trips` and `/login`. Updated 2026-10-13: the router also has the transient `/auth/complete` (Google sign-in hand-off, outside the shell), unknown paths redirect to `/`, and every route except those two is wrapped in `RequireAuth` (login comes first).

## R5. API client and 401 handling
- **Decision**: `lib/api.ts` wraps `fetch`, adds `Authorization: Bearer <session token>` (the anonymous `X-Trip-Key` of plan 003 is no longer used, see constitution 3.4.0), and on any 401 clears the stored token and routes to `/login` with a `returnTo` value (plan 002).

## R6. Shared outbound HTTP helper
- **Decision**: `api/src/http.ts` `fetchJson(url, {ttlMs, timeoutMs, provider, rateKey, method, body, headers})`: `AbortController` timeout (default 8s), identifying `User-Agent` from `DATA_USER_AGENT`, a Postgres-backed cache (`http_cache` table), and per-host minimum spacing queue. Failure, timeout, 429 or non-2xx returns a typed `{ok:false, reason}` so callers produce `unavailable`; it never returns a stale or invented value.
- **Rationale**: User requirement "every outbound request has a timeout and is cached". Hotel rates, availability, prebook and book bypass the cache (`ttlMs: 0`, the default).

## R7. Containers and compose
- **Decision**: Services `postgres`, `api`, `web` in `compose.yaml`, images fully qualified (`docker.io/...`), `build.dockerfile: Containerfile`. Postgres `healthcheck: pg_isready -U $POSTGRES_USER -d $POSTGRES_DB`; `api.depends_on.postgres.condition: service_healthy` (podman compose behaviour depends on the provider, so the API also retries its initial connection for ~30s). Web publishes a fixed host port (`8080:80` by default; `WEB_PORT` overrides) and nginx proxies `/api/` to `http://api:3000` with SPA fallback `try_files $uri /index.html`.
- **init.sql caveat**: Postgres runs it only on an empty data volume; README says `podman compose down -v` to re-apply schema changes.
- **Ollama reachability**: Ollama runs on the host, not in compose; the user sets `OLLAMA_BASE_URL` (for Podman on Windows typically `http://host.containers.internal:11434`, unverified). No default is shipped.

## R8. Environment variables
- **Required, no default** (must be in local `.env`): `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_EMBED_MODEL`, `LITEAPI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `DATA_USER_AGENT`.
- **Defaulted in compose.yaml**: `POSTGRES_USER/PASSWORD/DB` (development values), `WEB_PORT=8080`, `REFRESH_CRON`, provider selectors (`HOTEL_PROVIDER=liteapi` etc.), `SESSION_TTL_DAYS=7`, `WARMUP_DESTINATIONS=30` (0 disables background pre-ingestion), `OLLAMA_NUM_CTX=32768`, `ADMIN_TOKEN` empty (admin endpoint disabled).
- **Optional, empty by default** (feature disabled and shown as such when unset): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (plan 002); `GMAIL_USER`, `GMAIL_APP_PASSWORD` (plan 007); `DUFFEL_ACCESS_TOKEN` (Duffel test-mode flights; unset: flights stay estimates); also defaulted in compose: `GUEST_NATIONALITY=US`, `BOOK_TIMEOUT_MS=20000`, `PAYMENT_PROVIDER`, `NOTIFICATION_PROVIDER` (updated 2026-10-13); `PUBLIC_BASE_URL` (default `http://localhost:8080`, used for OAuth return addresses).
- `.env.example` documents all with placeholders; `.gitignore` excludes `.env`.

## R9. Licence of the repository
- **Finding**: Transitous requires projects using its public API to be open source and non-commercial; Open-Meteo's free API is non-commercial only; the public OSRM and Nominatim servers and Overpass ask for light, non-commercial use.
- **Decision**: **MIT** (`LICENSE` at the repo root, "Copyright (c) 2026 Faro contributors"). It is an OSI-approved open-source licence, satisfying Transitous, and is the simplest permissive choice. A "non-commercial" licence (e.g. CC BY-NC) was rejected because it is not open source in the OSI sense and would not satisfy Transitous.
- **Consequence**: the *code* licence allows commercial reuse, but the *services* it calls do not. The README states that any deployment using the public Transitous, OSRM, Nominatim, Overpass or Open-Meteo free endpoints must stay non-commercial and that a commercial deployment must swap those providers (the provider interfaces allow this without touching the agent, routes or UI). Third-party text (Wikipedia/Wikivoyage CC BY-SA, GOV.UK OGL, OSM ODbL) keeps its own licence and attribution; it is not relicensed under MIT.

## R10. Testing stance
- No automated tests (spec constraint). Each `quickstart.md` is a manual validation script.
