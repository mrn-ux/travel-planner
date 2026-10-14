import { api } from './api';
import { EM_DASH, formatDate } from './format';
import type { Certainty } from './types';

export interface Priced {
  amount: string | null;
  currency: string | null;
  certainty: Certainty;
  range?: { low: string; high: string };
  basis?: string;
}

export interface HotelRow {
  hotelId: string;
  name: string;
  thumbnail: string | null;
  stars: number | null;
  category: string | null;
  area: string | null;
  distanceKm: string | null;
  rating: string | null;
  pricePerNight: Priced;
  total: Priced;
  recommendedReason: string;
  roomTypes: string[];
  maxPerRoom: number | null;
  sandbox: true;
}

export interface HotelSearch {
  items: HotelRow[];
  total: number;
  page: number;
  pageSize: number;
  stay: { checkin: string; checkout: string; nights: number; adults: number; children: number; rooms: number; currency: string };
  hiddenCount: number;
  cheapest: { amount: string | null; currency: string | null } | null;
  provenance: { source: string; source_url: string | null; fetched_at: string; certainty: Certainty; sandbox?: true };
}

export type HotelSort = 'price' | 'rating' | 'location' | 'recommended';

export function searchHotels(tripId: string, params: Record<string, string>): Promise<HotelSearch> {
  const qs = new URLSearchParams(params).toString();
  return api<HotelSearch>(`/trips/${encodeURIComponent(tripId)}/hotels${qs ? `?${qs}` : ''}`);
}

export const TRANSPORT_MODES = [
  { key: 'flight', label: 'Flights' },
  { key: 'train', label: 'Trains' },
  { key: 'bus', label: 'Buses' },
  { key: 'car', label: 'Rental cars' },
  { key: 'transfer', label: 'Private transfers' },
  { key: 'taxi', label: 'Taxis' },
  { key: 'metro', label: 'Metro / subway' },
  { key: 'transit', label: 'Public transportation' },
  { key: 'walking', label: 'Walking' },
] as const;

export interface TransportRow {
  optionId: string;
  mode: string;
  modeLabel: string;
  provider: string | null;
  departure: string | null;
  arrival: string | null;
  departureTz: string | null;
  arrivalTz: string | null;
  durationMinutes: number | null;
  durationCertainty: Certainty;
  transfers: number | null;
  price: Priced;
  scheduleCertainty: Certainty;
  priceSource: 'transitous-fare' | 'faro-estimate' | 'duffel-sandbox' | null;
  /** The provider's own id for the offer, when it can be booked. */
  providerRef: string | null;
  recommendedReason: string;
  note: string | null;
}

export interface TransportSearch {
  items: TransportRow[];
  needsFrom: boolean;
  origin: string | null;
  destination: string;
  date: string;
  distanceKm: string | null;
  notes: string[];
  provenance: { source: string; source_url: string; fetched_at: string; certainty: Certainty };
}

export function searchTransport(tripId: string, params: Record<string, string>): Promise<TransportSearch> {
  const qs = new URLSearchParams(params).toString();
  return api<TransportSearch>(`/trips/${encodeURIComponent(tripId)}/transport${qs ? `?${qs}` : ''}`);
}

export interface Room {
  roomId: string;
  name: string;
  board: string | null;
  pricePerNight: Priced;
  total: Priced;
  breakdown: { nights: number; nightly: string; taxesAndFees: string | null; total: string };
  cancellation: { refundable: boolean; freeUntil: string | null; text: string };
  occupancy: { adults: number; children: number };
  roomDetails: Array<{ name: string; sleeps: number | null; beds: string | null }>;
  certainty: Certainty;
  sandbox: true;
  offerId: string;
}

export interface HotelDetails {
  hotel: { hotelId: string; name: string; stars: number | null; rating: string | null; address: string | null; city: string | null };
  images: Array<{ url: string; caption: string | null }>;
  description: string | null;
  amenities: string[];
  location: { lat: number; lon: number } | null;
  reviews: Array<{ id: string; score: string | null; author: string | null; country: string | null; headline: string | null; pros: string | null; cons: string | null; date: string | null }> | null;
  reviewsNote: string | null;
  map: { urlTemplate: string; attribution: string; maxZoom: number };
  provenance: { source: string; source_url: string | null; fetched_at: string; certainty: Certainty; sandbox?: true };
}

const stayQs = (tripId: string, stay: { checkin?: string; checkout?: string; rooms?: number }): string => {
  const p = new URLSearchParams({ tripId });
  if (stay.rooms && stay.rooms > 1) p.set('rooms', String(stay.rooms));
  if (stay.checkin) p.set('checkin', stay.checkin);
  if (stay.checkout) p.set('checkout', stay.checkout);
  return p.toString();
};

export const getHotelDetails = (hotelId: string, tripId: string, stay: { checkin?: string; checkout?: string }): Promise<HotelDetails> =>
  api<HotelDetails>(`/hotels/${encodeURIComponent(hotelId)}?${stayQs(tripId, stay)}`);

export const getRooms = (hotelId: string, tripId: string, stay: { checkin?: string; checkout?: string; rooms?: number }): Promise<{ rooms: Room[]; stay: { checkin: string; checkout: string; nights: number; adults: number; rooms: number } }> =>
  api(`/hotels/${encodeURIComponent(hotelId)}/rooms?${stayQs(tripId, stay)}`);

export const selectHotel = (tripId: string, body: { hotelId: string; roomId?: string; checkin: string; checkout: string; rooms?: number }) =>
  api<{ selection: { name: string; roomName: string } }>(`/trips/${encodeURIComponent(tripId)}/selection/hotel`, { method: 'PUT', body: JSON.stringify(body) });

export const selectTransport = (tripId: string, optionId: string) =>
  api<{ selection: { optionId: string } }>(`/trips/${encodeURIComponent(tripId)}/selection/transport`, { method: 'PUT', body: JSON.stringify({ optionId }) });

/** 14:05 in the stop's own time zone, so a timetable time reads as the clock on the platform. */
export function formatClock(iso: string | null, tz: string | null): string {
  if (!iso) return EM_DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return EM_DASH;
  try {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, ...(tz ? { timeZone: tz } : { timeZone: 'UTC' }) }).format(d);
  } catch {
    return EM_DASH;
  }
}

export const formatStayDate = (iso: string | null): string => formatDate(iso);
