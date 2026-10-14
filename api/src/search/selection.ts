import { recalcBudget } from '../budget/recalc.js';
import { query } from '../db.js';
import { AppError } from '../errors.js';
import { compareAmounts } from '../providers/decimal.js';
import { hotelProvider } from '../providers/index.js';
import type { Trip } from '../trips/service.js';
import { collapseRooms, stayFor, type Priced } from './hotels.js';
import { findOption, type TransportRow } from './transport.js';

export interface HotelSelection {
  hotelId: string;
  name: string;
  roomName: string;
  checkin: string;
  checkout: string;
  nightly: Priced;
  total: Priced;
  sandbox: true;
  fetchedAt: string;
}

/** Store the hotel (and room) picked, from a live look-up: never a number sent by the browser. Replaces any earlier pick. */
export async function selectHotel(trip: Trip, body: { hotelId: string; roomId?: string; checkin: string; checkout: string; rooms?: number }): Promise<HotelSelection> {
  const stay = stayFor(trip, { checkin: body.checkin, checkout: body.checkout, rooms: body.rooms });
  const hotels = hotelProvider();
  const [details, rates] = await Promise.all([hotels.getHotel(body.hotelId), hotels.getRates(body.hotelId, stay)]);
  if (!details.ok) throw new AppError(details.reason === 'not_found' ? 404 : 502, 'Hotel details are unavailable right now.');
  if (!rates.ok) throw new AppError(502, 'Room prices are unavailable right now.');
  const rooms = collapseRooms(rates.data);
  const room = body.roomId ? rooms.find((r) => r.roomId === body.roomId) : rooms.slice().sort((a, b) => compareAmounts(a.total, b.total))[0];
  if (!room) throw new AppError(409, body.roomId ? 'That room is no longer available.' : 'No rooms are available for these dates.');

  const d = details.data;
  await query(
    `INSERT INTO trip_hotels (trip_id, provider, provider_hotel_id, name, stars, rating, city, latitude, longitude, photo_url, room_name, checkin, checkout,
                              nightly_rate, total_price, currency, price_source, price_certainty, sandbox, source_url, fetched_at, selected_at)
     VALUES ($1,'liteapi',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'liteapi','confirmed',true,$16,$17, now())
     ON CONFLICT (trip_id) DO UPDATE SET provider_hotel_id = EXCLUDED.provider_hotel_id, name = EXCLUDED.name, stars = EXCLUDED.stars, rating = EXCLUDED.rating,
       city = EXCLUDED.city, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, photo_url = EXCLUDED.photo_url, room_name = EXCLUDED.room_name,
       checkin = EXCLUDED.checkin, checkout = EXCLUDED.checkout, nightly_rate = EXCLUDED.nightly_rate, total_price = EXCLUDED.total_price, currency = EXCLUDED.currency,
       price_certainty = EXCLUDED.price_certainty, source_url = EXCLUDED.source_url, fetched_at = EXCLUDED.fetched_at, selected_at = now()`,
    [trip.id, body.hotelId, d.name, d.stars, d.rating, d.city, d.latitude, d.longitude, d.images[0]?.url ?? null, room.name, stay.checkin, stay.checkout, room.nightly, room.total, room.currency, rates.provenance.source_url, rates.provenance.fetched_at],
  );
  await recalcBudget(trip.id);
  return {
    hotelId: body.hotelId,
    name: d.name,
    roomName: room.name,
    checkin: stay.checkin,
    checkout: stay.checkout,
    nightly: { amount: room.nightly, currency: room.currency, certainty: 'confirmed' },
    total: { amount: room.total, currency: room.currency, certainty: 'confirmed' },
    sandbox: true,
    fetchedAt: rates.provenance.fetched_at,
  };
}

export async function clearHotel(tripId: string): Promise<void> {
  await query('DELETE FROM trip_hotels WHERE trip_id = $1', [tripId]);
  await recalcBudget(tripId);
}

/** Store an option from the trip's most recent transport search. */
export async function selectTransportOption(trip: Trip, optionId: string): Promise<{ row: TransportRow; origin: string; destination: string }> {
  const found = findOption(trip.id, optionId);
  if (!found) throw new AppError(404, 'That option is no longer listed. Search again and pick it from the new list.');
  const { row } = found;
  if (row.price.amount === null && row.durationMinutes === null) throw new AppError(409, 'That option has no data to save.');
  await query(
    `INSERT INTO trip_transport (trip_id, provider, mode, origin, destination, departure_at, arrival_at, duration_minutes, transfers, operator, price, currency,
                                price_source, price_basis, price_low, price_high, price_certainty, schedule_certainty, source_url, provider_ref, fetched_at, selected_at)
     VALUES ($1,$19,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$20, now(), now())
     ON CONFLICT (trip_id) DO UPDATE SET mode = EXCLUDED.mode, origin = EXCLUDED.origin, destination = EXCLUDED.destination, departure_at = EXCLUDED.departure_at,
       arrival_at = EXCLUDED.arrival_at, duration_minutes = EXCLUDED.duration_minutes, transfers = EXCLUDED.transfers, operator = EXCLUDED.operator, price = EXCLUDED.price,
       currency = EXCLUDED.currency, price_source = EXCLUDED.price_source, price_basis = EXCLUDED.price_basis, price_low = EXCLUDED.price_low, price_high = EXCLUDED.price_high,
       price_certainty = EXCLUDED.price_certainty, schedule_certainty = EXCLUDED.schedule_certainty, source_url = EXCLUDED.source_url, provider = EXCLUDED.provider, provider_ref = EXCLUDED.provider_ref, fetched_at = now(), selected_at = now()`,
    [trip.id, row.mode, found.origin, found.destination, row.departure, row.arrival, row.durationMinutes, row.transfers, row.provider, row.price.amount, row.price.currency,
      row.priceSource ?? 'none', row.price.basis ?? null, row.price.range?.low ?? null, row.price.range?.high ?? null, row.price.certainty, row.scheduleCertainty,
      row.priceSource === 'duffel-sandbox' ? 'https://duffel.com/docs' : 'https://transitous.org/sources/', row.priceSource === 'duffel-sandbox' ? 'duffel' : 'transitous', row.providerRef],
  );
  await recalcBudget(trip.id);
  return found;
}

export async function clearTransport(tripId: string): Promise<void> {
  await query('DELETE FROM trip_transport WHERE trip_id = $1', [tripId]);
  await recalcBudget(tripId);
}
