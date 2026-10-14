# Research: My Trips and Plan Downloads

## R1. PDF generation
- **Decision**: `pdfkit` (pure JS, no browser or native dependency), streamed straight to the HTTP response with `Content-Type: application/pdf` and `Content-Disposition: attachment; filename="<destination>-<start>-plan.pdf"` (filename sanitised to ASCII; falls back to `faro-trip-plan.pdf`).
- **Rationale**: Runs in the existing `api` container with no headless Chrome. The built-in Helvetica/Times fonts cover Latin text; characters outside them (non-Latin place names) need an embedded font, so the renderer embeds one open-licence TTF (e.g. an Inter/Noto subset bundled in the image) — **to be chosen at implementation** and listed in the README licences.
- **Alternatives**: headless-browser rendering (heavy, large image); DOCX/CSV (not a "plan" document); HTML (not a file travelers can keep).

## R2. Fresh on every request
- **Decision**: `GET /api/trips/:id/plan.pdf` reads the current rows in one transaction (so the file is internally consistent) and renders; nothing is stored or cached. The file footer prints "Generated 10 Oct 2026 14:05" using the standard date format and the trip's last-updated time.
- **Rationale**: Spec FR-006 and SCOPE §8.

## R3. Contents and layout
1. Title: trip title or destination, date range (`18 Nov 2026 – 26 Nov 2026`), travelers, budget currency.
2. Selected hotel (name, room, dates, price per night and total with certainty; booking status and reference if confirmed) and selected transport (mode, times, duration, price with certainty; "Compare only — not booked").
3. Day-by-day itinerary: per day, Morning / Afternoon / Evening with title, time, duration, cost + certainty, opening hours, travel minutes to next stop.
4. Budget breakdown: six categories, estimated total, budget, remaining (SQL strings), list of categories without a real figure, a "partial total" note when applicable.
5. Footer: generated time, "Prices marked Estimated or Unavailable are not guaranteed", sandbox note for LiteAPI-sourced prices, attribution lines for sources used (© OpenStreetMap contributors; Transitous; Open-Meteo where weather is shown).
- Empty sections print "Not yet available" with the reason; values that are null print an em dash. A shared formatter guarantees no NaN/undefined/null/Invalid Date (the same `format.ts` logic as the web app, ported or shared as a small module).

## R4. Trip cards query
- **Decision**: one SQL statement with `LEFT JOIN LATERAL` for the latest booking per trip and `trip_budget_totals(trip.id)` for the estimated total, `WHERE trips.user_id = $1 AND trips.status <> 'draft' ORDER BY trips.updated_at DESC`. Hotel status: `Not booked` (no booking), `Pending confirmation`, `Confirmed`, or `Failed`; the dot is filled only for `Confirmed`. Transport status "Compare only" with a hollow dot, or a filled dot and "Flight booked" with the reference when a confirmed `flight_bookings` row exists (Updated 2026-10-13), or "Not selected" when no transport is selected. The statement also joins the selected hotel, transport, places and budget fields, and the latest booking is the latest non-`in_progress` one, a confirmed one first.
- **Estimated total**: shown as "Estimated total" (never styled as confirmed); when every category is Unavailable or there is no figure the card shows an em dash and the API returns `certainty: 'unavailable'`. Updated 2026-10-13: the list recalculates each trip's budget (`recalcBudget`) before reading, so the numbers match the planner.

## R5. Client download
- **Decision**: the web app fetches with the `Authorization` header (a plain `<a href>` cannot send it), receives a blob, and saves it via an object URL; the button shows "Preparing your plan" and is disabled until done; failures show an inline error with Retry and no file is saved. A 401 follows the shared redirect behaviour.

## R6. Edge handling
- Delete (Updated 2026-10-13): refused with 409 `has_booking` when the trip has a confirmed or pending hotel booking, a refund pending, or a confirmed flight; the card hides the button for the same trips and the server enforces it independently.
- Trip deleted or not owned → 404 "Trip not found", no file. Rapid repeated clicks are ignored while a request is in flight. Special characters pass through the PDF font; text is wrapped, not truncated. A trip with no selections still downloads, with each empty section marked.

## Implementation notes (verified live, October 2026)

- **Font**: Inter from `@fontsource/inter` (WOFF files, SIL OFL 1.1). The Latin subset has Latin-1 plus common punctuation and the euro sign; Latin Extended has the rest of the Latin alphabets. The renderer draws text in runs so each character uses a font that has it. Scripts outside Latin are not covered.
- **Reading the file**: build in memory, then send, so a failure returns a JSON error and no partial file. `Cache-Control: no-store`.
- **Checked**: three trips (complete with a confirmed booking, destination only, empty) produce 21 KB, 14 KB and 14 KB files; none contains NaN, undefined, null or Invalid Date; an empty trip prints "Not yet available" for each section and an em dash for the total (not 0.00). Editing a trip and downloading again shows the change. A second account gets 404 for another user's file and an empty list; no session gets 401 for the list.
- **Plan reading is read-only**: the file uses `buildPlan` with proposals turned off, so it never calls the hotel provider.
