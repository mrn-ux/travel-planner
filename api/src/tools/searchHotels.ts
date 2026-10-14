import { z } from 'zod';
import { unavailable, wrap, type ToolResult } from '../agent/envelope.js';
import { registerTool } from '../agent/registry.js';
import { AppError } from '../errors.js';
import { searchHotelsForTrip, type HotelRow } from '../search/hotels.js';
import { getTripById } from '../trips/service.js';

const schema = z.object({
  checkin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  checkout: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  guests: z.coerce.number().int().min(1).max(30).optional(),
  minRating: z.coerce.number().min(0).max(10).optional(),
  limit: z.coerce.number().int().min(1).max(10).optional(),
});

export async function runSearchHotels(tripId: string, args: z.infer<typeof schema>): Promise<ToolResult<HotelRow[]>> {
  const trip = await getTripById(tripId);
  try {
    const found = await searchHotelsForTrip(trip, { ...args, sort: 'recommended' });
    if (found.items.length === 0) return unavailable('liteapi', 'No hotels matched.', found.provenance.source_url);
    return wrap(found.items.slice(0, args.limit ?? 5), {
      source: 'liteapi',
      source_url: found.provenance.source_url,
      fetched_at: found.provenance.fetched_at,
      certainty: found.provenance.certainty,
      sandbox: true,
      note: 'Sandbox rates, not real bookings.',
    });
  } catch (err) {
    if (err instanceof AppError) return unavailable('liteapi', err.message);
    throw err;
  }
}

export function registerSearchHotels(): void {
  registerTool({
    name: 'search_hotels',
    description: 'Search hotels with live sandbox prices for the trip destination and dates. Returns ranked hotels with price per night, rating and a certainty label.',
    parameters: {
      type: 'object',
      properties: {
        checkin: { type: 'string', description: 'YYYY-MM-DD. Defaults to the trip start date.' },
        checkout: { type: 'string', description: 'YYYY-MM-DD. Defaults to the trip end date.' },
        guests: { type: 'integer' },
        minRating: { type: 'number', description: 'Minimum review score out of 10.' },
        limit: { type: 'integer', description: '1 to 10.' },
      },
    },
    schema,
    chatCallable: true,
    handler: async (args, ctx) => runSearchHotels(ctx.tripId, schema.parse(args)),
    toCard: (r) => {
      const rows = (r.data as HotelRow[] | null) ?? [];
      if (rows.length === 0) return null;
      return {
        title: 'Hotels',
        lines: rows
          .slice(0, 3)
          .map((h) => `${h.name}: ${h.pricePerNight.amount ? `${h.pricePerNight.currency} ${h.pricePerNight.amount} per night` : 'price unavailable'}${h.rating ? `, rated ${h.rating}` : ''}`),
        certainty: r.certainty,
        source: r.source,
        source_url: r.source_url,
        fetched_at: r.fetched_at,
        sandbox: true,
      };
    },
  });
}
