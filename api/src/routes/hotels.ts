import { Router, type Request } from 'express';
import { z } from 'zod';
import { optionalUser } from '../auth/middleware.js';
import { AppError } from '../errors.js';
import { hotelProvider, mapsProvider } from '../providers/index.js';
import type { Room } from '../providers/hotels/HotelProvider.js';
import { fallbackPhoto, placesForTrip, selectedPlaces, selectPlace, selectPlaces, unselectPlace } from '../search/places.js';
import { collapseRooms, searchHotelsForTrip, stayFor, type Priced } from '../search/hotels.js';
import { getTripForOwner } from '../trips/service.js';
import { ownerOf } from '../trips/routes.js';

export const hotelsRouter = Router();
hotelsRouter.use(optionalUser);

const idOf = (req: Request, name = 'id'): string => String(req.params[name] ?? '');

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();
const listQuery = z.object({
  checkin: date,
  checkout: date,
  guests: z.coerce.number().int().min(1).max(30).optional(),
  rooms: z.coerce.number().int().min(1).max(10).optional(),
  minRating: z.coerce.number().min(0).max(10).optional(),
  sort: z.enum(['price', 'rating', 'location', 'recommended']).optional(),
  dir: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).optional(),
});

hotelsRouter.get('/trips/:id/hotels', async (req, res, next) => {
  try {
    const trip = await getTripForOwner(idOf(req), ownerOf(req));
    res.json(await searchHotelsForTrip(trip, listQuery.parse(req.query)));
  } catch (err) {
    next(err);
  }
});

const detailQuery = z.object({ tripId: z.string().min(1), checkin: date, checkout: date, guests: z.coerce.number().int().min(1).max(30).optional(), rooms: z.coerce.number().int().min(1).max(10).optional() });

/** Hotel content. Each section may be null with a reason: one failing source never blocks the rest. */
hotelsRouter.get('/hotels/:hotelId', async (req, res, next) => {
  try {
    const q = detailQuery.parse(req.query);
    await getTripForOwner(q.tripId, ownerOf(req)); // the trip proves who is asking
    const hotels = hotelProvider();
    const hotelId = idOf(req, 'hotelId');
    const [details, reviews] = await Promise.all([hotels.getHotel(hotelId), hotels.getReviews(hotelId, 10)]);
    if (!details.ok) {
      throw new AppError(details.reason === 'not_found' ? 404 : details.reason === 'timeout' ? 504 : 502, details.reason === 'not_found' ? 'Hotel not found.' : 'Hotel details are unavailable right now.');
    }
    const d = details.data;
    res.json({
      hotel: { hotelId: d.hotelId, name: d.name, stars: d.stars, rating: d.rating, address: d.address, city: d.city },
      images: d.images,
      description: d.description,
      amenities: d.amenities,
      location: d.latitude !== null && d.longitude !== null ? { lat: d.latitude, lon: d.longitude } : null,
      reviews: reviews.ok ? reviews.data : null,
      reviewsNote: reviews.ok ? null : 'Reviews are not available right now.',
      map: mapsProvider().tileConfig(),
      provenance: details.provenance,
    });
  } catch (err) {
    next(err);
  }
});

function pricedRoom(room: Room, amount: string): Priced {
  return { amount, currency: room.currency, certainty: 'confirmed' };
}

/** Places to visit around the trip's chosen city. */
hotelsRouter.get('/trips/:id/places', async (req, res, next) => {
  try {
    res.json(await placesForTrip(await getTripForOwner(idOf(req), ownerOf(req))));
  } catch (err) {
    next(err);
  }
});

/** A photo for one place the list had none for (looked up on Wikipedia and Wikimedia Commons; cached). Loaded by the browser as each card appears. */
hotelsRouter.get('/places/photo', async (req, res, next) => {
  try {
    const q = z.object({ name: z.string().min(1).max(200), lat: z.coerce.number().min(-90).max(90), lon: z.coerce.number().min(-180).max(180) }).parse(req.query);
    res.json({ photo: await fallbackPhoto(q.name, q.lat, q.lon) });
  } catch (err) {
    next(err);
  }
});

hotelsRouter.get('/trips/:id/places/selected', async (req, res, next) => {
  try {
    const trip = await getTripForOwner(idOf(req), ownerOf(req));
    res.json({ items: await selectedPlaces(trip.id) });
  } catch (err) {
    next(err);
  }
});

hotelsRouter.post('/trips/:id/places', async (req, res, next) => {
  try {
    const { ids } = z.object({ ids: z.array(z.string().min(1).max(100)).min(1).max(500) }).strict().parse(req.body);
    const trip = await getTripForOwner(idOf(req), ownerOf(req));
    await selectPlaces(trip, ids);
    res.json({ items: await selectedPlaces(trip.id) });
  } catch (err) {
    next(err);
  }
});

hotelsRouter.put('/trips/:id/places/:placeId', async (req, res, next) => {
  try {
    const trip = await getTripForOwner(idOf(req), ownerOf(req));
    await selectPlace(trip, decodeURIComponent(idOf(req, 'placeId')));
    res.json({ items: await selectedPlaces(trip.id) });
  } catch (err) {
    next(err);
  }
});

hotelsRouter.delete('/trips/:id/places/:placeId', async (req, res, next) => {
  try {
    const trip = await getTripForOwner(idOf(req), ownerOf(req));
    await unselectPlace(trip.id, decodeURIComponent(idOf(req, 'placeId')));
    res.json({ items: await selectedPlaces(trip.id) });
  } catch (err) {
    next(err);
  }
});

/** Live room offers for the trip's dates and party. Never cached. */
hotelsRouter.get('/hotels/:hotelId/rooms', async (req, res, next) => {
  try {
    const q = detailQuery.parse(req.query);
    const trip = await getTripForOwner(q.tripId, ownerOf(req));
    const stay = stayFor(trip, q);
    const [rates, content] = await Promise.all([hotelProvider().getRates(idOf(req, 'hotelId'), stay), hotelProvider().getHotel(idOf(req, 'hotelId'))]);
    if (!rates.ok) throw new AppError(rates.reason === 'timeout' ? 504 : 502, 'Room prices are unavailable right now.');
    const known = content.ok ? content.data.roomContent : [];
    res.json({
      stay: { checkin: stay.checkin, checkout: stay.checkout, nights: stay.nights, adults: stay.adults, rooms: stay.rooms ?? 1 },
      // One room: the 12 cheapest offers. Several rooms: many more, so the traveler can choose the type of each room.
      rooms: collapseRooms(rates.data).slice(0, (stay.rooms ?? 1) > 1 ? 80 : 12).map((r) => ({
        roomId: r.roomId,
        name: r.name,
        board: r.board,
        pricePerNight: pricedRoom(r, r.nightly),
        total: pricedRoom(r, r.total),
        breakdown: { nights: r.nights, nightly: r.nightly, taxesAndFees: r.taxesAndFees, total: r.total },
        cancellation: { refundable: r.refundable, freeUntil: r.freeUntil, text: r.cancellationText },
        occupancy: { adults: r.adults, children: r.children },
        roomDetails: r.roomNames.map((n) => {
          // The offer's own occupancy just repeats the party that was searched, so capacity and beds come from the hotel's room content.
          const c = matchRoomContent(n.name, known);
          return { name: n.name, sleeps: c?.maxOccupancy ?? null, beds: c?.beds ?? null };
        }),
        certainty: 'confirmed',
        sandbox: true,
        offerId: r.offerId,
      })),
      provenance: rates.provenance,
    });
  } catch (err) {
    next(err);
  }
});

const words = (name: string): Set<string> => new Set(name.toLowerCase().replace(/[^a-z0-9À-ɏ ]+/g, ' ').split(/\s+/).filter((w) => w !== '' && !['room', 'rooms', 'the', 'with', 'and'].includes(w)));

/** The hotel's own description of a room offered under a rate name ("Suite Connecting Room" is "Suite, Connecting Rooms"): same words, or nearly. */
function matchRoomContent<T extends { name: string }>(rateName: string, content: T[]): T | null {
  const a = words(rateName);
  let best: T | null = null;
  let bestScore = 0;
  for (const c of content) {
    const b = words(c.name);
    const shared = [...a].filter((w) => b.has(w)).length;
    const score = shared / (a.size + b.size - shared || 1);
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return bestScore >= 0.6 ? best : null;
}
