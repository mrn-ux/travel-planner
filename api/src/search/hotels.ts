import type { Certainty } from '../agent/envelope.js';
import { AppError } from '../errors.js';
import { refForDestination } from '../knowledge/ensure.js';
import { getConfig } from '../config.js';
import { hotelProvider, mapsProvider } from '../providers/index.js';
import { compareAmounts, divideAmount, nightsBetween } from '../providers/decimal.js';
import { createHash } from 'node:crypto';
import type { HotelSummary, Room, StayQuery } from '../providers/hotels/HotelProvider.js';
import type { Provenance } from '../providers/types.js';
import { haversineKm } from '../transport/fareEstimate.js';
import type { Trip } from '../trips/service.js';
import { scoreHotel } from './aiScore.js';

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
  /** Room types the hotel offers and the most people one room takes, from its content. Empty / null when the hotel does not say. */
  roomTypes: string[];
  maxPerRoom: number | null;
  sandbox: true;
}

export interface HotelFilters {
  checkin?: string;
  checkout?: string;
  guests?: number;
  rooms?: number;
  minRating?: number;
  sort?: 'price' | 'rating' | 'location' | 'recommended';
  dir?: 'asc' | 'desc';
  page?: number;
}

export interface HotelSearch {
  items: HotelRow[];
  total: number;
  page: number;
  pageSize: number;
  stay: { checkin: string; checkout: string; nights: number; adults: number; children: number; rooms: number; currency: string };
  /** Hotels left out because they have no room for this stay and party, or cost more than the trip budget. */
  hiddenCount: number;
  /** The lowest total found for this stay and party (in the budget currency), shown when nothing fits the budget. */
  cheapest: Priced | null;
  provenance: Provenance;
}

export const PAGE_SIZE = 25;
const FETCH_LIMIT = 50;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The stay the trip implies, overridden by the filters. Throws 400 naming what is missing. */
export function stayFor(trip: Trip, f: { checkin?: string; checkout?: string; guests?: number; rooms?: number }): StayQuery & { nights: number } {
  const checkin = f.checkin ?? trip.startDate;
  const checkout = f.checkout ?? trip.endDate;
  if (!checkin || !checkout || !DATE.test(checkin) || !DATE.test(checkout)) {
    throw new AppError(400, 'Set check-in and check-out dates first.', { fields: { checkin: 'Required.', checkout: 'Required.' } });
  }
  const nights = nightsBetween(checkin, checkout);
  if (nights < 1) throw new AppError(400, 'Check-out must be after check-in.', { fields: { checkout: 'Check-out must be after check-in.' } });
  const children = trip.childrenAges;
  const adults = f.guests !== undefined ? Math.max(1, f.guests - children.length) : (trip.adults ?? 1);
  const rooms = f.rooms ?? 1;
  if (rooms > adults) throw new AppError(400, `${rooms} rooms need at least ${rooms} adults, one in each room.`, { fields: { rooms: 'At most one room per adult.' } });
  return { checkin, checkout, nights, adults, childrenAges: children, rooms, currency: trip.budget?.currency ?? 'USD', guestNationality: getConfig().guestNationality };
}

const categoryOf = (h: HotelSummary): string | null => (h.stars !== null && h.stars > 0 ? `${'★'.repeat(Math.round(h.stars))}` : null);

/** Hotel list with live prices for the trip's destination. Prices are never cached; content is. */
export async function searchHotelsForTrip(trip: Trip, f: HotelFilters): Promise<HotelSearch> {
  if (!trip.destination) throw new AppError(400, 'Choose a destination first.', { fields: { destination: 'Required.' } });
  const stay = stayFor(trip, f);
  const hotels = hotelProvider();
  // The traveler's own city and country picks (the provider's own names) are searched as they are. Only a destination typed
  // as free text is looked up first to find its country and city.
  const chosenCity = trip.destinationCity?.trim() || null;
  let countryCode: string | null = null;
  if (chosenCity && trip.destinationCountry) {
    const countries = await hotels.listCountries();
    countryCode = countries.ok ? (countries.data.find((c) => c.name.toLowerCase() === trip.destinationCountry!.toLowerCase())?.code ?? null) : null;
  }
  const looked = await refForDestination(trip.destination).catch(() => null);
  // The place search may not know a city under the name the hotel list uses ("Greater London"): the map search is tried for its centre.
  let centre: { lat: number | null; lon: number | null } = { lat: looked?.lat ?? null, lon: looked?.lon ?? null };
  if (chosenCity && centre.lat === null && countryCode) {
    const g = await mapsProvider().geocode(`${chosenCity}, ${trip.destinationCountry ?? ''}`, countryCode).catch(() => null);
    if (g?.ok) centre = { lat: g.data.lat, lon: g.data.lon };
  }
  const dest = looked ?? (countryCode ? { name: chosenCity ?? trip.destination, countryCode, countryName: trip.destinationCountry, lat: centre.lat, lon: centre.lon } : null);
  if (!dest || !(countryCode ?? dest.countryCode)) throw new AppError(404, `We could not find "${trip.destination}".`);
  countryCode ??= dest.countryCode;

  // A whole country ("Sri Lanka") has no city of that name: list hotels anywhere in it, and give no distance from a centre.
  const wholeCountry = chosenCity === null && dest.countryName !== null && dest.name.trim().toLowerCase() === dest.countryName.trim().toLowerCase();
  const city = chosenCity ?? (wholeCountry ? null : dest.name);
  const listed = await hotels.searchHotels({ city, accommodation: trip.accommodationPreference, countryCode: countryCode as string, limit: FETCH_LIMIT, offset: 0 });
  if (!listed.ok) throw new AppError(listed.reason === 'timeout' ? 504 : 502, 'Hotel search is unavailable right now.');
  // Only hotels in the chosen city: the provider's city match is by name, so anything listed under another city is left out.
  if (city) listed.data = listed.data.filter((h) => h.city === null || h.city.trim().toLowerCase() === city.toLowerCase());
  // Few hotels under that exact name (a city can be listed as "New York" while the traveler picked "New York City"): add the hotels within
  // 15 km of the city centre, so the chosen city is not left empty.
  if (city && listed.data.length < 10 && dest.lat !== null && dest.lon !== null) {
    const around = await hotels.searchHotels({ city: null, near: { lat: dest.lat, lon: dest.lon, radiusM: 15000 }, accommodation: trip.accommodationPreference, countryCode: countryCode as string, limit: FETCH_LIMIT, offset: 0 });
    if (around.ok) {
      const have = new Set(listed.data.map((h) => h.hotelId));
      listed.data = [...listed.data, ...around.data.filter((h) => !have.has(h.hotelId))];
    }
  }

  const rates = await hotels.getMinRates(listed.data.map((h) => h.hotelId), stay);
  // A failed price call leaves every price Unavailable (never a made-up figure) but still lists the hotels.
  const priced = rates.ok ? rates.data : {};
  const fetchedAt = rates.ok ? rates.provenance.fetched_at : listed.provenance.fetched_at;

  let rows = listed.data.map((h): HotelRow & { _score: number; _km: number | null } => {
    const rate = priced[h.hotelId];
    const nightly = rate ? divideAmount(rate.total, stay.nights) : null;
    const km = !wholeCountry && dest.lat !== null && dest.lon !== null && h.latitude !== null && h.longitude !== null ? haversineKm({ lat: dest.lat, lon: dest.lon }, { lat: h.latitude, lon: h.longitude }) : null;
    const scored = scoreHotel({ nightly, nights: stay.nights, budget: trip.budget?.amount ?? null, rating: h.rating, distanceKm: km });
    return {
      hotelId: h.hotelId,
      name: h.name,
      thumbnail: h.thumbnail,
      stars: h.stars,
      category: categoryOf(h),
      area: h.address ?? h.city,
      distanceKm: km === null ? null : km.toFixed(1),
      rating: h.rating,
      pricePerNight: rate && nightly ? { amount: nightly, currency: rate.currency, certainty: 'confirmed' } : { amount: null, currency: null, certainty: 'unavailable' },
      total: rate ? { amount: rate.total, currency: rate.currency, certainty: 'confirmed' } : { amount: null, currency: null, certainty: 'unavailable' },
      recommendedReason: scored.reason,
      roomTypes: [],
      maxPerRoom: null,
      sandbox: true,
      _score: scored.score,
      _km: km,
    };
  });

  // Only hotels that fit the trip: bookable for these dates and this party (the live price lookup is made for them) and within the
  // trip budget. When the price lookup itself failed nothing can be checked, so the list is left as it is.
  let hiddenCount = 0;
  let cheapestOverall: Priced | null = null;
  if (rates.ok) {
    const ceiling = trip.budget ? Number(trip.budget.amount) : null;
    const sameCurrency = rows.filter((r) => r.total.amount !== null && r.total.currency === trip.budget?.currency);
    if (sameCurrency.length > 0) cheapestOverall = sameCurrency.reduce((m, r) => (Number(r.total.amount) < Number(m.total.amount) ? r : m)).total;
    const before = rows.length;
    rows = rows.filter((r) => {
      if (r.total.amount === null) return false;
      if (ceiling !== null && r.total.currency === trip.budget?.currency && Number(r.total.amount) > ceiling) return false;
      return true;
    });
    hiddenCount = before - rows.length;
  }

  if (f.minRating !== undefined) rows = rows.filter((r) => r.rating !== null && Number(r.rating) >= f.minRating!);

  const sort = f.sort ?? 'recommended';
  const sign = (f.dir ?? (sort === 'recommended' || sort === 'rating' ? 'desc' : 'asc')) === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    // Rows with no value for the sort key always go last.
    const missing = (r: typeof a): boolean => (sort === 'price' ? r.pricePerNight.amount === null : sort === 'rating' ? r.rating === null : sort === 'location' ? r._km === null : false);
    if (missing(a) !== missing(b)) return missing(a) ? 1 : -1;
    let c = 0;
    if (sort === 'price') c = compareAmounts(a.pricePerNight.amount ?? '0', b.pricePerNight.amount ?? '0');
    else if (sort === 'rating') c = Number(a.rating ?? 0) - Number(b.rating ?? 0);
    else if (sort === 'location') c = (a._km ?? 0) - (b._km ?? 0);
    else c = a._score - b._score;
    return c * sign || a.name.localeCompare(b.name);
  });

  const page = Math.max(1, f.page ?? 1);
  const items = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(({ _score, _km, ...row }) => row);
  // Room types and capacity come from each hotel's own content (cached a day), looked up for the hotels on this page only.
  await Promise.all(
    items.map(async (item) => {
      const content = await hotels.getHotel(item.hotelId);
      if (!content.ok) return;
      const rooms = content.data.roomContent;
      item.roomTypes = [...new Set(rooms.map((r) => r.name))];
      const caps = rooms.map((r) => r.maxOccupancy).filter((n): n is number => n !== null);
      item.maxPerRoom = caps.length > 0 ? Math.max(...caps) : null;
    }),
  );
  return {
    items,
    total: rows.length,
    hiddenCount,
    cheapest: cheapestOverall,
    page,
    pageSize: PAGE_SIZE,
    stay: { checkin: stay.checkin, checkout: stay.checkout, nights: stay.nights, adults: stay.adults, children: stay.childrenAges.length, rooms: stay.rooms ?? 1, currency: stay.currency },
    provenance: { source: 'liteapi', source_url: 'https://www.liteapi.travel/', fetched_at: fetchedAt, certainty: rates.ok ? 'confirmed' : 'unavailable', sandbox: true },
  };
}

/**
 * The provider returns hundreds of rate variants for a hotel. Keep the cheapest per room name, board and cancellation kind
 * (at most 12), and give each a stable id from those three so a pick survives the next live lookup (provider rate ids do not).
 */
export function collapseRooms(rooms: Room[]): Room[] {
  const cheapest = new Map<string, Room>();
  for (const r of rooms) {
    const key = `${r.name}|${r.board ?? ''}|${r.refundable}`;
    const have = cheapest.get(key);
    if (!have || compareAmounts(r.total, have.total) < 0) cheapest.set(key, { ...r, roomId: createHash('sha1').update(key).digest('hex').slice(0, 12) });
  }
  return [...cheapest.values()].sort((a, b) => compareAmounts(a.total, b.total));
}
