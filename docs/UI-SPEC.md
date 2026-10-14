# Faro — Interface Specification

The screens of Faro, a travel planner, and what appears on each. Colours, typography, spacing and components come from [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md). Boundaries and behaviour come from [`SCOPE.md`](SCOPE.md).

Every layout here is exact. Regions, their order, their proportions and their alignment are part of the specification, not suggestions — two people building from this document produce the same screen.

---

> Amended 2026-10-13: see section 4 (Visual layer) for the photo banners, background, themes and login page, and the specs for the Hotels/Transport/Places flow, flight booking, multi-room booking and trip deletion.

## 1. Routes

| Route | Screen | Access |
|---|---|---|
| `/login` | Log in / sign up | Public |
| `/` | Home (trip intake) | Public |
| `/search` | Search results | Public |
| `/trip/:tripId` | Trip planner | Public to view |
| `/hotels/:hotelId` | Hotel details | Public |
| `/trip/:tripId/book/:hotelId` | Booking | Logged in |
| `/trips` | My trips | Logged in |

These seven routes are the whole application — the screens listed in `SCOPE.md` §8, plus the log in / sign up screen they all sit behind.

Login comes first. `/login` is the only screen reachable without an account; Home, Search results, Trip planner, Hotel details, Booking and My trips all require an authenticated session. Opening any of them without one redirects to `/login` and returns there once login succeeds. Every trip belongs to the signed-in user from the moment it is created.

---

## 2. Screens

### 2.1 App shell

Present on every route except `/login`.

```
┌──────────────────────────────────────────────────────────────┐
│ ⟐ Faro     Plan a trip     My trips                 ⦿ Avatar │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│                        screen content                         │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

A top bar, 64px tall, full width, on `surface` with a 1px `border` beneath it. Content fills the rest of the viewport on `bg`, with 32px of page padding on desktop and 16px on mobile.

The bar holds, left to right: a small accent-coloured wayfinding mark beside the **Faro** wordmark in `lg` Spectral; then two navigation items, **Plan a trip** and **My trips**, each `sm` weight-500; then, right-aligned, an avatar button that opens a dropdown with **Profile & preferences** and **Log out**.

**Plan a trip** is the active item on `/`, `/search`, `/trip/:tripId`, `/hotels/:hotelId`, and `/trip/:tripId/book/:hotelId` — the whole planning-through-booking flow. **My trips** is active only on `/trips`. The active item is `accent` text on `accent-soft` with radius `sm`; the other is `text-secondary`.

There is no sidebar, the navigation order never changes, and the bar is present and identical on every screen it appears on.

---

### 2.2 `/login`

```
┌────────────────────────────┐
│          ⟐ Faro            │
│                            │
│  Email    [____________]   │
│  Password [____________]   │
│                            │
│  [        Log in        ]  │
│                            │
│  ───────── or ─────────    │
│  [ Continue with Google ]  │
│  [ Continue with Apple  ]  │
│                            │
│  · error message area ·    │
│                            │
│  New here? Create account  │
└────────────────────────────┘
```

A single card 400px wide, centred both horizontally and vertically on a `bg` page. No shell.

Inside the card, in order: the **Faro** wordmark and mark in `3xl` Spectral, centred; an Email field; a masked Password field; a full-width primary button labelled **Log in**; a labelled divider "or"; two full-width secondary buttons for social login, each with its provider's icon; an error area that shows "Incorrect email or password" on a failed attempt and is otherwise empty; and, beneath everything, a centred `sm` link toggling the card into sign-up mode.

Sign-up mode adds a Name field above Email and a Confirm password field beneath Password, changes the primary button label to **Create account**, and changes the bottom link to **Already have an account? Log in**. Social login behaves identically in both modes.

Field labels sit above their inputs, 16px between fields.

---

### 2.3 `/` — Home (trip intake)

```
┌──────────────────────────────────────────┬─────────────────┐
│                                            │  Trip so far    │
│        Where do you want to go?           │                 │
│                                            │  Destination    │
│  [ I know my destination ]                │  Not set yet    │
│  [ Recommend somewhere for me ]           │                 │
│  [ Just exploring ]                       │  Dates           │
│                                            │  Not set yet    │
│  ┌──────────────────────────────────┐    │                 │
│  │  Faro: Hi! Tell me about the      │    │  Travelers       │
│  │  trip you're picturing.           │    │  Not set yet    │
│  │                                    │    │                 │
│  │                 You: 8 days in    │    │  Budget          │
│  │                 Japan with my      │    │  Not set yet    │
│  │                 family             │    │                 │
│  └──────────────────────────────────┘    │  … remaining     │
│                                            │     fields …     │
│  [ Message Faro…            ] [ Send ]    │                 │
│                                            │ [ See results ] │
└──────────────────────────────────────────┴─────────────────┘
```

Two columns, 16px apart, within the shell's content area. The left column is the trip form, and the right column is the agent chat; on mobile, the form stacks above the chat. The form column is a fixed 360px on desktop and flexible on smaller screens; the chat column is flexible width (480px minimum).

**Trip form column (left).** A card containing the full trip intake form for all fields in `SCOPE.md` §4 in this order — Destination, Dates, Duration, Travelers, Budget, Transport preference, Accommodation preference, Activities / interests, Special requirements. Each field is editable by the user: text fields use standard inputs, date fields use date pickers, numeric and budget entries use number inputs, and selection-based fields use dropdowns with the current value preselected. The card's header row holds the title **Trip details** and, right-aligned, a ghost **New trip** button (disabled while the current trip is still empty). Choosing it asks for confirmation in a modal, then opens a blank trip: the previous trip stays in My trips. The form is always available and can be filled without chatting with the agent. As values change, the trip state updates immediately, and the right-side chat reflects the same information.

**Chat column (right).** The conversation area allows either an alternative input method or a guided assistant flow. Before the first message, the headline "Where do you want to go?" in `3xl` Spectral, centred, with three starter chips beneath it — **I know my destination**, **Recommend somewhere for me**, **Just exploring** — each sending a canned opening message when clicked. Once a message has been sent, the headline and chips are replaced by the message list: agent messages per the Chat message component, left-aligned on `surface-muted`; user messages right-aligned on `accent-soft`. A follow-up question from the agent renders as a short list within its message, never a wall of text. A pinned input row sits at the bottom of the column: a text field and a **Send** button. The chat is optional and does not replace the form; it complements it.

**Shared behavior.** The trip summary beneath the form or within the chat remains synced to the same trip state. A primary button **See results** sits beneath the form and is disabled until Destination (or an explicit "recommend one" choice), Dates or Duration, Travelers, and Budget are all set; enabled, it leads to `/search`.

---

### 2.4 `/search` — Search results

```
┌──────────────────────────────────────────────────────────────┐
│  Search results      Japan · 18–26 Nov · 2 adults, 2 children │
├──────────────────────────────────────────────────────────────┤
│  Recommended destinations                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                       │
│  │ 1. Tokyo │ │2. Osaka  │ │3. Kyoto  │                       │
│  └──────────┘ └──────────┘ └──────────┘                       │
├──────────────────────────────────────────────────────────────┤
│  [ Hotels ]   Transport                                       │
│  Check-in [__] Check-out [__] Guests [__] Rating [All ▾]      │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ Hotel            │ Category │ Location │  Price │ Rating ││
│  │───────────────────┼──────────┼──────────┼────────┼────────││
│  │ Park Hyatu Tokyo  │ ★★★★★    │ Shinjuku │ ✓3,200 │  4.8   ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

Three bands, in this order, 32px apart.

**Header.** The page title *Search results* in `2xl` on the left; right-aligned on the same line, a row of read-only trip-summary pills — destination, dates, travelers — each opening the Home chat, scrolled to the relevant point, when clicked.

**Destination recommendations.** Shown only when no destination is set. A row of Destination recommendation cards, three per row on desktop stacking to one on mobile, ranked 1 to *n*, each with its reason list and recommendation-score bar per the design system. Selecting one sets the trip's destination and replaces this band with the comparison band below.

**Comparison.** Two tabs, **Hotels** and **Transport**, Hotels active by default; the inactive tab styled as a Nav item. Beneath the tabs, a filter row, then a Hotel / transport comparison table inside a card.

- *Hotels filters:* Check-in, Check-out, Guests, Rating (select, first option *All*).
- *Hotels columns, in order:* Hotel (thumbnail + name), Category (stars or type), Location, Price per night (status badge + tabular, right-aligned), Rating, Actions (a single **View details** button, leading to `/hotels/:hotelId`).
- *Transport filters:* a multi-select of modes from `SCOPE.md` §5 (Flights · Trains · Buses · Rental cars · Private transfers · Taxis · Metro/subway · Public transportation · Walking).
- *Transport columns, in order:* Mode (icon), Provider, Departure, Arrival, Duration, Transfers, Price (status badge + tabular, right-aligned). A flight row carries a Book this flight button (test mode); trains, buses and the other modes are comparison only, never booked.

Both tables are sortable by price or AI recommendation; the hotel table is additionally sortable by rating and location, via small direction arrows on the relevant headers. Each has its own empty state for a filter combination that matches nothing.

---

### 2.5 `/trip/:tripId` — Trip planner

```
┌──────────────────────────────────────────────────────────────┐
│  Japan Family Trip · 18–26 Nov        [Download] [Edit in chat]│
├──────────────────────────────────────────────────────────────┤
│  ⚠ This plan is USD 650 over your USD 4,000 budget.            │
│    [ ] Train instead of flight — save USD 180                  │
│    [ ] 4-star hotel instead of 5-star — save USD 420            │
│                                          [ Apply selected ]     │
├───────────────────────────────────────┬────────────────────────┤
│ Day 1 — Tokyo                         │  Budget                 │
│  Morning  Arrive, transfer, check-in  │  ▇▇▇▇▓▓░░░░              │
│  Afternoon Asakusa, Senso-ji          │  Hotels       1,200      │
│  Evening  Tokyo Skytree, dinner       │  Transport      650      │
│ Day 2 — Tokyo                         │  Activities     400      │
│  … remaining days …                   │  Food            700     │
│                                        │  Local transport 250     │
│                                        │  Misc            150     │
│                                        │  ───────────────────    │
│                                        │  Estimated total 3,350   │
│                                        │  Budget          4,000   │
│                                        │  Remaining         650   │
│                                        ├────────────────────────┤
│                                        │  Selected hotels         │
│                                        │  ✓ Tokyo Hotel           │
│                                        │  ○ Kyoto Hotel           │
│                                        │  Selected transport      │
│                                        │  ✓ Tokyo → Kyoto         │
└───────────────────────────────────────┴────────────────────────┘
```

Three bands, in this order, 24px apart, within the shell's content area.

**Header.** The trip's destination(s) and date range in `2xl` on the left; right-aligned on the same line, a secondary button **Download** and a ghost button **Edit in chat** (returns to `/` with the trip's context loaded).

**Over-budget banner.** Shown only while the plan's estimated total exceeds the stated budget. An `over-budget`-coloured banner stating the overage, listing the engine's proposed changes from `SCOPE.md` §6 as individually checkable rows, each showing its own saving, with a primary button **Apply selected** that recalculates the plan from only the checked rows. Hidden entirely once the plan is at or under budget.

**Planner body.** Two columns, 16px apart — a flexible-width itinerary column and a fixed 320px budget column, stacking on mobile.

- *Itinerary column:* one Day itinerary card per day, in date order, each segmented Morning / Afternoon / Evening with duration, cost, opening-hours notes, and travel-time connectors per the design system.
- *Budget column:* the Budget breakdown component — stacked bar, legend, and totals (Estimated total, Budget, Remaining) — followed by two short lists, **Selected hotels** and **Selected transport**, each row a hotel or route name with a filled or hollow status dot showing whether it's been booked.

---

### 2.6 `/hotels/:hotelId` — Hotel details

```
┌──────────────────────────────────────────────────────────────┐
│  [          hero photo           ]                             │
│  [thumb][thumb][thumb][thumb]                                  │
├───────────────────────────────────────┬────────────────────────┤
│ Park Hyatt Tokyo   ★★★★★   4.8 (2,104) │  Rooms                 │
│                                         │  Deluxe King  ✓280/nt  │
│ "Soaring views over Shinjuku's neon…"  │  [ Select room ]       │
│  — provider description                │                        │
│                                         │  Twin Room    ✓240/nt  │
│ Amenities                               │  [ Select room ]       │
│  Wifi · Pool · Spa · Gym · …            │                        │
│                                         │  ───────────────       │
│ Map                                     │  3 nights × 240  720   │
│  [ map with hotel pin ]                 │  Taxes & fees     45   │
│                                         │  Total           765   │
│ Reviews                                 │  Cancel free until …   │
│  "Impeccable service throughout…"       │                        │
│  — guest review                         │  [ Continue to booking]│
└───────────────────────────────────────┴────────────────────────┘
```

Two bands, in this order.

**Gallery.** A hero image with a thumbnail strip beneath it, full content width.

**Body.** Two columns, 16px apart — a flexible-width details column and a fixed 360px booking column, stacking on mobile.

- *Details column, top to bottom:* hotel name (`lg` Spectral), category, and rating; the provider's description, visually set apart per the design system's provider-sourced-text rule; an Amenities list; a Map with the hotel's pin; a Reviews section, each review similarly set apart as provider-sourced text.
- *Booking column:* a Rooms list, each room a name, price per night with its status badge, and a **Select room** button. Once a room is selected, beneath the list: a price breakdown (nights × price, taxes & fees, total), the cancellation policy, and a primary button **Continue to booking**, leading to `/trip/:tripId/book/:hotelId` with the room preselected.

---

### 2.7 `/trip/:tripId/book/:hotelId` — Booking

```
┌──────────────────────────────────────────────────────────────┐
│  ✓ Room  →  ● Verify  →  ○ Price  →  ○ Guest  →  ○ Confirm →  │
│                                       ○ Pay  →  ○ Confirmation │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│                     step content (below)                      │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

A Booking stepper across the top of the content area, arriving with **Select room** already complete. Step content beneath changes with the current step; the stepper never allows skipping ahead of a verified step.

| Step | Content |
|---|---|
| Verify availability | A brief loading state, then either confirmation that the room is still available, or an `over-budget`-styled alert that it is not, with a button back to Hotel details to pick another room |
| Price & terms | The final price breakdown with a `confirmed` status badge, and the full cancellation policy text |
| Guest details | A form: primary guest name, email, phone, and an optional special-requests field |
| Confirm | A review card — hotel, room, dates, guests, total price — and a primary button **Confirm and pay** |
| Pay | The third-party payment provider's own embedded payment fields; Faro never builds its own card form |
| Confirmation | A success state with the booking reference, hotel, dates, and final price, a note that a confirmation email was sent, and two actions: **View in My trips** and **Resend email** |

A price change, a payment failure, or a provider timeout at any step surfaces as a `danger`-coloured inline alert naming what changed and the available next action (accept the new price, try payment again, or go back); the booking is never shown as confirmed until the provider's confirmation is received.

---

### 2.8 `/trips` — My trips

```
┌──────────────────────────────────────────────────────────────┐
│  My trips                                                     │
├──────────────────────────────────────────────────────────────┤
│ ┌────────────────────┐ ┌────────────────────┐                 │
│ │ Japan Family Trip   │ │ Bali Getaway        │                │
│ │ 18–26 Nov           │ │ Not booked yet      │                │
│ │ ✓ Hotels  ✓ Transport│ │ ○ Hotels  ○ Transport│                │
│ │ Estimated  USD 3,350│ │ Estimated  USD 1,800│                │
│ │ [Open] [Download]   │ │ [Open] [Download]   │                │
│ └────────────────────┘ └────────────────────┘                 │
└──────────────────────────────────────────────────────────────┘
```

A single band: the page title *My trips* in `2xl`, then a grid of trip cards, three per row on desktop stacking to one on mobile, 16px apart.

Each trip card, per the design system's Card component: destination(s) and date range as the title; a one-line booking-status summary with a filled or hollow dot for hotels and for transport; the estimated total as a KPI-style value; and two actions, a primary **Open** (to `/trip/:tripId`) and a secondary **Download**, generating the plan file described in `SCOPE.md` §8 from the trip's current data. An empty state reads "No trips yet — plan your first one" with a primary button back to `/`.

---

## 3. Rules applying to every screen

- **Money** is formatted with its currency code prefix, thousands separators, two decimals, tabular figures — `USD 1,240.00` — per the traveler's preferred currency for that trip
- **Dates** are formatted `18 Nov 2026`, consistently
- **Durations** are unit-labeled — `2h 15m` — never a bare decimal
- **Every time-sensitive figure** — price, availability, schedule — carries its Confirmed / Estimated / Unavailable status badge; an estimated figure is never styled to look confirmed
- **Loading states** appear wherever the interface is waiting on the agent or a provider
- **API and provider errors** surface to the user rather than failing silently
- **Nothing renders** `NaN`, `undefined`, `null` or `Invalid Date`
- **Provider-sourced content** — hotel descriptions, reviews, any text returned by a provider — is visually set apart from Faro's own text and is never treated as an instruction to the agent
- **The mockups are the reference.** Where a screen has been designed, the built screen matches that mockup — the same regions in the same order, the same proportions, the same alignment. This specification and the mockups agree; neither is re-interpreted or improved upon during implementation

## 4. Visual layer (amended 2026-10-13)

The layouts above are unchanged. The interface carries this visual layer on top of them; its code is `web/src/components/` (`PageBackdrop`, `PageHero`, `ThemePicker`, `Shell`) and `web/src/lib/destinationPhoto.ts`. Screenshots of the current screens are in `docs/screenshots/` (also `faro-screens.zip`); `docs/design/CURRENT-UI.md` describes them.

- **Themes.** Four colour themes (Ocean, Sunset, Forest, Violet) are chosen from dots in the top bar (and on the login page) and remembered in the browser (`faro.theme`). Themed colours are CSS variables in `web/src/index.css` read by tokens in `tailwind.config.ts`. Colours for text on photos (`photo-sun`, `photo-sky`, `photo-coral`, `photo-mint`, `photo-lilac`) are tokens too; no hex codes appear in components.
- **Banner.** Every screen except Login opens with a photo banner: title in `text-3xl`, a semibold friendly line, white text with a shadow over a dark wash; when no photo exists, an accent gradient. No photo credit or source label is shown anywhere.
- **Page background.** A fixed photo sits behind the whole app under a 95% page-colour veil with a blur, so it is only a faint tint. Every screen except /login holds its content on a solid panel, so text never sits directly on a photo; Plan a trip's form and chat are cards of their own.
- **Which pictures.** The chosen country (its city first) from the second page on; before a destination is chosen, a random dream destination. Hotels tab, hotel details and booking show lodging pictures (hotel, villa, cottage, resort, chalet, guest house). The Transport tab shows vehicles (airliner, high-speed train, bus, ferry, cruise ship, train). The Places tab shows the country. Pictures are Wikipedia lead images (free licence) fetched through `/api/places/destination-photo`, which refuses flags and maps.
- **Login.** Full-page Ha Long Bay photo; welcome text on the left with no box (headline in warm yellow, four colour-outlined benefit bars); the sign-in or sign-up card on the right.
- **Text.** Default weight is semibold; hint lines directly on the page use bold, darker text.
- **Controls.** New trip is a solid primary button with a plus sign. Back is a bold ghost button above every screen but Plan a trip.
- **Friendly copy.** Banners and steps use warm wording ("Step 1 of 3: find a cosy place to rest your head"); the product is never called an AI travel agent in the interface.
