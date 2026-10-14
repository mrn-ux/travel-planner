# Implementation Plan: Authentication and Session Management

**Branch**: `002-authentication-sessions` | **Date**: 2026-10-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-authentication-sessions/spec.md`. Shared stack, layout and conventions: [plan 001](../001-app-shell-navigation/plan.md).

## Summary

Email/password sign-up and login (bcrypt), Google sign-in (OpenID Connect authorization-code flow, server-side), opaque session tokens stored hashed, logout, login-first route guards (every screen but `/login`) with a preserved return path, login throttling, and the `/login` screen per `docs/UI-SPEC.md` §2.2 (updated 2026-10-13: full-page Ha Long Bay photo, welcome panel on the left, sign-in card on the right; the in-progress-trip hand-over is superseded). Identity providers sit behind an `IdentityProvider` interface (one real Google implementation); a user-preferences row backs the "Profile & preferences" menu entry.

## Technical Context

**Language/Version**: TypeScript 5, Node 20, React 18

**Primary Dependencies**: `bcrypt` ≥ 6 (prebuilt binaries; `node:20-slim` base to avoid musl build risk), `jose` (verify Google ID tokens against its JWKS), Node `crypto`

**Storage**: PostgreSQL tables `users`, `auth_identities`, `sessions`, `login_attempts`, `user_preferences`, `oauth_states`

**Testing**: None; manual quickstart

**Target Platform**: Podman compose

**Project Type**: Web application (api + web)

**Performance Goals**: Login round trip under 1s excluding bcrypt cost; bcrypt cost factor 12

**Constraints**: Passwords never logged or returned; every query that touches trips scopes by `user_id`; session token never stored in plain text

**Scale/Scope**: Workshop scale

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| I Simplicity | Pass | Plain functions in `api/src/auth/`; no passport/auth framework. The `IdentityProvider` interface is a provider interface required by IV, not an extra layer. |
| II Multi-user | Pass | bcrypt hashing; opaque tokens (random 32 bytes, SHA-256 stored); all trip queries scoped to `user_id`. There are no anonymous drafts any more (login comes first, constitution 3.4.0). |
| III Agent discipline | n/a | |
| IV Provider abstraction | Pass | `providers/identity/{IdentityProvider.ts,GoogleIdentityProvider.ts}`, enabled by config presence; no mocks. |
| V Money | n/a | |
| VI Certainty | n/a | |
| VII Design fidelity | Pass | Login card follows UI-SPEC §2.2 with design-system Input/Button. |
| VIII No silent failure | Pass | Every failure mode has a visible message (see contracts). |

## Project Structure

### Documentation (this feature)

```text
specs/002-authentication-sessions/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── auth-api.md
    └── providers.md
```

### Source Code

```text
api/src/auth/
├── passwords.ts        # hash/verify with bcrypt
├── sessions.ts         # create/lookup/revoke (hash of token)
├── middleware.ts       # requireUser (applied to every /api route but auth, health, public config, admin), optionalUser (legacy, one route)
├── throttle.ts         # login_attempts window check
├── accounts.ts         # create password user, find account, sign in with identity (link by subject, then verified email), preferences
├── tripHandover.ts     # legacy draft-trip claim hook (inert since login-first)
└── routes.ts           # /api/auth/*
api/src/providers/identity/
├── IdentityProvider.ts
└── GoogleIdentityProvider.ts
web/src/pages/login/{LoginPage.tsx,AuthCompletePage.tsx}, web/src/lib/{session.ts,auth.tsx}, web/src/components/{RequireAuth.tsx,AvatarMenu.tsx,PageBackdrop.tsx,ThemePicker.tsx}
```

**Structure Decision**: Auth code is its own folder because later plans import only `requireUser` and the user id.

## Reconciliations With Other Documents

- **UI-SPEC §2.2 (login)** is followed with one deliberate omission: 400px card, wordmark in `3xl`, Email, Password, **Log in**, "or" divider, **Continue with Google**, error area, toggle to sign-up (Name, Confirm password, **Create account**). The mockup's **Continue with Apple** button is removed by the owner's decision (constitution v3.1.0, spec 002).
- Updated 2026-10-13 (visual refresh; the card's fields, order and buttons are unchanged): the page is a full-page **Ha Long Bay** photo (`PageBackdrop bold`; the only route that needs an unauthenticated image, hence `GET /api/places/destination-photo` is public) with a **welcome panel** on the left (Faro mark and name and the headline in warm yellow, four colour-highlighted benefit bars, a "Test mode ... sandbox bookings" note, tokens `photo-*`) and the sign-in card on the right (`max-w-login` 400px, `surface/95`, heading "Welcome back" / "Create your account" with a one-line subtitle instead of the 3xl wordmark). The **ThemePicker** sits at the top right. On narrow screens the panel stacks above the card. Sign-up asks for name, email, password and confirmation.
- UI-SPEC says a failed attempt shows "Incorrect email or password"; this matches spec FR-005.
- **Google** works on `http://localhost:8080` with a web OAuth client; with the Google variables unset the button renders disabled with the note "Google sign-in is not configured." (spec FR-015). A failed or cancelled Google round trip returns to `/login?error=<code>` (`cancelled`, `expired`, `unverified_email`, `not_configured`, `failed`), shown as a message in the card.

## Complexity Tracking

| Item | Why needed | Simpler alternative rejected because |
|---|---|---|
| `auth_identities` table | A user can have password and Google identities | Columns on `users` cannot represent multiple identities cleanly |
