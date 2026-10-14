---
description: "Task list for Hotel and Transport Comparison"
---

# Tasks: Hotel and Transport Comparison

**Input**: `/specs/005-hotel-transport-comparison/` (plan.md, spec.md, research.md, data-model.md, contracts/comparison-api.md, contracts/providers.md, quickstart.md)

**Prerequisites**: plan 001 Phases 1-2; plan 003 T003-T008 (trips service, tool registry). Plan 004's `RecommendationBand` shares `SearchPage.tsx`.

**Tests**: None (manual `quickstart.md`).

**Format**: `- [ ] T### [P?] [US#?] Description with file path`

---

## Phase 1: Setup

- [X] T001 Append the 005 DDL fragment from `data-model.md` (`trip_hotels`, `trip_transport`, `geocode_cache`) to `db/init.sql`
- [X] T002 [P] Add `react-leaflet@4.2.1` and `leaflet@^1.9` to `web/package.json`; add `HOTEL_PROVIDER` (default `liteapi`), `TRANSPORT_PROVIDER` (`transitous`), `MAPS_PROVIDER` (`osm`), `GUEST_NATIONALITY` (`US`) (and, since 2026-10-13, optional `DUFFEL_ACCESS_TOKEN`) to `api/src/config.ts` and `.env.example`; the API must refuse to start on an unknown provider value

---

## Phase 2: Foundational (provider interfaces and shared types)

**CRITICAL**: complete before any user story.

- [X] T003 Define `ProviderResult<T>` and `Provenance` in `api/src/providers/types.ts` per `contracts/providers.md`
- [X] T004 [P] Define `api/src/providers/hotels/HotelProvider.ts`, `api/src/providers/transport/TransportProvider.ts`, `api/src/providers/maps/MapsProvider.ts` exactly as in `contracts/providers.md`
- [X] T005 Implement the provider factory `api/src/providers/index.ts` choosing each implementation from config and failing start-up on unknown values
- [X] T006 [P] Implement `api/src/providers/maps/OsmMapsProvider.ts`: Nominatim `geocode` (`format=jsonv2`, `limit=1`, identifying User-Agent, serial queue spaced at least 1.1 s, results cached in `geocode_cache`, no autocomplete) and `tileConfig()` (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`, attribution "© OpenStreetMap contributors")
- [X] T007 [P] Implement `api/src/providers/hotels/LiteApiHotelProvider.ts` read methods using `fetchJson` against `https://api.liteapi.travel/v3.0` with `X-API-Key`: `searchHotels` (`GET /data/hotels` joined with `POST /hotels/min-rates`), `getHotel` (`GET /data/hotel`), `getReviews` (`GET /data/reviews`), `getRates` (`POST /hotels/rates`, never cached, `ttlMs: 0`); content and reviews cached 24 h, list 10 min; tag every result `sandbox: true`; parse prices as decimal strings; confirm which host serves `/hotels/rates` against LiteAPI docs/sandbox first
- [X] T008 [P] Implement `api/src/providers/transport/OsrmClient.ts` (`https://router.project-osrm.org/route/v1/driving/{lon},{lat};{lon},{lat}?overview=false`, at most 1 req/s, cache 24 h) and `TransitousTransportProvider.ts` (`geocode` via `/api/v1/geocode`, `searchTransport` via `/api/v6/plan` with `User-Agent` including a contact, version constant checked at start, cache 10 min, real schedule times `confirmed`, real fare products `confirmed` when present, `roadTime` via OSRM); confirm the live API version first
- [X] T009 Implement `api/src/transport/fareEstimate.ts` `estimateFare({ mode, distanceKm, durationMinutes, currency, date })` per research R8 with all rates in one exported constants object, haversine distance helper, flight duration `distanceKm/800*60+60`, output `certainty: 'estimated'`, `source: 'faro-estimate'`, `basis` text, `range`; returns unavailable when distance or FX rate is missing; never produces departure/arrival times
- [X] T010 [P] Implement `api/src/search/aiScore.ts`: deterministic AI-recommendation score and one-line reason per hotel/transport row (weights in one constants object)

---

## Phase 3: User Story 1 - Compare hotels (Priority: P1) MVP

**Goal**: Hotels tab with filters and a sortable table.

**Independent Test**: filter and sort hotels for a destination; every price shows a certainty badge.

- [X] T011 [US1] Implement `api/src/tools/searchHotels.ts` and `api/src/routes/hotels.ts` `GET /api/trips/:id/hotels` (query `checkin, checkout, guests, minRating, sort, dir, page`), mapping to `HotelRow` from `contracts/comparison-api.md`; 400 when the trip has no destination; sort by price compares decimal strings, location by distance from city centre; register the tool in the agent registry
- [X] T012 [US1] Build `web/src/pages/search/SearchPage.tsx` frame per `docs/UI-SPEC.md` 2.4: header (title *Search results* in `2xl` plus read-only trip-summary pills opening the home chat), the recommendation band slot (plan 004), then the comparison band; bands 32 px apart
- [X] T013 [US1] Build `web/src/pages/search/ComparisonBand.tsx`: Hotels/Transport tabs (Places to visit added 2026-10-13, with Next/Previous, see T034) (Hotels default, inactive tab styled as NavItem) matching frames 1e/1f, state kept in URL query params so tab switches and reloads keep filters and sort
- [X] T014 [US1] Build `web/src/pages/search/HotelsTab.tsx`: filter row (Check-in, Check-out, Guests, Rating select with first option All; Rooms added 2026-10-13, see T031) and `ComparisonTable` with columns Hotel (thumbnail + name), Category, Location, Price per night (CertaintyBadge + tabular, right-aligned), Rating, Actions (**View details** to `/hotels/:hotelId?tripId=...`), sortable headers with direction arrows, loading skeleton rows, empty state "No hotels match these filters" with **Clear filters**, error with Retry
- [X] T015 [US1] Show the sandbox flag and LiteAPI attribution subtly on hotel rows and OSM/Transitous attribution links where relevant in `HotelsTab.tsx`

---

## Phase 4: User Story 3 - Inspect a hotel and pick a room (Priority: P1)

**Goal**: hotel details page with gallery, description, amenities, map, reviews and the rooms column.

**Independent Test**: open a hotel, pick a room, see breakdown and **Continue to booking**.

- [X] T016 [US3] Implement `GET /api/hotels/:hotelId` and `GET /api/hotels/:hotelId/rooms` in `api/src/routes/hotels.ts` (rooms always live, `Room` shape with breakdown, cancellation, `offerId`, certainty; independent sections may be `null` with a reason)
- [X] T017 [US3] Build `web/src/pages/hotel/HotelPage.tsx` layout per `docs/UI-SPEC.md` 2.6 and frame 1h: full-width gallery band, then two columns (flexible details, fixed 360 px rooms), stacking on mobile per frame M5
- [X] T018 [P] [US3] Build `web/src/pages/hotel/Gallery.tsx` (hero image + thumbnail strip) with a "Not available" placeholder when no photos
- [X] T019 [P] [US3] Build `web/src/pages/hotel/HotelMap.tsx` with `react-leaflet`, the default marker icon fix for Vite (import the three marker PNGs and `L.Icon.Default.mergeOptions`), explicit container height, tile URL from `/api` tile config, attribution "© OpenStreetMap contributors" visible; static pin only
- [X] T020 [P] [US3] Build `web/src/pages/hotel/Reviews.tsx` and the description block showing provider text quoted/secondary and labelled as provider-sourced (never styled as Faro's own words)
- [X] T021 [US3] Build `web/src/pages/hotel/RoomList.tsx`: Card "Rooms" with name, price per night + CertaintyBadge, **Select room** (disabled for Unavailable with the reason); after selection show the price breakdown (nights x price, taxes and fees, total), cancellation policy and a primary **Continue to booking** linking to `/trip/:tripId/book/:hotelId` with the room preselected
- [X] T022 [US3] Implement `PUT/DELETE /api/trips/:id/selection/hotel` in `api/src/routes/selections.ts` (store the snapshot in `trip_hotels`, replace after confirmation) and add a **Use this hotel** action on the details page

---

## Phase 5: User Story 2 - Compare transport (Priority: P1)

**Goal**: Transport tab with real timetables and labelled estimated prices; compare-only.

**Independent Test**: filter by mode, sort, select an option; no booking control exists.

- [X] T023 [US2] Implement `api/src/tools/searchTransport.ts` and `api/src/routes/transport.ts` `GET /api/trips/:id/transport` (`modes[], from, date, sort, dir`): timetable rows from the transport provider, prices from a real fare product or `estimateFare` (`priceSource` set accordingly), flight rows with estimated price and duration but `unavailable` times, other unsupported modes as Unavailable with a note; register the tool (Updated 2026-10-13: flight rows come from Duffel test offers when configured, see T033; the logic now lives in `api/src/search/transport.ts`)
- [X] T024 [US2] Build `web/src/pages/search/TransportTab.tsx` per UI-SPEC 2.4 and frame 1f: a **From** field in the filter row (geocoded; superseded 2026-10-13 by Start country / Start city dropdowns, see T032), multi-select of the nine modes from `docs/SCOPE.md` 5, `ComparisonTable` columns Mode (icon), Provider, Departure, Arrival, Duration, Transfers, Price (badge + tooltip showing basis and range for estimates, "Faro estimate, not a quote"), no actions column (superseded 2026-10-13: a **Select** control per row, plus **Book this flight** on Duffel test flights, see T025 and T033), sortable by price and AI recommendation (and duration/departure), note that transport is compared only, Transitous attribution link
- [X] T025 [US2] Implement `PUT/DELETE /api/trips/:id/selection/transport` in `api/src/routes/selections.ts` and a **Select** control per row in `TransportTab.tsx` (stored in `trip_transport` with `price_basis`, `price_low`, `price_high`, certainties)
- [X] T026 [US2] Make partial failures isolated: a failing Transport request shows an error with Retry inside the tab while Hotels keeps working, and vice versa, in `ComparisonBand.tsx`

---

## Phase 6: Polish

- [X] T027 [P] Verify rates and availability are never cached: check `http_cache` for `/hotels/rates`, `/rates/prebook`, `/rates/book` entries (must not exist)
- [X] T028 [P] Verify Nominatim spacing and caching with five new addresses (API log at least 1 s apart, repeats served from `geocode_cache`)
- [X] T029 Run every step of `specs/005-hotel-transport-comparison/quickstart.md` and fix failures
- [X] T030 [P] Run `scripts/check-tokens.sh` and compare the three screens with frames 1e, 1f, 1h, M3 and M5 in the mockups

---

## Phase 7: Implementation sync (Updated 2026-10-13)

Work done after the first release, recorded here so the task list matches the code.

- [X] T031 [US1] Guests and Rooms: `rooms` query on `GET /api/trips/:id/hotels`, `/hotels/:id`, `/hotels/:id/rooms` and the hotel selection body; `api/src/providers/hotels/occupancies.ts` splits the party over rooms (one adult per room at least); `HotelsTab.tsx` Rooms field and one automatic retry with enough rooms; per-room-type choice in `RoomList.tsx`
- [X] T032 [US2] Hotel filters and city scope in `api/src/search/hotels.ts`: lodging type from the trip's accommodation preference, budget filter with `hiddenCount` and `cheapest`, hotels limited to the chosen city (plus hotels within 15 km when fewer than 10), `listCountries`/`listCities` on `HotelProvider`; Start country and Start city dropdowns in `TransportTab.tsx` saved to the trip (`origin_country_name`, `origin_city`)
- [X] T033 [US2] Flights: `api/src/providers/flights/{FlightProvider.ts,DuffelFlightProvider.ts}` (test mode, live token refused), sandbox offers in `api/src/search/transport.ts` with `provider_ref` stored in `trip_transport`, **Book this flight** and `FlightBookingModal.tsx` (booking rules: plan 007, constitution 3.5.0)
- [X] T034 Places to visit: `trip_places` table; `api/src/search/places.ts` (top 10, Overpass for cities, `WikidataPlaces.ts` for countries, hours/fee lookup, photos), routes `/api/trips/:id/places*` in `routes/hotels.ts`, `/api/places/photo`, `/api/places/destination-photo`, `/api/places/countries|cities|currency|currencies` in `routes/places.ts`; `web/src/pages/search/PlacesTab.tsx` (photos, tick-boxes, bulk add, Chosen for your trip tag); third tab, Next/Previous buttons and the "chosen so far" box in `ComparisonBand.tsx`; the plan link opens once a place is chosen
- [X] T035 [P] Banner and background pictures per tab (`web/src/lib/destinationPhoto.ts`, `usePageImages`, `PageHero`): lodging on Hotels, vehicles on Transport, the country on Places

---

## Dependencies & Execution Order

- Phase 1 -> Phase 2 -> Phase 3 (MVP) -> Phase 4 and Phase 5 (independent of each other) -> Phase 6.
- T003 before T004-T008; T007 before T011 and T016; T008 and T009 before T023; T012-T014 build the tab shell used by Phase 5.
- Phase 7 (T031-T035) builds on Phases 3-5. Plan 006 now also depends on T034 (chosen places drive the itinerary).
- Plan 006 depends on T022, T025 (selections); plan 007 depends on T007's `HotelProvider` interface and T016 (`offerId`).

## Parallel Opportunities

T004; T006, T007, T008, T010; T018, T019, T020; T027, T028, T030; T035.

## Implementation Strategy

MVP = Phases 1-3 (hotel comparison). Add hotel details (Phase 4) next, since booking needs it, then transport (Phase 5).
