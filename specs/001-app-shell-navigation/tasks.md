---
description: "Task list for App Shell and Navigation (plus platform foundation)"
---

# Tasks: App Shell and Navigation (plus platform foundation)

**Input**: Design documents in `/specs/001-app-shell-navigation/` (plan.md, spec.md, research.md, data-model.md, contracts/ui-shell.md, contracts/platform.md, quickstart.md)

**Prerequisites**: none. This plan is built first; plans 002-008 depend on its Phase 1 and Phase 2.

**Tests**: None. The specification excludes automated tests; validation is the manual `quickstart.md`.

**Format**: `- [ ] T### [P?] [US#?] Description with file path`. `[P]` = can run in parallel (different files, no dependency on an unfinished task).

## Path Conventions

Repository root `C:\Users\mrn\source\repos\Travel-Planner\travel-planner`: `api/`, `web/`, `db/`, `compose.yaml`. Design tokens: `docs/design/tokens/*.css`. Mockups: `docs/design/Faro Screens.dc.html`, `docs/design/FaroBar.dc.html`.

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Create the directories `api/src/`, `web/src/`, `db/` at the repo root and add a root `.gitignore` excluding `.env`, `node_modules/`, `dist/`
- [X] T002 [P] Initialise `api/package.json` and `api/tsconfig.json` (Node 20, TypeScript 5 strict, ESM) with dependencies `express`, `pg`, `zod` and dev dependencies `typescript`, `tsx`, `@types/express`, `@types/pg`, `@types/node`
- [X] T003 [P] Initialise `web/` with Vite + React 18 + TypeScript (`web/package.json`, `web/tsconfig.json`, `web/vite.config.ts`, `web/index.html`) and add `react-router-dom` 6
- [X] T004 [P] Install Tailwind CSS 3.4, PostCSS and autoprefixer in `web/`; create `web/postcss.config.js`, `web/src/index.css` with the three `@tailwind` directives
- [X] T005 [P] Add `LICENSE` (MIT, "Copyright (c) 2026 Faro contributors") at the repo root if absent
- [X] T006 [P] Write `.env.example` at the repo root documenting every variable from research R8 (required: `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_EMBED_MODEL`, `LITEAPI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `DATA_USER_AGENT`; defaulted and optional ones as listed) with placeholder values only

---

## Phase 2: Foundational (Blocking Prerequisites)

**CRITICAL**: no user story and no other plan can start until this phase is complete.

- [X] T007 Create `db/init.sql` containing `CREATE EXTENSION IF NOT EXISTS vector;` and the `http_cache` table from `data-model.md`; add a header comment stating the fragment order 001 -> 002 -> 003 -> 004 -> 005 -> 006 -> 007
- [X] T008 [P] Create `db/Containerfile` (`FROM docker.io/pgvector/pgvector:pg16`, `COPY init.sql /docker-entrypoint-initdb.d/`)
- [X] T009 Implement `api/src/config.ts`: read all environment variables once, throw an error naming any missing required variable, expose typed values (including optional Google/Gmail/admin values and defaults from research R8)
- [X] T010 [P] Implement `api/src/db.ts`: one shared `pg.Pool` from config with a startup connect retry loop (about 30 s)
- [X] T011 [P] Implement `api/src/errors.ts`: `AppError` class and an Express error handler returning `{ error: string }` per `contracts/platform.md` (updated 2026-10-13: the early `{ error: { code, message, retryable } }` shape was dropped; validation failures add `fields`)
- [X] T012 Implement `api/src/http.ts`: `fetchJson(url, { ttlMs, timeoutMs, provider, rateKey, method, body, headers })` with `AbortController` timeout (default 8 s), identifying `User-Agent` from `DATA_USER_AGENT`, `http_cache` lookup/store, per-host minimum spacing queue, and a result type `{ ok: true, status, body } | { ok: false, reason }`; `ttlMs: 0` bypasses the cache
- [X] T013 Implement `api/src/index.ts`: Express app, JSON body parser, `GET /api/health`, `GET /api/config/public` returning only `{ stripePublishableKey }`, error handler, listen on port 3000 (updated 2026-10-13: every other `/api` route except `/api/auth`, `/api/admin/*` and `GET /api/places/destination-photo` sits behind `requireUser`)
- [X] T014 [P] Create `api/Containerfile` (`node:20-slim`, install, build, run `node dist/index.js`)
- [X] T015 Write `compose.yaml` with services `postgres` (healthcheck `pg_isready`), `api` (`depends_on: postgres: condition: service_healthy`, env from `.env` plus defaults), `web` (fixed published port `${WEB_PORT:-8080}:80`), fully qualified image names and `build.dockerfile: Containerfile`
- [X] T016 [P] Create `web/nginx/default.conf.template` (proxy `/api/` to `http://api:3000`, SPA fallback `try_files $uri /index.html`, no `Referrer-Policy: no-referrer`) and `web/Containerfile` (node build stage, nginx runtime stage)
- [X] T017 Create `web/tailwind.config.ts` reading values from `docs/design/tokens/colors.css`, `typography.css`, `spacing.css`, `radius.css`, `shadow.css`: colours (names from `docs/design/uploads/DESIGN-SYSTEM.md` section 7 plus chart colours and `modal-backdrop`), `fontFamily` (`display` Spectral, `sans` Inter), `fontSize` seven pairs, `borderRadius` sm/md/lg/full, `boxShadow` raised/overlay/modal, and a `spacing` scale restricted to 0, 1, 2, 3, 4, 6, 8, 12, 16 (research R1)
- [X] T018 [P] Add the Google Fonts links for Spectral and Inter (weights 400/500/600) to `web/index.html`
- [X] T019 [P] Implement `web/src/lib/format.ts`: `formatMoney(amount: string, currency: string)`, `formatDate(iso)`, `formatDuration(minutes)` per research R3 and the table in `contracts/ui-shell.md` (string-based money, em dash for null/undefined/empty/unparsable, never `NaN`/`undefined`/`null`/`Invalid Date`)
- [X] T020 [P] Create the shared type module `web/src/lib/types.ts` with `Certainty`, `Money`, `Provenance` and the API error shape
- [X] T021 Implement `web/src/lib/api.ts`: `fetch` wrapper adding `Authorization: Bearer <token>` (and a legacy `X-Trip-Key` if one is still stored; superseded by login-first, 2026-10-13), parsing the error shape, and on any 401 clearing the stored token, saving `returnTo` and navigating to `/login`
- [X] T022 [P] Create the design-system components used by every screen as React components in `web/src/components/ds/` ported from `docs/design/components/` (`Button`, `Card`, `Input`, `Select`, `NavItem`, `StatusBadge`, `KPICard`, `EmptyState`, `Modal`, `ChatMessage`, `BookingStepper`, `BudgetBreakdown`, `ComparisonTable`, `DayItineraryCard`, `DestinationCard`), replacing every `var(--...)` style object with Tailwind classes that reference the config tokens (no hex codes, no literal px outside the config)
- [X] T023 Create `web/src/main.tsx` and `web/src/router.tsx` with the seven routes from `docs/UI-SPEC.md` section 1: `/login`, `/`, `/search`, `/trip/:tripId`, `/hotels/:hotelId`, `/trip/:tripId/book/:hotelId`, `/trips`, each rendering a placeholder page component from `web/src/pages/*`

**Checkpoint**: `podman compose up --build` starts three containers and `/api/health` answers through the web origin.

---

## Phase 3: User Story 1 - Navigate between the two main areas (Priority: P1) MVP

**Goal**: the fixed top bar with the Faro name, Plan a trip and My trips, correct active item, on every screen except `/login`.

**Independent Test**: open `/`, `/search`, `/trips`; the bar is identical, the right link is highlighted, links navigate, no bar on `/login`.

- [X] T024 [US1] Implement `web/src/components/Shell.tsx`: fixed 64 px bar on `surface` with 1 px `border`, mark + "Faro" wordmark (`lg`, Spectral 600) linking to `/`, then NavItems **Plan a trip** (`/`) and **My trips** (`/trips`), content area with 32 px padding desktop / 16 px mobile, matching `docs/design/FaroBar.dc.html` (updated 2026-10-13: bar is `surface/90` with blur; added `ThemePicker`, a ghost **Back** button above the content on every route except `/`, a solid `surface` content panel on every route except `/`, and `PageBackdrop` behind the app; see `contracts/ui-shell.md`)
- [X] T025 [US1] Implement active-item logic in `web/src/components/Shell.tsx`: Plan a trip active on `/`, `/search`, `/trip/*`, `/hotels/*` and booking routes; My trips only on `/trips`
- [X] T026 [US1] Create a layout route in `web/src/router.tsx` that wraps every route except `/login` in `Shell` and leaves `/login` bare
- [X] T027 [P] [US1] Make the bar usable on phone widths per `docs/design/MobileBar.dc.html` (44 px touch targets, condensed spacing) in `web/src/components/Shell.tsx`

---

## Phase 4: User Story 3 - Safe, consistently formatted values (Priority: P1)

**Goal**: one place that guarantees money, date, duration and certainty rendering.

**Independent Test**: render each component with complete, partial and empty data; no raw placeholders appear.

- [X] T028 [P] [US3] Create `web/src/components/Money.tsx`, `DateText.tsx`, `Duration.tsx` wrapping `format.ts` with `tabular` styling
- [X] T029 [P] [US3] Create `web/src/components/CertaintyBadge.tsx` mapping `Certainty` to the design `StatusBadge` (check / tilde / dash glyph plus word)
- [X] T030 [US3] Add `web/src/lib/format.check.ts` (a plain script run with `npx tsx`) that asserts every row of the formatting table in `contracts/ui-shell.md`, used during manual validation

---

## Phase 5: User Story 2 - Avatar menu (Priority: P2)

**Goal**: the avatar menu with Profile & preferences and Log out (no signed-out form: login comes first).

**Independent Test**: open the menu on several screens; entries present; closes on Escape and outside click; focus returns.

- [X] T031 [US2] Implement `web/src/components/AvatarMenu.tsx`: avatar button (initials), dropdown with `overlay` shadow listing **Profile & preferences** and **Log out** for a signed-in user (a visitor never sees the shell: login comes first), matching the open menu in `docs/design/FaroBar.dc.html`
- [X] T032 [US2] Add keyboard handling to `AvatarMenu.tsx`: Escape and outside click close, focus returns to the avatar, accessible names on the button and items
- [X] T033 [US2] Add the `AvatarMenu` to `Shell.tsx` right-aligned and wire session state from `useAuth()` in `web/src/lib/auth.tsx` (updated 2026-10-13: the early `getUser()` stub in `session.ts` was replaced by the auth context of plan 002)

---

## Phase 6: User Story 4 - Loading, empty and error states (Priority: P2)

**Goal**: every screen has loading, empty and error states.

**Independent Test**: slow or fail a screen's data; each state appears while the bar stays.

- [X] T034 [US4] Implement `web/src/components/AsyncBoundary.tsx` with props `state: 'loading'|'empty'|'error'|'ready'`, `onRetry`, `emptyMessage`, rendering a skeleton, the message, or an error with **Retry** per `contracts/ui-shell.md`
- [X] T035 [P] [US4] Add skeleton primitives in `web/src/components/Skeleton.tsx` (text line, card, table row) using only token classes
- [X] T036 [US4] Wrap each placeholder page in `web/src/pages/*` with `AsyncBoundary` so later plans only supply data and content

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T037 Write `README.md` at the repo root: URL to open (`http://localhost:${WEB_PORT}`, default 8080), the seven required `.env` variables, optional variables, `podman compose up --build`, `podman compose down -v` for schema changes, the non-commercial service terms (Transitous, OSRM, Nominatim, Overpass, Open-Meteo), the MIT licence note, and a data-sources table with licence and attribution (OpenStreetMap contributors ODbL, Wikipedia/Wikivoyage CC BY-SA 4.0, Wikidata CC0, Open-Meteo CC BY 4.0, GOV.UK OGL v3.0, Frankfurter/ECB reference rates, Nager.Date, REST Countries, Transitous)
- [X] T038 [P] Add a grep check script `scripts/check-tokens.sh` that fails if `web/src` (excluding `tailwind.config.ts`) contains hex colours or literal `px` sizes
- [X] T039 Run every step of `specs/001-app-shell-navigation/quickstart.md` and fix any failures (all steps pass; step 5 re-run on /search with the api stopped: error with Retry, bar stays, Retry recovers; nginx now answers 502 in about 2 s instead of 30 s)
- [ ] T040 [P] Compare the built shell against `docs/design/Faro Screens.dc.html` frames 1c-1o and `Mobile Screens.dc.html` and fix any layout differences (shell bar checked in the browser: fixed, 64 px, correct active item, no bar on /login; the screen bodies are compared in plans 002-008)

---

## Dependencies & Execution Order

- Phase 1 -> Phase 2 -> user-story phases -> Polish. Phases 3-6 can run in any order after Phase 2; US1 is the MVP.
- Within Phase 2: T007 before T008; T009 before T010-T013; T012 before T013; T017 before T022; T019/T020 before T021; T023 last.
- Plans 002-008 start only after T023.

## Parallel Opportunities

- T002, T003, T004, T005, T006 (Phase 1); T010, T011, T014, T016, T018, T019, T020, T022 (Phase 2); T028 and T029; T038 and T040.

## Implementation Strategy

MVP = Phases 1, 2 and 3 (compose runs, shell navigates). Then add formatting (US3), avatar menu (US2), then states (US4), then polish.

---

## Added 2026-10-13 (implementation sync)

- [X] T041 [P] Colour themes: `web/src/lib/theme.ts`, `web/src/components/ThemePicker.tsx` (four dots in the bar), `--c-*` variables per `data-theme` in `web/src/index.css`, themed tokens in `web/tailwind.config.ts`
- [X] T042 [P] Visual layer: `web/src/components/PageBackdrop.tsx` (full-page destination photo under a veil), `web/src/components/PageHero.tsx` (photo banner), `web/src/lib/destinationPhoto.ts`, `web/src/lib/usePageImages.ts`
- [X] T043 Shell: **Back** button on every route except `/` and the solid content panel on every route except `/` (`web/src/components/Shell.tsx`)
