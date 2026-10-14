# Implementation Plan: Hotel and Transport Comparison

**Branch**: `005-hotel-transport-comparison` | **Date**: 2026-10-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-hotel-transport-comparison/spec.md`. Shared stack: [plan 001](../001-app-shell-navigation/plan.md); agent runtime: [plan 003](../003-trip-intake-conversation/plan.md).

## Summary

The comparison band on `/search` (Hotels/Transport tabs with filters and sortable tables) and the hotel details page `/hotels/:hotelId`. Backed by three provider interfaces with one real implementation each: `LiteApiHotelProvider` (LiteAPI sandbox), `TransitousTransportProvider` (Transitous/MOTIS timetables + public OSRM road times; ~~flights as unavailable~~ flights from `DuffelFlightProvider`, below) and `OsmMapsProvider` (Nominatim geocoding cached in Postgres; OpenStreetMap tiles with Leaflet for the hotel pin). Also stores the trip's selected hotel and transport and implements the tools `search_hotels` and `search_transport`.

**Updated 2026-10-13 (implementation sync)**: `/search` is a three-step flow, **Hotels**, **Transport**, **Places to visit** (`?tab=transport|places`, Hotels default), with a step caption, a "chosen so far" box above each tab, and **Next** / **Previous** buttons; the tabs can be visited in any order and the trip plan link (`/trip/:tripId`) appears once at least one place is chosen (hotel and transport are optional for the gate). Flights come from a fourth provider interface, `FlightProvider` (`api/src/providers/flights/`, one implementation `DuffelFlightProvider`, Duffel test mode; null when `DUFFEL_ACCESS_TOKEN` is unset, in which case flights stay estimates; a live token is refused). Places to visit (top 10, with photos) is new in this feature; routes for it live in `routes/hotels.ts`, its logic in `api/src/search/places.ts`. Page banner and background pictures change with the tab (lodging photos, vehicles, the chosen country).

## Technical Context

**Language/Version**: TypeScript 5, Node 20, React 18

**Primary Dependencies**: `fetch` (no vendor SDK), `react-leaflet` 4.2.1 + `leaflet` 1.9 (React 18 compatible; v5 targets React 19), a small polyline decoder only if route geometry is needed (not in v1)

**Storage**: PostgreSQL: `trip_hotels`, `trip_transport`, `trip_places` (added 2026-10-13), `geocode_cache`; shared `http_cache` for content/reviews only

**Testing**: None; manual quickstart

**Target Platform**: Podman compose; public internet for the providers

**Project Type**: Web application

**Performance Goals**: Hotel table populated in under 8s for a typical city; details page content sections independent

**Constraints**: Hotel rates, availability and prebook are always live (never cached); Nominatim ≤ 1 request/second with an identifying User-Agent and Postgres cache, no autocomplete; Transitous requires a User-Agent with contact and an open-source, non-commercial project with attribution link to `https://transitous.org/sources/`; OSRM demo ≤ 1 req/s, non-commercial; OSM tiles need visible "© OpenStreetMap contributors" attribution and a Referer

**Scale/Scope**: One destination per trip; up to ~50 hotels listed per search

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| I Simplicity | Pass | Three interfaces, one implementation each; routes call tools' underlying functions directly. |
| II Multi-user | Pass | Selections are rows on the user's trip; routes use the owner check from plan 003. Hotel search needs a signed-in user and a trip id (login first). |
| III Agent discipline | Pass | `search_hotels` and `search_transport` return provider data with provenance; hotel/review text wrapped as untrusted. |
| IV Provider abstraction | Pass | Interfaces in `api/src/providers/{hotels,transport,maps,flights}` (flights added 2026-10-13); config selects (`HOTEL_PROVIDER=liteapi`, `TRANSPORT_PROVIDER=transitous`, `MAPS_PROVIDER=osm`). Routes and UI import only types. |
| V Money | Pass | Rates parsed to decimal strings; `NUMERIC(14,2)` columns; sorting by price done in SQL or on strings via a decimal comparison, never `parseFloat`. |
| VI Certainty | Pass | Live rate = `confirmed` (flagged sandbox); transport schedule from timetable = `confirmed`; price = `estimated` from the labelled fare model (research R8) or `confirmed` only if a feed returns a real fare; flight times `unavailable` for the estimate row. Updated 2026-10-13: a Duffel test offer is shown as `confirmed` with real times but is marked sandbox (`priceSource: 'duffel-sandbox'`). |
| VII Design fidelity | Pass | Table, tabs, filters per UI-SPEC §2.4; details page per §2.6. |
| VIII No silent failure | Pass | Per-tab and per-section loading/empty/error. |

## Project Structure

### Documentation (this feature)

```text
specs/005-hotel-transport-comparison/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── comparison-api.md
    └── providers.md
```

### Source Code

```text
api/src/providers/hotels/{HotelProvider.ts,LiteApiHotelProvider.ts}
api/src/providers/transport/{TransportProvider.ts,TransitousTransportProvider.ts,OsrmClient.ts}
api/src/providers/maps/{MapsProvider.ts,OsmMapsProvider.ts}
api/src/providers/flights/{FlightProvider.ts,DuffelFlightProvider.ts}     # added 2026-10-13
api/src/providers/hotels/occupancies.ts                                    # party split over rooms
api/src/providers/knowledge/{OverpassSource.ts,WikidataPlaces.ts}          # Places to visit (city / country)
api/src/search/{hotels.ts,transport.ts,places.ts,selection.ts,aiScore.ts,countryCurrency.ts}   # the logic behind the routes
api/src/tools/{searchHotels.ts,searchTransport.ts}
api/src/routes/{hotels.ts,transport.ts,selections.ts,places.ts,flightBookings.ts}   # hotels.ts also serves /trips/:id/places*; places.ts serves countries, cities, photos, currencies
web/src/pages/search/{SearchPage.tsx,ComparisonBand.tsx,HotelsTab.tsx,TransportTab.tsx,PlacesTab.tsx,FlightBookingModal.tsx}
web/src/pages/hotel/{HotelPage.tsx,Gallery.tsx,RoomList.tsx,HotelMap.tsx,Reviews.tsx}
```

**Structure Decision**: Each provider folder holds its interface next to its single implementation, as the brief requires.

## Reconciliations With Other Documents

- **UI-SPEC §2.4**: hotel columns are Hotel (thumbnail + name), Category, Location, Price per night (status badge, right-aligned tabular), Rating, Actions (**View details**). Transport columns are Mode (icon), Provider, Departure, Arrival, Duration, Transfers, Price; no actions column. Filters: hotels Check-in, Check-out, Guests, Rating; transport a multi-select of the nine modes in SCOPE §5. This is more specific than spec 005's filter assumptions; UI-SPEC wins. **Updated 2026-10-13**: hotel columns now also include **Room types** and a Selected/Booked tag; the hotel filter row is Check-in, Check-out, **Guests**, **Rooms**, Rating (accommodation type comes from the trip's Accommodation preference on the home form and is passed to the provider search; the trip budget hides hotels whose total exceeds it, with a "hidden" count and the cheapest total shown when nothing fits). Hotels are filtered to the chosen city (provider city match by name, topped up with hotels within 15 km of the centre when fewer than 10 match). When no hotel fits one room, the search is repeated once with the party spread over enough rooms (about three guests each) and the traveler is told. The transport filter row replaced the free-text From field with **Start country** and **Start city** dropdowns (saved to the trip as `origin_country_name` / `origin_city`) plus Date; the destination is fixed.
- **Transport prices (owner decision)**: Transitous returns almost no fares, so prices come from a rule-based fare estimator (`api/src/transport/fareEstimate.ts`, research R8), always badged **Estimated** with source "Faro estimate, not a quote". This is an estimator, not a mock provider; constitution v3.2.0 allows it under Principle IV.
- **Transport modes**: only the modes the Transitous API supports (train, bus/coach, ferry; metro/tram/public transport as transit) return real timetables; rental cars, private transfers, taxis and walking show as Unavailable with a note. Updated 2026-10-13: ~~flights show as Unavailable~~ flights show Duffel test-mode offers (real-looking times, Confirmed, sandbox) with a **Book this flight** button, else an Estimated price and duration with no times; the "no actions column" statement is superseded: each transport row has **Select**. Walking and driving times come from OSRM (**driving only is assumed** on the public demo; foot/bike unverified).
- **Maps**: SCOPE §8 mentions live maps and route visualisation; the constitution/spec exclude them. Plan: a static hotel pin on an OSM tile map only.
- **Details page "Select room"** leads to `Continue to booking` which links to `/trip/:tripId/book/:hotelId` (plan 007).
- **Hotel id**: the route `/hotels/:hotelId` uses the LiteAPI hotel id; the trip id and dates are passed as query parameters so rates can be fetched.

## Complexity Tracking

No violations.
