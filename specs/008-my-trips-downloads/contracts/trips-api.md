# Contract: My Trips and Download API

> Updated 2026-10-13 (implementation sync): delete endpoint, richer `TripCard`, flight reference, hero band. `GET /api/trips` recalculates every listed trip's budget before reading it, so the totals are current.

Conventions: [platform contract](../../001-app-shell-navigation/contracts/platform.md).

| Method & path | Auth | Request | Success | Failures |
|---|---|---|---|---|
| `GET /api/trips` | session | none | 200 `{ trips: TripCard[] }` ordered by `updatedAt` descending (excludes drafts) | 401 |
| `DELETE /api/trips/:id` (Updated 2026-10-13) | session | none | 204 | 401; 404 not found/not owned; 409 `has_booking` (a confirmed or pending hotel booking, or a confirmed flight) |
| `GET /api/trips/:id/plan.pdf` | owner (session, or draft key for the planner's Download) | none | 200 `application/pdf`, `Content-Disposition: attachment` | 401; 404 trip not found/not owned; 500 `{ error }` (no partial file) |

## Shape

```ts
type TripCard = {
  tripId: string;
  title: string;                       // destination(s) and date range, e.g. "Japan Family Trip"
  destination: string | null;          // null => "Destination not chosen"
  startDate: string | null; endDate: string | null;
  budget: { amount: string; currency: string } | null;          // Updated 2026-10-13
  hotel: { status: 'not_booked'|'pending'|'confirmed'|'failed'; name: string | null; room: string | null; total: { amount: string; currency: string } | null };
  transport: { status: 'compare_only'|'not_selected'; label: string | null; bookingReference: string | null;   // reference set when a test flight is booked
               price: { amount: string; currency: string; certainty: Certainty; sandbox: boolean } | null };
  places: { count: number; names: string[] };
  estimatedTotal: { amount: string | null; currency: string | null; certainty: Certainty; partial: boolean };
  updatedAt: string;
};
```

## PDF content contract (acceptance-testable)

The file always contains these sections in this order, each either filled or marked "Not yet available":
1. Destination and dates
2. Day-by-day itinerary (Morning / Afternoon / Evening per day)
3. Selected hotel (and booking status/reference when confirmed)
4. Selected transport ("Compare only: Faro does not book transport."; Updated 2026-10-13: this line is printed even for a booked test flight, the flight booking itself is not yet in the file)
4b. Places to visit (Updated 2026-10-13)
5. Budget breakdown (six categories, estimated total, budget, remaining)
6. Footer: generation time, certainty note, source attributions

Rules: every price/schedule has its Confirmed / Estimated / Unavailable label; money `USD 1,240.00`, dates `18 Nov 2026`, durations `2h 15m`; no `NaN`, `undefined`, `null`, `Invalid Date` anywhere in the text.

## UI (UI-SPEC §2.8)
- Hero band (title "Your adventures", destination photo), then the heading *My trips*; grid of design-system Cards, 3 per row desktop, 1 mobile, 16px gap.
- Card: title; dates; status lines with dots (hotel dot filled only when `confirmed`; transport dot filled only when a flight is booked, then "Flight booked" with its reference; places dot filled when places are chosen); budget (when stated) and a boxed "Estimated total" (em dash when no figure); primary **Open** (`/trip/:tripId`), secondary **Download**, ghost **Delete** only for trips without bookings (confirmation dialog; otherwise the note "A trip with a booking cannot be deleted.").
- States: skeleton cards while loading; empty state ("Your travel story starts here. ...") with **Plan a trip** to `/`; error with Retry; Download shows "Preparing your plan" and disables until done, errors inline with Retry.
