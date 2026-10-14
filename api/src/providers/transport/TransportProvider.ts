import type { LatLon, ProviderResult } from '../types.js';

export interface Place {
  name: string;
  lat: number;
  lon: number;
  countryCode: string | null;
}

/** What kind of vehicle carries the main part of the journey. */
export type TransportMode = 'train' | 'bus' | 'metro' | 'transit' | 'ferry';

export interface TransportOption {
  /** Stable within one search: the key of the timetable itinerary. */
  key: string;
  mode: TransportMode;
  /** Operator of the longest leg, for example "Eurostar". */
  operator: string | null;
  /** ISO times from the published timetable. */
  departure: string;
  arrival: string;
  /** IANA time zones of the origin and destination stops, so times display as local clock times. */
  departureTz: string | null;
  arrivalTz: string | null;
  durationMinutes: number;
  transfers: number;
  /** A real fare from the feed, when it publishes one. Decimal string. */
  fare: { amount: string; currency: string } | null;
}

export interface TransportProvider {
  geocode(text: string): Promise<ProviderResult<Place[]>>;
  /** Real timetable itineraries for one day. An empty list means the feeds hold no service for that date. */
  searchTransport(q: { from: Place; to: Place; date: string }): Promise<ProviderResult<TransportOption[]>>;
  roadTime(from: LatLon, to: LatLon): Promise<ProviderResult<{ minutes: number; km: string }>>;
  /** Driving minutes between every pair of points in one request (row = from, column = to). null where no route exists. */
  roadMatrix(points: LatLon[]): Promise<ProviderResult<Array<Array<number | null>>>>;
}
