# Faro — Design System

The foundations, components and formatting rules for Faro, a conversational AI travel agent application that turns a described trip into a complete, bookable plan.

---

## 1. Character

Faro should feel like a knowledgeable human agent, not a search box or a spreadsheet of fares. It is consulted in conversation, then reviewed on screen.

- Warm, confident neutrals with one wayfinding blue-teal accent — calm enough to read a budget on, distinctive enough to feel like a trip, not a ticketing portal
- Every time-sensitive figure is visibly **confirmed**, **estimated**, or **unavailable** — certainty is never implied by omission
- Money, dates and durations are always formatted, never bare numbers dropped into a sentence
- Generous breathing room around the conversational agent; dense, scannable tables once the user moves into comparison and planning
- Restrained motion: fades and small translations for new agent messages and itinerary updates, nothing playful or bouncy
- Content coming from a provider (hotel descriptions, reviews) is visually set apart from the agent's own words — it is data on the screen, not something the product says on its own authority

---

## 2. Colour

### Neutrals

| Token | Hex | Use |
|---|---|---|
| `bg` | `#F7F9F9` | Page background |
| `surface` | `#FFFFFF` | Cards, panels, table background |
| `surface-muted` | `#EEF1F2` | Table headers, hover rows, inactive tabs, agent chat bubble |
| `border` | `#DCE2E4` | All dividers and input borders |
| `border-strong` | `#C2CBCE` | Focused inputs, emphasised separators |
| `text` | `#16242B` | Primary text, headings, prices |
| `text-secondary` | `#566269` | Labels, secondary rows, axis text, provider attribution |
| `text-muted` | `#8C969B` | Placeholders, disabled, empty states |

### Accent

| Token | Hex | Use |
|---|---|---|
| `accent` | `#0E6F8E` | Primary buttons, active nav, selected transport mode, focus rings |
| `accent-hover` | `#0A5871` | Hover and pressed states |
| `accent-soft` | `#E1F0F4` | User chat bubble, selected rows, active nav background, subtle fills |

### Semantic — certainty states

Every price, availability check, and schedule carries one of these three states. They are never implied by color alone — the word accompanies the color (see §5 Status badge).

| Token | Hex | Use |
|---|---|---|
| `confirmed` | `#1F7A4D` | Provider-confirmed price, availability, or booking |
| `estimated` | `#B8752E` | Ranges and figures not yet verified against a live provider |
| `unavailable` | `#76838A` | Could not be verified — neutral, not alarming |

### Semantic — budget & actions

| Token | Hex | Use |
|---|---|---|
| `over-budget` | `#C2410C` | Over-budget rows, plans exceeding the stated total |
| `under-budget` | `#2F8F5B` | Savings from an approved optimization, under-budget variance |
| `danger` | `#B3261E` | Cancel booking, delete trip, destructive confirmation |
| `focus-ring` | `#0E6F8E` | 2px ring, 2px offset, on every focusable element |

### Chart / category palette

Budget-breakdown charts and category legends draw from this palette, in this fixed order, matching the budget engine's categories (hotels, transportation, activities, food, local transport, miscellaneous). Library default palettes have no place in the system.

`#0E6F8E` (hotels) · `#B8752E` (transportation) · `#2F8F5B` (activities) · `#B3261E` (food) · `#6B4E8C` (local transport) · `#5F6B6F` (miscellaneous)

### Map markers

- Default pin: `accent` fill, white glyph, `full` radius
- Selected pin: `accent` fill, `surface` 2px ring, scaled up
- Hotel pin vs. attraction pin are distinguished by glyph, never by color, so the palette stays stable as more pin types are added
- Faro visualizes static points and daily stops on the map; it does not render live route optimization, so no in-progress/rerouting states exist

---

## 3. Typography

| Role | Family | Notes |
|---|---|---|
| Headings | **Spectral**, serif fallback | Page titles, card titles, destination names, recommendation headlines |
| Body & UI | **Inter**, sans fallback | Everything else, including agent conversation text |
| Prices & durations | **Inter** with `font-variant-numeric: tabular-nums` | Mandatory wherever money, dates, or durations appear |

Both families are served from Google Fonts.

### Scale

| Token | Size / line height | Use |
|---|---|---|
| `xs` | 12 / 16 | Table headers, badges, timestamps ("Updated 4m ago") |
| `sm` | 14 / 20 | Body text, table cells, chat messages, form labels |
| `base` | 16 / 24 | Default body, inputs |
| `lg` | 20 / 28 | Card titles, hotel names |
| `xl` | 24 / 32 | Budget KPI values, destination recommendation titles |
| `2xl` | 32 / 40 | Screen titles ("Trip Planner", "My Trips") |
| `3xl` | 40 / 48 | Home screen headline ("Where do you want to go?") |

Weights: 400 body · 500 labels and table headers · 600 headings and price/KPI values. Nothing heavier.

---

## 4. Layout, space, radius, elevation

**Layout** — a top navigation bar (logo, My Trips, profile) at 64px height; content area below fills the viewport width at 32px of page padding on desktop, 16px on mobile. The home screen centers the conversational intake panel in a max-width column; every other screen (search results, trip planner, hotel details, booking, my trips) fills the content width with cards and tables.

**Spacing** — a 4px base, restricted to `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`. Nothing in between. These are Tailwind's default steps `1 · 2 · 3 · 4 · 6 · 8 · 12 · 16`, so the scale needs no configuration of its own.

- Card padding: 24
- Gap between cards: 16
- Section gap: 32
- Table cell padding: 12 vertical, 16 horizontal
- Form field gap: 16
- Chat message gap: 12
- Itinerary timeline step gap: 24

**Radius** — `sm` 4 (badges, inputs) · `md` 8 (buttons, cards, chat bubbles) · `lg` 12 (modals) · `full` (avatars, map pins, pills)

**Elevation** — three levels, all soft and cool-tinted from `text`:

- `raised` — `0 1px 2px rgba(22,36,43,0.05)` — cards
- `overlay` — `0 4px 12px rgba(22,36,43,0.08)` — dropdowns, sort menus, hotel comparison tooltips
- `modal` — `0 16px 40px rgba(22,36,43,0.16)` — booking confirmation, cancel-trip dialog

Borders do most of the work. Shadows are a hint, not a feature.

**Icons** — line icons, 20px, 1.5px stroke, drawn in `text-secondary`. Transport-mode icons (flight, train, bus, car, transfer, taxi, metro, public transport, walking) switch to `accent` when selected as a preference or filter. Status icons pair with their status badge color (§5).

---

## 5. Components

**Button** — 40px tall, 16px horizontal padding, radius `md`, weight 500, `sm` text.

- *Primary*: `accent` background, white text. `accent-hover` on hover. Used for "Plan my trip", "Book now", "Confirm".
- *Secondary*: `surface` background, `border` outline, `text` label.
- *Ghost*: transparent, `text-secondary` label, `surface-muted` on hover. Used for "View alternatives", row actions.
- *Danger*: `danger` background, white text. Cancel booking, delete trip only.
- *Disabled*: 40% opacity, no pointer.

**Input / select** — 40px tall, 12px horizontal padding, `surface` background, 1px `border`, radius `sm`. On focus: `border-strong` plus the focus ring. On error: `danger` border with the message directly beneath in `xs` `danger` text.

Labels sit above the field in `sm` weight 500 `text-secondary`.

**Card** — `surface` background, 1px `border`, radius `md`, `raised` shadow, 24px padding. Optional title in `lg` Spectral.

**Chat message** — agent messages left-aligned, `surface-muted` background, radius `md`, `sm` text; user messages right-aligned, `accent-soft` background. Follow-up questions from the agent render as a short list, never a wall of text. A message carrying structured results (hotel cards, a recommendation list) renders those as cards beneath the message, not as text.

**Status badge** — `xs`, weight 500, radius `sm`, 2px/8px padding, always paired with its word:

- *Confirmed*: `confirmed` text on a 10% `confirmed` tint, with a check glyph
- *Estimated*: `estimated` text on a 10% `estimated` tint, with a tilde glyph
- *Unavailable*: `text-muted` text on `surface-muted`, with a dash glyph

This badge sits beside every price, availability check, and schedule in the product — hotel results, transport comparisons, itinerary cost lines, and the budget breakdown.

**Destination recommendation card** — rank number in `xl` Spectral, destination name in `lg`, a short `sm` `text-secondary` reason list (budget fit, season, activities, transport, safety), and a recommendation-score bar using the `accent` fill on a `surface-muted` track.

**Hotel / transport comparison table** — `surface` background, `surface-muted` header row, `xs` weight-500 uppercase `text-secondary` headers with modest letter-spacing. 1px `border` between rows, none after the last. Rows hover to `surface-muted`. Price columns right-aligned, tabular, each with a status badge. Sortable headers (price, rating, location, AI recommendation) show a small direction arrow in `text-secondary`.

**Day itinerary card** — one card per day, segmented into Morning / Afternoon / Evening in `sm` weight-500 `text-secondary` sub-headers. Each activity item shows title, estimated duration and cost (tabular), and an opening-hours note when relevant. A thin connector line between items carries the travel time between stops in `xs` `text-muted`.

**Budget breakdown** — a horizontal stacked bar using the chart palette (§2) in category order, with a legend beneath showing each category's amount in tabular figures. Totals row beneath in `xl` weight-600: Estimated total, Budget, Remaining — Remaining renders in `over-budget` when negative, `under-budget` when positive.

**Booking stepper** — horizontal steps (Select room → Verify availability → Price & terms → Guest details → Confirm → Pay → Confirmation). Completed steps show an `accent`-filled check on `accent-soft`; the current step is `accent` text and a solid dot; future steps are `border`-outlined and `text-muted`. The stepper never allows skipping ahead of a verified step.

**KPI card** — a card containing a `sm` `text-secondary` label above an `xl` weight-600 value in tabular figures. Used for Estimated total, Remaining budget, and trip-summary numbers on My Trips.

**Modal** — `surface`, radius `lg`, `modal` shadow, 32px padding, max width 480px, over a `rgba(22,36,43,0.4)` backdrop. Title in `lg` Spectral, actions bottom-right with the primary action last. Used for booking confirmation and cancel-trip confirmation.

**Nav item** — `sm` weight 500. Inactive `text-secondary`; hover `text`; active `accent` on `accent-soft` with radius `sm`.

**Empty state** — centred, 48px vertical padding, `sm` `text-muted` message, optional primary button beneath. Every list, chart, and "My Trips" view has one (e.g. "No trips yet — plan your first one").

---

## 6. Formatting rules

- **Money** is always `{CURRENCY} 1,240.00` — ISO currency code prefix (the traveler's preferred currency, which varies by trip), thousands separators, two decimals, tabular figures. Never a bare number.
- **Dates** are `DD MMM YYYY` — `18 Nov 2026` — consistently, everywhere.
- **Durations** are unit-labeled — `2h 15m`, never a bare decimal like `2.25`.
- **Percentages** carry one decimal: `23.4%`.
- **Every time-sensitive figure** (price, availability, schedule) carries its status badge — Confirmed, Estimated, or Unavailable — it is never shown bare, and estimated figures are never styled to look confirmed.
- **Nothing renders** `NaN`, `undefined`, `null` or `Invalid Date`. Ever — show an em dash or the relevant empty state instead.
- **Provider-sourced text** (hotel descriptions, reviews) is visually distinguished (quote styling or `text-secondary`) from the agent's own explanatory text, and is never treated or rendered as something the product itself asserts.

---

## 7. Tailwind mapping

The tokens above map to `tailwind.config.js` as follows. Every colour, font size and radius in a component comes from here; there are no hex values or literal sizes in component files.

```js
theme: {
  extend: {
    colors: {
      bg:              '#F7F9F9',
      surface:         '#FFFFFF',
      'surface-muted': '#EEF1F2',
      border:          '#DCE2E4',
      'border-strong': '#C2CBCE',
      text:            '#16242B',
      'text-secondary':'#566269',
      'text-muted':    '#8C969B',
      accent:          '#0E6F8E',
      'accent-hover':  '#0A5871',
      'accent-soft':   '#E1F0F4',
      confirmed:       '#1F7A4D',
      estimated:       '#B8752E',
      unavailable:     '#76838A',
      'over-budget':   '#C2410C',
      'under-budget':  '#2F8F5B',
      danger:          '#B3261E',
      'focus-ring':    '#0E6F8E',
    },
    fontFamily: {
      display: ['Spectral', 'Georgia', 'serif'],
      sans:    ['Inter', 'system-ui', 'sans-serif'],
    },
    fontSize: {
      xs:    ['12px', '16px'],
      sm:    ['14px', '20px'],
      base:  ['16px', '24px'],
      lg:    ['20px', '28px'],
      xl:    ['24px', '32px'],
      '2xl': ['32px', '40px'],
      '3xl': ['40px', '48px'],
    },
    borderRadius: { sm: '4px', md: '8px', lg: '12px' },
    boxShadow: {
      raised:  '0 1px 2px rgba(22,36,43,0.05)',
      overlay: '0 4px 12px rgba(22,36,43,0.08)',
      modal:   '0 16px 40px rgba(22,36,43,0.16)',
    },
  },
}
```

A `.tabular` utility applies `font-variant-numeric: tabular-nums`, and sits on every element that renders money, dates, or durations. The chart/category palette in section 2 is passed to the charting library explicitly, in fixed category order, since chart colours are props rather than classes.
