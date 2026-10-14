# Faro — Design System

Faro is a conversational AI travel agent: a traveler describes a trip in their own words, and Faro turns it into a complete, bookable plan — destination options, hotels, transport, a day-by-day itinerary, and a budget — reviewed and booked on screen after being worked out in conversation.

This design system was built from a single source document: `uploads/DESIGN-SYSTEM.md` (included verbatim understanding — no Figma file, codebase, or slide deck was attached to this project). No logo or brand mark was provided, so **no logo exists in this system** — screens render the wordmark "Faro" in the display typeface wherever a mark would normally go. If a logo file exists, attach it and this system should be updated.

**Sources**
- `uploads/DESIGN-SYSTEM.md` — the full foundations + component spec (colour, type, spacing, elevation, component behaviour, formatting rules, Tailwind mapping). This is the ground truth for every token and component in this project.
- No Figma link, GitHub repo, or codebase path was given. If one exists, attach it so the UI kit can be verified against real screens instead of built from the spec alone.

---

## Character

Faro reads as a knowledgeable human travel agent, not a fare-search engine. The product is consulted in conversation, then reviewed on screen: a calm, confident neutral palette with a single wayfinding blue-teal accent, generous space around conversation, dense scannable tables once the user moves into comparison and planning, and a strict rule that every time-sensitive figure (price, availability, schedule) is visibly confirmed, estimated, or unavailable — never implied by omission.

---

## Content fundamentals

- **Address**: agent messages speak directly to the traveler in second person ("Where do you want to go?", "Here's what I found"), first person where the agent is the actor ("I found 12 hotels under your budget"). Never third-person ("the user") or passive ("your trip has been planned").
- **Tone**: a competent, calm travel agent — warm but not chatty, confident but never hyped. No exclamation marks, no "Amazing!"/"You're all set!! 🎉" energy. State what was found and what it costs; let the traveler decide.
- **Certainty language is load-bearing**: every price, availability check, or schedule is labeled Confirmed, Estimated, or Unavailable in both color and word (§ Status badge). Copy never states a figure as fact unless it has been verified against a live provider — "Estimated $1,240" not "$1,240", "Could not confirm availability" not silence.
- **Numbers are always formatted**, never bare: money carries an ISO currency code and two decimals (`USD 1,240.00`), dates are `18 Nov 2026`, durations are unit-labeled (`2h 15m`), percentages carry one decimal (`23.4%`). A raw float or bare integer next to a dollar sign or a date never appears.
- **Provider content is quoted, not spoken**: hotel descriptions, reviews, and other third-party text are visually set apart (quote styling or secondary-text color) and never phrased as something Faro itself is claiming.
- **No filler, no fabricated certainty**: `NaN`, `undefined`, `null`, `Invalid Date` never render — an em dash or an empty state stands in. Nothing is implied to be true that hasn't been checked.
- **Emoji**: not used in product copy. The one allowed exception implied by the source spec is semantic glyphs on status badges (check / tilde / dash) and transport-mode icons — these are line icons, not emoji.
- **Example lines** (style target, from the spec's own voice): "Where do you want to go?" / "No trips yet — plan your first one." / "Could not confirm availability."

---

## Visual foundations

**Colour** — warm-neutral surfaces (`#F7F9F9` page, `#FFFFFF` cards) with a single blue-teal accent (`#0E6F8E`) carrying all primary actions, active states and focus rings. Semantic color is reserved for meaning, never decoration: three certainty colors (confirmed green, estimated amber, unavailable grey) always paired with their word, and separate budget-variance colors (over-budget burnt orange, under-budget green) that are intentionally distinct from the certainty greens so "under budget" and "confirmed" never look interchangeable. A six-color fixed-order chart palette serves budget-category breakdowns only — never a charting-library default.

**Type** — Spectral (serif) for anything that should feel like editorial travel writing: page titles, card titles, destination names, recommendation headlines. Inter (sans) for everything else, including the agent's own conversation text. Prices and durations always carry `tabular-nums` so columns of numbers align. Three weights only — 400 body, 500 labels/headers, 600 headings and price/KPI values — nothing heavier; the system never reaches for a bold or black weight.

**Spacing** — a strict 4px base restricted to 8 steps (4·8·12·16·24·32·48·64 — Tailwind's defaults, unconfigured). Card padding 24, gap between cards 16, section gap 32. Nothing sits off-grid.

**Backgrounds** — flat color only. No photography, no gradients, no hand-drawn illustration, no repeating texture or pattern anywhere in the spec. The one image surface in the product is the map (points and daily stops, not photographic imagery).

**Animation** — restrained: fades and small translations for new agent messages and itinerary updates. No bounce, no playful easing, no attention-seeking motion. Motion is a transition aid, not a personality trait.

**Hover / press** — hover states darken (`accent` → `accent-hover`) or shift to `surface-muted`; there is no lightening-on-hover anywhere in the spec. No explicit press/active-shrink behavior is defined — treat press as the hover color held, no scale transform.

**Borders & shadow** — borders do most of the structural work (1px `border` on every card, input, table row); shadow is a soft, cool-tinted hint layered on top, not a primary device. Three elevation levels only: `raised` (cards), `overlay` (dropdowns, tooltips), `modal` (confirmation dialogs) — all tinted from the text color, never pure black, and all very soft (max 16px blur, max 0.16 opacity).

**Transparency / blur** — the only transparency in the spec is the modal backdrop (`rgba(22,36,43,0.4)`, no blur) and 10%-tint status-badge backgrounds. No frosted-glass / backdrop-blur anywhere.

**Imagery** — no photography is defined in the spec. Hotel/destination imagery will come from provider data at runtime; this system ships no stock or generic photography and makes no assumption about its color grade.

**Corner radius** — small and consistent: 4px badges/inputs, 8px buttons/cards/chat bubbles, 12px modals, full-round avatars/pins/pills. Nothing sharp, nothing heavily rounded.

**Cards** — white surface, 1px neutral border, 8px radius, `raised` shadow, 24px padding. A title (if present) is set in Spectral `lg`. No colored left-border accent, no colored card backgrounds.

**Layout rules** — a fixed 64px top nav (logo, My Trips, profile); 32px page padding on desktop, 16px on mobile. The home screen centers a conversational intake panel in a max-width column; every other screen fills the content width with cards and tables — the product shifts from "conversation" layout to "comparison/data" layout as the user moves through the flow.

---

## Components

Built under `components/` as `<Name>.jsx` + `<Name>.d.ts` + `<Name>.prompt.md` pairs, grouped by concern. The spec (§5) is the full inventory — nothing invented beyond it, except `Select` (listed as "Input / select" in the spec but not detailed as its own primitive — added as an intentional addition so dropdowns match Input's exact styling).

**core/** — `Button`, `Input`, `Select`, `Card`, `StatusBadge`, `NavItem`, `EmptyState`, `KPICard`, `Modal`
**chat/** — `ChatMessage`
**travel/** — `DestinationCard`, `ComparisonTable`, `DayItineraryCard`, `BudgetBreakdown`, `BookingStepper`

**Intentional additions**: `Select` (see above).

## Iconography

The spec defines a consistent **line-icon** system: 20px, 1.5px stroke, drawn in `text-secondary` by default. No icon font, no PNG icon set, and no SVG sprite sheet is attached to this project, so this system links **Lucide** (CDN) as the closest open-source match to a 1.5px-stroke line-icon set, and documents substitution here as instructed.

- Default icon color: `text-secondary`. Transport-mode icons (flight, train, bus, car, transfer, taxi, metro, public transport, walking) switch to `accent` when selected as a preference or filter.
- Status icons (check / tilde / dash) pair 1:1 with the status-badge colors (§ Status badge) and are always shown alongside the status word, never alone.
- No emoji are used as icons or in copy anywhere in the spec.
- No unicode glyphs are used as icons; the system relies on the icon set above throughout.
- **No logo or wordmark lockup was provided.** Every place a mark would sit (nav bar, loading states, empty states) renders the plain word "Faro" set in Spectral 600. If real logo files exist, drop them into `assets/` and swap the nav/`Logo` usage.

---

## Index

- `styles.css` — root stylesheet, `@import`s everything under `tokens/`.
- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `radius.css`, `shadow.css`, `fonts.css` (Google Fonts import — Spectral + Inter), `base.css` (resets, focus ring, link colors).
- `guidelines/` — 12 foundation specimen cards (colour ramps, type scale, tabular numerics, spacing scale, radius/elevation, wordmark, iconography) shown in the Design System tab under Colors / Type / Spacing / Brand.
- `components/core/` — Button, Input, Select, Card, StatusBadge, NavItem, EmptyState, KPICard, Modal.
- `components/chat/` — ChatMessage.
- `components/travel/` — DestinationCard, ComparisonTable, DayItineraryCard, BudgetBreakdown, BookingStepper.
- `ui_kits/app/` — the Faro web app: Home (conversational intake), Trip Planner (destination recommendations + chat), Hotel Comparison, Day Itinerary + Budget, My Trips. One interactive `index.html`.
- `SKILL.md` — Claude-Code-compatible skill wrapper for this system.
- `assets/` — empty: no logo or imagery was provided (see Iconography above).

---
