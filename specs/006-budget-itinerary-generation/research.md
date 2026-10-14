# Research: Budget and Itinerary Generation

## R1. Budget aggregation in SQL
- **Decision**: `budget_items` holds one row per costed thing (hotel stay, transport, each activity, meals, local transport, miscellaneous), each in the trip currency after conversion (`amount_trip NUMERIC(14,2)`) plus its original amount/currency and certainty. The SQL function `trip_budget_summary(trip_id)` returns, per category: `amount` (sum of non-null items), `item_count`, `missing_count` (items with null amount), `worst_certainty` (unavailable > estimated > confirmed), and a row of totals: `estimated_total`, `budget`, `remaining = budget - estimated_total`, plus `categories_without_real_figure` (categories whose items are all null/unavailable or absent). JavaScript only formats these strings.
- **Why**: Constitution V (database computes totals) and the brief ("reports which categories have no real figure").
- **Rule**: an unavailable cost is never counted as 0; the total is flagged *partial* when any expected category has no real figure.

## R2. Where each category's figure comes from

| Category | Source | Typical certainty |
|---|---|---|
| Hotels | selected hotel snapshot (nightly × nights, plus taxes if present) | confirmed (sandbox) or estimated |
| Transportation | selected transport price (a real fare when a feed provides one, otherwise the plan 005 fare estimate) | estimated; unavailable only when distance or a stored FX rate is missing |
| Activities | Overpass `fee` tag where present; otherwise unavailable | confirmed only if fee text parses to a number with currency; otherwise unavailable |
| Food | estimate: per-person daily allowance derived from the destination's cost level in the knowledge base | estimated |
| Local transport | OSRM road times × a per-km estimate, or a flat daily estimate when no stops | estimated |
| Miscellaneous | a fixed percentage of other categories (default 5%, one constant) | estimated |

If a category cannot be estimated from stored data it is `unavailable` and reported, never filled with a guess.

## R3. Currency conversion (Frankfurter)
- **Decision**: `FrankfurterSource` fetches `https://api.frankfurter.dev/v2/rates?base=<trip currency>` (current API v2 per docs; the quote-filter parameter is `quotes`, not v1's `symbols`; **confirm live**), storing one `fx_rates` row per `(base, quote, rate_date)` with `source_url` and `fetched_at`. Lifetime 24 h. Rates for a past date use `?date=YYYY-MM-DD` (available back to 1948).
- **Note**: Frankfurter v2 now blends central-bank sources; ECB-only requires `providers=ecb`. **Decision**: request `providers=ecb` so the stated source is the ECB; if that parameter is not accepted, label the source as returned.
- `convert_currency(amount, from, to, date?)` is a SQL function: `round(amount * rate, 2)` using the stored rate for that date (nearest earlier date), returning the rate row used; the result is always `estimated`. No rate stored → `unavailable`, no fallback.
- Licence/attribution for Frankfurter was not stated on the fetched page (**UNVERIFIED**); the README credits the ECB reference rates via Frankfurter.

## R4. Attractions and opening hours (Overpass)
- **Query**: `POST https://overpass-api.de/api/interpreter` `[out:json][timeout:25]; nwr["tourism"="attraction"](around:<r>,<lat>,<lon>); out center tags;` (and `historic`, `museum`), reading `name`, `opening_hours`, `fee`, `website`, `wikidata`. Public-instance guidance: well under 10,000 queries/day, identifying User-Agent, no parallel scripts, wait 30 s after a 429; cache 7 days; ODbL "© OpenStreetMap contributors".
- **Opening hours**: a small parser handles `Mo-Fr 09:00-17:00; Sa 10:00-14:00; Su off` and `24/7`; anything it cannot parse makes that attraction **ineligible for scheduling** with reason "opening hours unknown" (spec: never schedule outside hours). **Updated 2026-10-13**: this still holds when the planner picks attractions itself (no chosen places); a place the traveler *chose* is scheduled even with unstated or unreadable hours, treated as always open for the scheduler only, stored with `opening_hours_checked = false` and shown as "check before you go". Nothing is invented: the hours text stays empty. Public holidays (Nager.Date chunks) mark `PH off` days closed.
- **Fee**: `fee=yes/no` or parseable amounts only; otherwise cost unavailable (shown as "Cost unavailable").

## R5. Itinerary generation
- **Decision**: deterministic scheduler (not free LLM output):
  1. Candidates = **the places the traveler chose** (`trip_places`, updated 2026-10-13); with none chosen, attractions near the destination. Ranked by interest match (embedding similarity of the interests text to place name and kind) with a small boost for a Wikidata entry and stated hours; the best 40 enter the travel matrix.
  2. For each trip day, fill morning (09:00–12:30), afternoon (14:00–18:00) and evening (19:00–20:30; was 22:00) slots, at most 2, 2 and 1 activities; no morning activity on the arrival day and no afternoon activity on the departure day; insert a meal/rest block (lunch 12:30–14:00, dinner in evening) between activity groups.
  3. For each consecutive pair, ask `TransportProvider.roadTime` (OSRM) for travel minutes; a stop is accepted only if travel time fits before its start and the whole visit lies inside its opening hours on that weekday.
  4. ~~First and last day respect the selected transport's arrival/departure when known; otherwise default blocks and a note.~~ Superseded 2026-10-13: the first day has no morning activities and the last day ends after the morning, each with a note saying arrival and departure times are not part of the plan; the selected transport's times are not used.
  5. Day shapes: 2 activities + meals per half-day max; at least one rest block per day.
- **LLM role**: only phrases titles/notes from the tool data; it cannot add activities or times.
- **Edits**: removing or swapping an activity re-runs steps 2–5 for that day.
- **Trigger** (added 2026-10-13): the web page generates automatically when the plan opens (no itinerary, no scheduled activity, or the set of chosen places changed); `POST /plan/generate` also accepts specific days.

## R6. Budget proposals
- **Decision**: four generators, each returning `{kind, description, saving, payload}` where `saving` is computed in SQL as the difference between current and alternative item amounts:
  - *lower hotel tier*: next cheaper hotel with confirmed rate for the same dates from `search_hotels` (certainty carried).
  - *train instead of flight*: only when a train option for the route exists and arrives in time; flights have no price, so this proposal is offered only when a train price is known; otherwise omitted.
  - *fewer paid attractions*: drop the highest-fee attractions with a known fee.
  - *different dates*: only when the hotel provider returns cheaper rates for shifted dates (±3 days); computed from live rate lookups (not cached).
- **Rule**: a proposal whose saving cannot be established from real figures is not offered. The banner says so when none remain.
- **Apply**: `POST /plan/proposals/apply` with the checked ids; the server applies them in one transaction, recomputes, and returns the new plan; unchecked proposals are untouched.

## R7. Recompute triggers
- Changing a selection (plan 005), dates, travelers or an itinerary item calls `recalcBudget(tripId)`; the planner GET always returns the latest values and a `generatedAt`.

## Implementation notes (verified live, October 2026)

- **Frankfurter v2** answers `GET /v2/rates?base=EUR&quotes=USD,GBP&providers=ecb` with `[{date, base, quote, rate}]`; rates are stored per pair in `fx_rates` (24 h freshness, the latest stored rate is reused if a refresh fails). The fare estimator now reads the same stored rates.
- **Overpass**: the main `overpass-api.de` host and `overpass.kumi.systems` returned 504/500 for hours during testing while `z.overpass-api.de` and `overpass.openstreetmap.fr` worked, so the source tries four public instances in order (all real OSM data; a failure on all is "unavailable", never an invented list). After a 429 it reports "rate limited" for 30 s instead of holding the request.
- **Travel times**: one OSRM `table` request gives the whole duration matrix for the top 40 candidates plus the hotel, so a plan needs one routing call, not one per stop. Travel times are driving minutes, labelled Estimated.
- **Opening hours**: the parser reads weekday ranges, `24/7`, `off` and `PH` rules. Anything else (seasonal rules like `Nov-Mar: ...`, week numbers, sunrise, hours past midnight) makes the attraction ineligible. Of 197 Paris attractions, the ones with readable hours are scheduled; the plan waits for an opening time (a 10:00 museum starts at 10:00) rather than dropping it.
- **Food, local transport, miscellaneous** have no price source, so they are labelled Faro estimates from one constants object (`budget/recalc.ts`: USD 45 per adult and 25 per child per day for food, USD 8 per person per day local transport, 5% miscellaneous), converted with the stored rate. The 'per-km from OSRM' local-transport idea in R2 was replaced by the flat daily allowance. **Covered by constitution v3.3.0, which extends the estimator exception to these allowances.**
- **Transport** is counted twice (outbound and return, same price assumed) when the trip has an end date.
- **Hotel taxes** that LiteAPI reports as not included (for example a city tax) are payable at the hotel and are not in the budget total.
- **Timing**: cold itinerary generation took about 46 s (Overpass, 200 names embedded, matrix); with caches warm about 13 s. The 15 s target is met only warm.
- **Proposals** are made once per over-budget state and kept until a selection or itinerary change; applying checks each one is still valid (409 otherwise).

## Implementation notes added 2026-10-13 (implementation sync)

- **Places gate and source**: the plan opens only when at least one place is chosen (`trip_places`, plan 005). City trips use `fetchPlaces` (Overpass); whole-country trips use the Wikidata list, and their places carry Wikidata ids (`Q...`), so itinerary items for them use source `wikidata` with a Wikidata link. The itinerary generator still calls `fetchAttractions` around the destination centre (Overpass, four public instances in order starting with `z.overpass-api.de`); if that fails, generation is refused and the last plan stays (even though the chosen places are stored). Chosen places are planned as saved, even if they lie beyond the centre's neighbourhood.
- **Time slots and visit lengths** (constants in `generate.ts`): morning 09:00-12:30, lunch 12:30 (90 min), afternoon 14:00-18:00, rest 18:00 (60 min), evening activities 19:00-20:30, dinner after them (90 min); visit lengths by kind (museum 120, gallery 90, castle 120, cathedral 60, monument 45, default 60 minutes), shown as estimates; a 5 minute buffer after each trip; at most 14 days. Travel times come from one OSRM `roadMatrix` call (`TransportProvider.roadMatrix`), driving minutes, certainty Estimated; the scheduler waits for a place's opening time when needed.
- **Budget on every read**: `buildPlan` calls `recalcBudget(tripId, true)` before reading the SQL summary, so the planner always shows current figures; proposals are kept while over budget and deleted when back within budget. Activity costs come from the places' stated charge (parseable "EUR 12" style) or `fee=no` (0.00); otherwise Unavailable. A confirmed hotel booking (plan 007) replaces a selected room as the hotel cost; the stay total (all rooms) is used, not the nightly rate times nights.
- **Selected lists and download**: the plan response now also returns `selectedPlaces` and, for transport, `bookable`, `booked` and `bookingReference` (Duffel test flights, constitution 3.5.0). The plan file (plan 008) reads the same `buildPlan` without making or changing proposals.
- **Header**: the planner header shows **Download** only; the ghost "Edit in chat" button of UI-SPEC 2.5 is not rendered.
- **Tools**: `search_attractions`, `calculate_budget` and `create_itinerary` are registered together in `api/src/tools/planTools.ts`; `convert_currency` is in `convertCurrency.ts`.
