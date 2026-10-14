# Implementation Plan: App Shell and Navigation (plus platform foundation)

**Branch**: `001-app-shell-navigation` | **Date**: 2026-10-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-app-shell-navigation/spec.md`, plus the technical direction given with `/speckit-plan`.

## Summary

Deliver the fixed top navigation bar, the router for the seven routes (plus the transient `/auth/complete` handler of plan 002), and the shared display rules (money, dates, durations, certainty badges, loading/empty/error states). Because this is the first plan, it also owns the platform foundation every other plan builds on: repository layout, the three-container compose setup, configuration and `.env` handling, the Tailwind token mapping from `docs/design/tokens/`, the HTTP client with 401 handling, the shared outbound-request helper (timeout + cache), and the single `init.sql` assembly rule. Other plans reference this one for these shared decisions.

## Technical Context

**Language/Version**: TypeScript 5.x throughout; Node.js 20 (API), React 18 + Vite (web)

**Primary Dependencies**: Express, `pg`, React Router 6, Tailwind CSS 3.4 (+ PostCSS, autoprefixer), nginx (web container). Per-feature dependencies are listed in each plan.

**Storage**: PostgreSQL 16 via `pgvector/pgvector:pg16`; one `db/init.sql` run on first boot; `pg` driver only (no ORM, no migrations, no seed data)

**Testing**: None (the spec excludes automated tests); each plan has a manual `quickstart.md` validation guide

**Target Platform**: Podman compose on a developer machine; modern desktop and mobile browsers

**Project Type**: Web application (`/api`, `/web`, `/db` at the repo root)

**Performance Goals**: Shell renders with the first paint of any screen; no layout shift when data arrives

**Constraints**: Browser calls the API on its own origin only (nginx proxies `/api`), so no CORS; no hex codes or literal sizes in component files; spacing only on the 4px steps; secrets only from environment

**Scale/Scope**: Workshop scale; seven routes, one nav bar

## Constitution Check

*GATE: passed before research; re-checked after design.*

| Principle | Status | Notes |
|---|---|---|
| I Simplicity | Pass | Plain functions and direct SQL; one abstraction (provider interfaces, owned by features 004/005/007). Config values are only those something reads. |
| II Multi-user | Pass | Auth owned by plan 002; shell only reads session state. |
| III Agent discipline | n/a here | Plan 003. |
| IV Provider abstraction | Pass | Shared HTTP helper is provider-neutral; providers live in `api/src/providers`. |
| V Money | Pass | Money formatting util takes decimal **strings**, never floats. |
| VI Certainty | Pass | One `CertaintyBadge` component and one `Certainty` type reused everywhere. |
| VII Design fidelity | Pass | Tokens read from `docs/design/tokens/*.css` into `tailwind.config`; see research R1. |
| VIII No silent failure | Pass | Shared `AsyncBoundary` renders loading/empty/error; formatters never emit NaN/undefined/null. |

## Project Structure

### Documentation (this feature)

```text
specs/001-app-shell-navigation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── ui-shell.md
    └── platform.md
```

### Source Code (repository root)

```text
compose.yaml
.env.example
.gitignore
LICENSE                        # MIT
README.md                      # states the non-commercial service terms and data-source licences
db/
├── Containerfile              # FROM docker.io/pgvector/pgvector:pg16; COPY init.sql
└── init.sql                   # assembled from every plan's data-model.md fragment
api/
├── Containerfile
├── package.json, tsconfig.json
└── src/
    ├── index.ts               # server start, config validation
    ├── config.ts              # reads env once; fails fast on missing required vars
    ├── db.ts                  # shared pg Pool
    ├── http.ts                # fetchJson(): timeout, User-Agent, cache, rate limit hook
    ├── errors.ts              # AppError -> JSON error shape
    └── providers/             # interfaces + implementations (plans 004, 005, 007)
web/
├── Containerfile              # node build -> nginx
├── nginx/default.conf.template  # /api proxy (re-resolves the api address), SPA fallback
├── index.html                 # Google Fonts: Spectral, Inter
├── tailwind.config.ts         # design tokens (only place with literal values)
└── src/
    ├── main.tsx, router.tsx
    ├── index.css              # colour-theme CSS variables (ocean, sunset, forest, violet), gradient background
    ├── lib/format.ts          # money, date, duration
    ├── lib/api.ts             # fetch wrapper, token, 401 handling
    ├── lib/theme.ts           # saved colour theme (localStorage, ocean by default)
    ├── lib/destinationPhoto.ts  # Wikipedia photo lookup for the backdrop and banners
    ├── components/            # Shell, AvatarMenu, ThemePicker, PageBackdrop, PageHero, RequireAuth, Mark,
    │                          #   CertaintyBadge, Money, DateText, Duration, AsyncBoundary, Skeleton, ds/ (design-system parts)
    └── pages/                 # one folder per route (home, search, trip, hotel, booking, trips, login)
```

**Structure Decision**: `/api`, `/web` at the root with `compose.yaml` beside them, as instructed. `db/` holds the Postgres Containerfile and `init.sql` so that the three containers each build from their own Containerfile. The user's wording "Containerfiles alongside" is read as one Containerfile per service directory.

## Reconciliations With Other Documents

- `docs/UI-SPEC.md` §2.1 is authoritative for the shell: 64px bar on `surface`, 1px `border`, mark + "Faro" in `lg` Spectral, then **Plan a trip** and **My trips**, avatar menu at the right with **Profile & preferences** and **Log out**. The spec's "Profile" is therefore "Profile & preferences".
- The spec said signed-out visitors see "Log in" in the avatar menu. Superseded: the shell is only rendered for a signed-in user. Amended 2026-10-13 (constitution 3.4.0): login comes first. There are no anonymous visitors or draft trips; every screen except /login and every API route except sign-in, health, public config and the admin refresh requires a signed-in user.
- Updated 2026-10-13 (visual refresh; layouts and regions of the mockups unchanged): the bar also holds a **ThemePicker** (four colour dots: Ocean, Sunset, Forest, Violet) left of the avatar, and is `surface/90` with a blur and `raised` shadow. Themed colours are CSS variables in `web/src/index.css` (`--c-bg`, `--c-accent`, ...) read by the tokens in `tailwind.config.ts` (`data-theme` on `<html>`, choice kept in `localStorage`). `PageBackdrop` puts a faint destination photo behind the app (under a 95% veil; the login page shows Ha Long Bay boldly). Every screen except Plan a trip (`/`) sits in a solid `surface` content panel (`rounded-lg`, `shadow-lift`) and shows a ghost **Back** button above it (browser history back; with no earlier page, `/search` for `/hotels/*` and `/trip/*`, else `/`). Search and plan pages open with a `PageHero` photo banner (`min-h-banner`). The body background is a soft accent gradient with two blurred glows. No photo credit is shown (see the spec amendment).
- Constitution v3.0.0 supersedes the spec wording "mock provider" and "no external API key"; `.env` now requires real sandbox/test keys (Gmail and Google sign-in are optional).

## Complexity Tracking

No violations.
