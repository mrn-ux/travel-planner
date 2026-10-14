# Contract: Hotel, Transport and Maps provider interfaces

Files under `api/src/providers/`. Each has exactly one real implementation selected by config (`HOTEL_PROVIDER=liteapi`, `TRANSPORT_PROVIDER=transitous`, `MAPS_PROVIDER=osm`). No mock exists. Routes, tools and the UI import these types only.

## HotelProvider

```ts
export interface HotelProvider {
  // Updated 2026-10-13 to the current interface (api/src/providers/hotels/HotelProvider.ts).
  // city is null for a whole country; accommodation is the lodging type (null = every kind); near lists hotels around a point.
  searchHotels(q: { city: string | null; near?: { lat: number; lon: number; radiusM: number }; countryCode: string;
                    accommodation: string | null; limit: number; offset: number }): Promise<ProviderResult<HotelSummary[]>>;
  getMinRates(hotelIds: string[], stay: StayQuery): Promise<ProviderResult<Record<string, { total: string; currency: string }>>>;   // live; hotels without availability are absent
  listCountries(): Promise<ProviderResult<Array<{ code: string; name: string }>>>;      // Start / destination country dropdowns
  listCities(countryCode: string): Promise<ProviderResult<string[]>>;
  getHotel(hotelId: string): Promise<ProviderResult<HotelDetails>>;                     // includes roomContent (name, max occupancy, beds)
  getReviews(hotelId: string, limit: number): Promise<ProviderResult<HotelReview[]>>;
  getRates(hotelId: string, stay: StayQuery): Promise<ProviderResult<Room[]>>;          // always live; StayQuery = dates, adults, childrenAges, rooms?, currency, guestNationality
  prebook(offerId: string): Promise<ProviderResult<Prebook>>;                           // plan 007
  book(input: BookInput, timeoutMs: number): Promise<ProviderResult<BookResult>>;       // plan 007
  getBooking(clientReference: string): Promise<ProviderResult<BookResult | null>>;      // plan 007
  // ~~checkAvailability(offerId)~~ superseded: availability is re-checked by prebook.
}
```

## TransportProvider

```ts
export interface TransportProvider {
  geocode(text: string): Promise<ProviderResult<Place[]>>;
  searchTransport(q: { from: Place; to: Place; date: string }): Promise<ProviderResult<TransportOption[]>>;   // modes are filtered by the caller (updated 2026-10-13)
  roadTime(from: LatLon, to: LatLon): Promise<ProviderResult<{ minutes: number; km: string }>>;
  roadMatrix(points: LatLon[]): Promise<ProviderResult<Array<Array<number | null>>>>;   // added: one OSRM table call for the itinerary (plan 006)
}
```

## FlightProvider (added 2026-10-13)

`api/src/providers/flights/FlightProvider.ts`, one implementation `DuffelFlightProvider` (Duffel test mode, `DUFFEL_ACCESS_TOKEN`; the factory returns null when unset and refuses a live token). Flights are searched and compared here; booking is plan 007 / constitution 3.5.0.

```ts
export interface FlightProvider {
  searchFlights(q: { originNames: string[]; destinationNames: string[]; date: string; adults: number; childrenAges: number[] }): Promise<ProviderResult<FlightOffer[]>>;
  getOffer(offerId: string): Promise<ProviderResult<FlightOfferDetail>>;               // live re-check before booking
  createOrder(input: { offerId: string; amount: string; currency: string; passengers: FlightPassenger[] }): Promise<ProviderResult<FlightOrder>>;
}
```

## MapsProvider

```ts
export interface MapsProvider {
  geocode(query: string, countryCode?: string): Promise<ProviderResult<GeocodeHit>>; // cached, 1 req/s; GeocodeHit = { lat, lon, displayName, ... }
  tileConfig(): { urlTemplate: string; attribution: string; maxZoom: number };
}
```

## Shared result type

```ts
export type ProviderResult<T> =
  | { ok: true; data: T; provenance: Provenance }
  | { ok: false; reason: 'timeout' | 'rate_limited' | 'http_error' | 'not_found' | 'invalid_response'; detail?: string };
```

## Rules
- A failed call maps to `certainty: 'unavailable'` at the tool layer; no fallback value is ever supplied.
- Every `Provenance` has `source`, `source_url`, `fetched_at`, `certainty`, and `sandbox: true` for LiteAPI.
- Amounts are decimal strings; no provider code converts them to `number`.
- Swapping a provider means adding a class that implements the interface and changing the config value; no route, tool or UI file changes.
