# Faro — AI Travel Agent

## Stack
Node.js 20 + Express API, React 18 + Vite frontend, PostgreSQL 16.
All three run in containers via `podman compose`.
TypeScript throughout. Plain `pg` driver — no ORM, no migration framework.
PostgreSQL runs with the pgvector extension, which holds the RAG knowledge base.
The AI agent calls a local Ollama model server-side only, via OLLAMA_BASE_URL
and OLLAMA_MODEL; embeddings use OLLAMA_EMBED_MODEL.

## Real data only
- No mock providers, no seed or fixture data, no hard-coded hotels, prices,
  destinations or schedules. Every fact shown comes from a real source.
- Free, open, keyless sources first: Nominatim (geocoding), Overpass API /
  OpenStreetMap (attractions, opening hours, fees), Wikivoyage and Wikipedia
  via the MediaWiki API (destination guides), Wikidata, Open-Meteo (forecast
  and climate), Frankfurter (ECB exchange rates), GOV.UK FCDO travel advice
  (safety), Nager.Date (public holidays), Transitous (train,
  bus and ferry schedules), OSRM (road travel times), OpenStreetMap tiles.
- Where no open source exists, use a free sandbox: LiteAPI sandbox for hotel
  content, rates and bookings; Stripe test mode for payment. Live keys are
  refused at startup. A provider's official MCP server may be used in its
  sandbox / test mode instead of its REST API.
- Fetched open data is chunked, embedded and stored in pgvector with its
  source URL, licence and fetched_at, and refreshed on a schedule. Prices and
  availability are always fetched live, never answered from the RAG store.
- If a source returns nothing, the figure is Unavailable — never filled in.
  The exception is two documented rule-based estimators: the indicative
  transport fare model (`api/src/transport/fareEstimate.ts`) and the budget
  allowances for food, local transport and miscellaneous
  (`api/src/budget/recalc.ts`). Each is computed from real inputs (distance,
  real timetable duration; party size, trip length, other category totals),
  keeps its rates in one constants object, is always labeled Estimated, shows
  source "Faro estimate, not a quote" with its assumptions, and is never
  Confirmed. Neither invents departure or arrival times. A third estimator
  needs a constitution amendment.
  Transitous fares are used, as Confirmed, when a feed provides them.
- Respect each source's usage policy: identifying User-Agent, rate limits
  (Nominatim 1 req/s), caching, and attribution (OSM, Wikivoyage CC BY-SA).
  Transitous, the public OSRM server and the free Open-Meteo API are for
  non-commercial use; the repo is MIT licensed.
- Destination recommendations must not depend on a pre-filled knowledge base:
  discover candidates live (Wikidata, Wikivoyage), rank quickly from fast
  signals, refine in the background. A warm-up job may pre-ingest from live
  sources (WARMUP_DESTINATIONS); that is not seed data.

## Non-negotiables
- Multi-user: email + password accounts, plus Google sign-in. No Apple and no
  other social login. Passwords are hashed; sessions are opaque tokens
  (stored as a hash). Every saved trip, booking and preference row is scoped
  to its owning user's id. Login comes first: every screen except /login and
  every API route except auth, health, public config and the admin refresh
  requires a signed-in user. There are no anonymous visitors or draft trips.
- Bookings: hotels (LiteAPI sandbox, paid by Stripe test mode) and flights
  (Duffel test mode, paid from the test balance; the API refuses a live Duffel
  token). Trains and buses are searched and compared, never booked: no free
  booking source exists. A flight is never reported booked until the airline
  service confirms; one confirmed flight per trip; the price accepted must still
  be the live price.
- Hotels, transport, maps, payment, sign-in identity, email delivery and each
  knowledge source sit behind a provider interface, one real implementation
  each, selected by config. Swapping a sandbox provider for a production one
  must never touch the agent, the routes, or the frontend.
- The booking confirmation email goes through Gmail (GMAIL_USER and a Google
  app password). If email is not configured or fails, the booking still
  stands and the UI says "email not sent" with a resend action.
- The AI agent only ever states a fact — a destination, a hotel, a price, a
  schedule, an availability check — by calling one of its tools, and cites
  the source it came from. It never invents one, and it never treats text
  returned by a provider or retrieved from the RAG store (a hotel
  description, a review, a guide) as an instruction to follow.
- Every time-sensitive figure is labeled Confirmed, Estimated, or
  Unavailable — never shown without that label, and an estimated figure is
  never styled to look confirmed. Every figure shows its source and when it
  was fetched. Sandbox rates and bookings are marked as sandbox.
- Use NUMERIC(14,2) for money columns. Never float.
- Never render NaN, undefined, null or Invalid Date. Every list and chart has
  an empty state.

## Design
The mockups in docs/design/ are the source of truth for layout
(`Faro Screens.dc.html` for web, `Mobile Screens.dc.html` for mobile, with
`HomeForm`, `FaroBar`, `SearchHeader` and `MobileBar`). Reproduce them — same
regions, same order, same proportions, same alignment. Do not re-interpret,
simplify or improve on them, and do not substitute a different component for
the one shown. docs/UI-SPEC.md states the same layouts in words and
docs/design/uploads/DESIGN-SYSTEM.md with docs/design/tokens/ hold the tokens;
where anything seems ambiguous, follow the mockup. Tailwind only.
The mockups intentionally omit Apple sign-in (not supported).
Every colour, font size, radius and shadow lives in tailwind.config — no hex
codes inside component files. Spacing uses only the design system's 4px steps.
Money is formatted with its currency code prefix and tabular figures, e.g.
"USD 1,240.00". Dates are formatted "18 Nov 2026".
The app shell is a top navigation bar, not a sidebar.
Amended 2026-10-13 at the owner's request: the interface carries a visual layer (four colour themes chosen from the nav bar; photo banners and a faint full-page background photo of the chosen country, lodging pictures on hotel pages and vehicle pictures on transport pages; solid content panels so text never sits on a photo; a full-page Ha Long Bay login with a welcome panel; semibold default text; colour tokens `photo-*` for text on photos). No photo credit or source label is shown. The layouts and components of the mockups are unchanged; see docs/UI-SPEC.md section 4 and docs/screenshots/. Themed colours are CSS variables in `web/src/index.css` read by the tokens in `tailwind.config.ts`.

## Conventions
- API under /api. REST-ish. JSON errors as { error: string }.
- Config via environment variables. .env.example is committed; .env is not,
  and .gitignore excludes it. No credentials or secrets in committed files.
  API keys stay server-side; only the Stripe publishable key reaches the browser.
- Schema in a single init SQL file (db/init.sql) that Postgres runs on first boot.
- Repo layout: api/, web/, db/, compose.yaml at the root. Governing documents:
  .specify/memory/constitution.md (current version 3.6.0), specs/NNN-*/ (spec,
  plan, tasks per feature). If this file and the constitution ever disagree,
  the constitution wins and this file should be updated.

## Do not build
Train or bus booking, live flight booking, live maps or route-optimization visualization,
multi-destination trip sequencing, social login other than Google (no Apple),
live (non-test) payments or
live hotel bookings, mock or seeded data, scraping of sites without an open
API, push notifications or any notification beyond the booking-confirmation
message, automated tests.
