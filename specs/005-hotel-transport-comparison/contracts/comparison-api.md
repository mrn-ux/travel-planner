# Contract: Comparison, hotel details and selection API

Conventions: [platform contract](../../001-app-shell-navigation/contracts/platform.md). These endpoints require a signed-in user (login first, constitution 3.4.0); "owner" is that user, as in plan 003.

| Method & path | Auth | Query / body | Success | Failures |
|---|---|---|---|---|
| `GET /api/trips/:id/hotels` | owner | `checkin, checkout, guests, rooms, minRating, sort=price\|rating\|location\|recommended, dir, page` (Updated 2026-10-13: `rooms` added; lodging type and budget come from the trip) | 200 `{ items: HotelRow[], total, hiddenCount, cheapest, page, pageSize, stay, provenance }` | 400 no destination / no dates / more rooms than adults; 404 place not found; 502/504 |
| `GET /api/hotels/:hotelId` | owner (via `tripId` query) | `tripId, checkin, checkout, guests, rooms` | 200 `{ hotel, images, description, amenities, location, reviews, reviewsNote, map, provenance }` (sections may be `null` with a reason) | 404; 502/504 |
| `GET /api/hotels/:hotelId/rooms` | owner | `tripId, checkin, checkout, guests, rooms` | 200 `{ stay, rooms: Room[], provenance }` (live rates, not cached; 12 offers, up to 80 when several rooms) | 502/504 |
| `GET /api/trips/:id/transport` | owner | `modes` (comma-separated), `from, date, sort=price\|duration\|departure\|recommended, dir` | 200 `{ items: TransportRow[], needsFrom, origin, destination, date, distanceKm, notes, provenance }` (`needsFrom: true` and no rows until a start place is given) | 400 no destination / no date; 404 place not found; 502/504 |
| `PUT /api/trips/:id/selection/hotel` | owner | `{ hotelId, roomId?, checkin, checkout, rooms? }` | 200 `{ selection }` | 409 unavailable; 404 |
| `DELETE /api/trips/:id/selection/hotel` | owner | | 204 | |
| `PUT /api/trips/:id/selection/transport` | owner | `{ optionId }` (from a prior list response) | 200 `{ selection }` | 404 |
| `DELETE /api/trips/:id/selection/transport` | owner | | 204 | |

### Places to visit and pictures (added 2026-10-13)

| Method & path | Auth | Query / body | Success | Failures |
|---|---|---|---|---|
| `GET /api/trips/:id/places` | owner | | 200 `PlacesResult` (the best 10 places for the trip's city, or for the whole country when no city is chosen; with photo, opening hours, entry; `selected` flag) | 400 no destination; 404; 502/503/504 |
| `GET /api/trips/:id/places/selected` | owner | | 200 `{ items: SelectedPlace[] }` | |
| `POST /api/trips/:id/places` | owner | `{ ids: string[] }` (bulk add) | 200 `{ items }` | 404 |
| `PUT /api/trips/:id/places/:placeId` | owner | | 200 `{ items }` (add one) | 404 not in the list any more |
| `DELETE /api/trips/:id/places/:placeId` | owner | | 200 `{ items }` | |
| `GET /api/places/photo` | signed in | `name, lat, lon` | 200 `{ photo: { url, creditUrl } \| null }` (Wikipedia lead image, else a Wikimedia Commons photo within 150 m; cached 30 days; fetched by the browser as each card appears) | 400 |
| `GET /api/places/destination-photo` | signed in | `name` | 200 `{ photo: { url, creditUrl, title } \| null }` (banner and background pictures; photographs only, no flags or maps) | 400 |
| `GET /api/places/countries`, `GET /api/places/cities?country=` | signed in | | country and city lists from the hotel provider (the Start country / Start city dropdowns and the home form) | |
| `GET /api/places/currency`, `GET /api/places/currencies` | signed in | | a country's currency for the budget field | |

The trip's start country and city are saved with the existing trip update (`PATCH /api/trips/:id`, fields `originCountry`, `originCity`; owned by plan 003).

## Shapes

```ts
type Priced = { amount: string | null; currency: string | null; certainty: Certainty;
                range?: { low: string; high: string };      // present for estimates
                basis?: string };                           // e.g. 'Indicative price from a distance-based model, not a quote'

type HotelRow = {
  hotelId: string; name: string; thumbnail: string | null; stars: number | null; category: string | null;
  area: string | null; distanceKm: string | null; rating: string | null;
  pricePerNight: Priced; recommendedReason: string; sandbox: true;
  total: Priced;                         // whole stay, added 2026-10-13
  roomTypes: string[]; maxPerRoom: number | null;   // from the hotel's own content; empty / null when not stated
};

type Room = {
  roomId: string; name: string; board: string | null; pricePerNight: Priced; total: Priced;
  roomDetails: Array<{ name: string; sleeps: number | null; beds: string | null }>;   // one per room in the offer, added 2026-10-13
  breakdown: { nights: number; nightly: string; taxesAndFees: string | null; total: string };
  cancellation: { refundable: boolean; freeUntil: string | null; text: string };
  occupancy: { adults: number; children: number }; certainty: Certainty; sandbox: true; offerId: string;
};

type TransportRow = {
  optionId: string;
  mode: 'flight'|'train'|'bus'|'ferry'|'metro'|'transit'|'car'|'transfer'|'taxi'|'walking';   // updated 2026-10-13 (was train|bus|ferry|flight|transit|road|unavailable)
  modeLabel: string;
  provider: string | null; departure: string | null; arrival: string | null; departureTz: string | null; arrivalTz: string | null;
  durationMinutes: number | null; durationCertainty: Certainty; transfers: number | null;
  price: Priced; scheduleCertainty: Certainty;
  priceSource: 'transitous-fare' | 'faro-estimate' | 'duffel-sandbox' | null;
  providerRef: string | null;            // the airline test service's offer id when the flight can be booked
  recommendedReason: string; note: string | null;   // why a row is Estimated or Unavailable
};
```

## Agent tools

| Tool | Arguments | Result |
|---|---|---|
| `search_hotels` | `{ checkin?, checkout?, guests?, minRating?, limit? }` (trip brief fills the rest) | `HotelRow[]` + provenance |
| `search_transport` | `{ from, modes?, date? }` (`from` required: the traveler's start place; Updated 2026-10-13) | `TransportRow[]` + provenance |

Hotel description/review/amenity text and operator names are returned as data and wrapped as untrusted by the prompt builder.

## UI states (UI-SPEC §2.4 and §2.6)
- Updated 2026-10-13: the band has three tabs (Hotels, Transport, Places to visit) with a step caption, Previous / Next buttons, and a "chosen so far" box above each tab. Hotels filter row: Check-in, Check-out, Guests, Rooms, Rating. Transport filter row: Start country, Start city, Date, and mode chips. Places tab: up to 10 cards with photo, kind, distance, entry (Free / Paid with charge / not stated), opening hours or "Opening hours not stated", a tick-box, bulk **Add ticked places to trip**, and a **Chosen for your trip** tag; empty and error states as for the other tabs.
- Hotels and Transport tabs each have a filter row, a table in a card, sortable headers with direction arrows, loading skeleton rows, an empty state ("No hotels match these filters" with *Clear filters*), and an error with Retry; one tab failing does not affect the other.
- ~~Transport table has no actions column and a note that transport is compared only, not booked.~~ Superseded 2026-10-13: each transport row has a **Select** control (stored in `trip_transport`); a Duffel test flight row also has **Book this flight** (plan 007 / constitution 3.5.0). Trains and buses are compared only, never booked, and the tab says so. Provider attribution link (Transitous) and OSM attribution are shown with their data.
- Details page: gallery (hero + thumbnail strip), hotel name/category/rating, provider description and reviews set apart as provider-sourced text, amenities, map with pin (attribution visible), rooms list in the booking column; once a room is selected: price breakdown, cancellation policy, **Continue to booking**.
- Missing sections show "Not available" without blocking the rest.
