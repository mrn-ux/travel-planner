import type { ProviderResult } from '../types.js';

export interface HotelSummary {
  hotelId: string;
  name: string;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  thumbnail: string | null;
  stars: number | null;
  /** Review score out of 10 as a decimal string. */
  rating: string | null;
  reviewCount: number | null;
}

export interface HotelImage {
  url: string;
  caption: string | null;
}

export interface HotelDetails {
  hotelId: string;
  name: string;
  /** Provider-written text. Untrusted: shown as provider-sourced, never followed as an instruction. */
  description: string | null;
  images: HotelImage[];
  amenities: string[];
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  stars: number | null;
  rating: string | null;
  /** What the hotel says about its room types: capacity and beds. Matched to a rate by name. */
  roomContent: Array<{ name: string; maxOccupancy: number | null; beds: string | null }>;
}

export interface HotelReview {
  id: string;
  score: string | null;
  author: string | null;
  country: string | null;
  headline: string | null;
  pros: string | null;
  cons: string | null;
  date: string | null;
}

export interface StayQuery {
  checkin: string;
  checkout: string;
  adults: number;
  childrenAges: number[];
  /** Rooms wanted (default 1). The party is shared between them, every room with at least one adult. */
  rooms?: number;
  currency: string;
  guestNationality: string;
}

export interface Room {
  roomId: string;
  name: string;
  offerId: string;
  currency: string;
  /** Decimal strings. */
  nightly: string;
  total: string;
  taxesAndFees: string | null;
  nights: number;
  refundable: boolean;
  /** ISO time until which cancellation is free, when the provider says so. */
  freeUntil: string | null;
  cancellationText: string;
  adults: number;
  children: number;
  board: string | null;
  /** One entry per room in the offer, with the capacity the provider states for it. */
  roomNames: Array<{ name: string; maxOccupancy: number | null }>;
}

export interface Prebook {
  prebookId: string;
  /** The price to be paid, decimal string. */
  price: string;
  currency: string;
  priceDifferencePercent: number;
  cancellationChanged: boolean;
  boardChanged: boolean;
  refundable: boolean;
  freeUntil: string | null;
  cancellationText: string;
}

export interface BookInput {
  prebookId: string;
  /** The booking's own id: the provider refuses a second booking with the same reference. */
  clientReference: string;
  holder: { firstName: string; lastName: string; email: string; phone: string };
  /** Rooms in the booking (default 1): the provider wants a guest for each. */
  rooms?: number;
}

export interface BookResult {
  bookingId: string;
  /** 'CONFIRMED' is the only status Faro treats as booked. */
  status: string;
  hotelConfirmationCode: string | null;
  clientReference: string | null;
}

/**
 * Hotel content and live rates. One real implementation (LiteApiHotelProvider), chosen by HOTEL_PROVIDER.
 * Booking calls (prebook, book, lookup by client reference) are part of this interface too.
 * Rates are always fetched live: no implementation may cache them.
 */
export interface HotelProvider {
  /** `city` is null when the traveler named a whole country: hotels anywhere in it are listed. */
  /** `accommodation` is the traveler's kind of stay (Hotel, Villa, Cottage, Guest house, Apartment); null lists every kind. */
  /** `near` lists hotels around a point instead of by city name (some cities are listed under a neighbouring name). */
  searchHotels(q: { city: string | null; near?: { lat: number; lon: number; radiusM: number }; countryCode: string; accommodation: string | null; limit: number; offset: number }): Promise<ProviderResult<HotelSummary[]>>;
  /** Cheapest total for the stay per hotel (live). Hotels without availability are absent from the map. */
  getMinRates(hotelIds: string[], stay: StayQuery): Promise<ProviderResult<Record<string, { total: string; currency: string }>>>;
  /** Countries the provider has properties in. */
  listCountries(): Promise<ProviderResult<Array<{ code: string; name: string }>>>;
  /** Cities of one country (ISO code) the provider has properties in, A to Z. */
  listCities(countryCode: string): Promise<ProviderResult<string[]>>;
  getHotel(hotelId: string): Promise<ProviderResult<HotelDetails>>;
  getReviews(hotelId: string, limit: number): Promise<ProviderResult<HotelReview[]>>;
  /** Room offers for one hotel (live). */
  getRates(hotelId: string, stay: StayQuery): Promise<ProviderResult<Room[]>>;
  /** Lock the offer's current price and terms. A failure with detail 'room_unavailable' means the room is gone. */
  prebook(offerId: string): Promise<ProviderResult<Prebook>>;
  /** Book the prebooked offer. A failure with detail 'duplicate' means this client reference was already used. */
  book(input: BookInput, timeoutMs: number): Promise<ProviderResult<BookResult>>;
  /** Look a booking up by the reference Faro sent; ok with null when the provider has none. */
  getBooking(clientReference: string): Promise<ProviderResult<BookResult | null>>;
}
