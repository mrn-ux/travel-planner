# UI Contract: App Shell

Source of truth for layout: `docs/UI-SPEC.md` §2.1 and `docs/design/` components (`NavItem`, tokens).

## Shell

| Aspect | Contract |
|---|---|
| Presence | Every route except `/login` and `/auth/complete`; each needs a signed-in user (`RequireAuth`, otherwise redirect to `/login`) |
| Bar | Fixed, 64px high (`h-nav`), full width, `surface/90` with backdrop blur, 1px `border` below, `raised` shadow |
| Left | Accent wayfinding mark + "Faro" wordmark (`lg`, Spectral 600); selecting it goes to `/` |
| Navigation | **Plan a trip** (`/`), **My trips** (`/trips`), in that order, `sm` weight 500 (design `NavItem`) |
| Active | `accent` text on `accent-soft`, radius `md`; Plan a trip active on every route except `/trips` (`/`, `/search`, `/trip/*`, `/hotels/*`, booking); My trips active only on `/trips` |
| Right | **ThemePicker** (four colour dots: Ocean, Sunset, Forest, Violet; `aria-pressed` on the chosen one), then the avatar button (initials) opening a dropdown: **Profile & preferences** (an in-menu panel, no route), **Log out** (the shell is only shown signed in; there is no signed-out form) |
| Back | Every route except `/`: ghost **Back** button above the content panel; goes back in this tab's history, or, with no earlier page, to `/search` (`/hotels/*`, `/trip/*`) or `/` |
| Content area | 32px padding desktop / 16px mobile below the bar, over the page backdrop. Every route except `/` sits in a solid `surface` panel (`rounded-lg`, `shadow-lift`, 16px / 24px padding); `/` has no panel (its form and chat have their own) |
| Backdrop | `PageBackdrop`: fixed destination photo (Wikipedia) behind everything under a `bg/95` veil, following the selected country; plus an accent gradient and two blurred glows on `body` (`index.css`) |
| Banner | `PageHero` on the search and plan pages: `min-h-banner` destination photo under a dark wash with white title and subtitle; accent gradient when there is no photo |
| Dropdown | `overlay` shadow, closes on Escape or outside click, returns focus to the avatar |

## Themes (updated 2026-10-13)

`web/src/lib/theme.ts`: `ocean` (default), `sunset`, `forest`, `violet`. `setTheme` sets `data-theme` on `<html>` and stores `localStorage['faro.theme']` (in try/catch; the theme still applies without storage). Colours are `R G B` variables in `web/src/index.css`; `tailwind.config.ts` maps `bg`, `surface-muted`, `border`, `accent*` to them.

## Shared components

| Component | Props | Behaviour |
|---|---|---|
| `AsyncBoundary` | `state: 'loading'|'empty'|'error'|'ready'`, `onRetry`, `emptyMessage`, `errorMessage` | Renders skeleton / empty message / error with Retry; never blank |
| `CertaintyBadge` | `certainty` | Design `StatusBadge`: check / tilde / dash glyph + word |
| `Money`, `DateText`, `Duration` | decimal string / ISO / minutes | Use `lib/format.ts`; invalid input renders an em dash |

## Formatting rules (testable)

| Input | Output |
|---|---|
| `("1240", "USD")` | `USD 1,240.00` |
| `("0", "EUR")` | `EUR 0.00` |
| `("-160.5", "USD")` | `-USD 160.50` |
| `"2026-11-18"` | `18 Nov 2026` |
| `135` minutes | `2h 15m` |
| `null`, `undefined`, `""`, `"abc"` | `—` |
