import { z } from 'zod';
import { reconcileOne } from '../bookings/service.js';
import { unavailable, wrap } from '../agent/envelope.js';
import { registerTool } from '../agent/registry.js';
import { query } from '../db.js';
import { hotelProvider } from '../providers/index.js';
import { collapseRooms, stayFor } from '../search/hotels.js';
import { getTripById } from '../trips/service.js';

const availabilitySchema = z.object({
  hotelId: z.string().min(1).max(60),
  roomId: z.string().max(120).optional(),
  checkin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  checkout: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function registerCheckAvailability(): void {
  registerTool({
    name: 'check_hotel_availability',
    description: 'Check live whether a hotel (and optionally a specific room) is available for the dates, with the current price. Read-only: it books nothing.',
    parameters: {
      type: 'object',
      properties: { hotelId: { type: 'string' }, roomId: { type: 'string', description: 'Optional room id from the room list.' }, checkin: { type: 'string' }, checkout: { type: 'string' } },
      required: ['hotelId'],
    },
    schema: availabilitySchema,
    chatCallable: true,
    handler: async (args, ctx) => {
      const a = availabilitySchema.parse(args);
      const trip = await getTripById(ctx.tripId);
      const stay = stayFor(trip, { checkin: a.checkin, checkout: a.checkout });
      const rates = await hotelProvider().getRates(a.hotelId, stay);
      if (!rates.ok) return unavailable('liteapi', 'Availability could not be checked right now.');
      const rooms = collapseRooms(rates.data);
      const room = a.roomId ? rooms.find((r) => r.roomId === a.roomId) : rooms[0];
      if (!room) {
        return wrap({ available: false, hotelId: a.hotelId }, { source: 'liteapi', fetched_at: rates.provenance.fetched_at, certainty: 'confirmed', sandbox: true, note: 'No matching room is available for these dates.' });
      }
      return wrap(
        { available: true, hotelId: a.hotelId, room: room.name, total: room.total, currency: room.currency, nightly: room.nightly, cancellation: room.cancellationText },
        { source: 'liteapi', source_url: rates.provenance.source_url, fetched_at: rates.provenance.fetched_at, certainty: 'confirmed', sandbox: true, note: 'A live sandbox rate. Booking happens on the booking screen.' },
      );
    },
  });
}

const bookSchema = z.object({ bookingId: z.string().uuid() });

/**
 * The booking itself runs inside the booking service after a verified payment. This tool is registered for completeness but is NOT
 * callable from chat: it can only settle a booking that already has a payment (pending or paid), never start one.
 */
function registerCreateBooking(): void {
  registerTool({
    name: 'create_hotel_booking',
    description: 'Settles a paid hotel booking with the provider. Not available in chat.',
    parameters: { type: 'object', properties: { bookingId: { type: 'string' } }, required: ['bookingId'] },
    schema: bookSchema,
    chatCallable: false,
    handler: async (args) => {
      const { bookingId } = bookSchema.parse(args);
      await reconcileOne(bookingId);
      const r = await query<{ status: string; provider_booking_id: string | null }>('SELECT status, provider_booking_id FROM bookings WHERE id = $1', [bookingId]);
      const b = r.rows[0];
      return b
        ? wrap({ status: b.status, reference: b.status === 'confirmed' ? b.provider_booking_id : null }, { source: 'liteapi', fetched_at: new Date(), certainty: 'confirmed', sandbox: true })
        : unavailable('liteapi', 'Booking not found.');
    },
  });
}

export function registerBookingTools(): void {
  registerCheckAvailability();
  registerCreateBooking();
}
