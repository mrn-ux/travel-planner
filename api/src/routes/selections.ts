import { Router } from 'express';
import { z } from 'zod';
import { optionalUser } from '../auth/middleware.js';
import { clearHotel, clearTransport, selectHotel, selectTransportOption } from '../search/selection.js';
import { getTripForOwner } from '../trips/service.js';
import { ownerOf } from '../trips/routes.js';

export const selectionsRouter = Router();
selectionsRouter.use(optionalUser);

const idOf = (p: Record<string, string | undefined>): string => String(p['id'] ?? '');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const hotelBody = z.object({ hotelId: z.string().min(1), roomId: z.string().optional(), checkin: date, checkout: date, rooms: z.number().int().min(1).max(10).optional() }).strict();

selectionsRouter.put('/trips/:id/selection/hotel', async (req, res, next) => {
  try {
    const body = hotelBody.parse(req.body);
    const trip = await getTripForOwner(idOf(req.params), ownerOf(req));
    res.json({ selection: await selectHotel(trip, body) });
  } catch (err) {
    next(err);
  }
});

selectionsRouter.delete('/trips/:id/selection/hotel', async (req, res, next) => {
  try {
    const trip = await getTripForOwner(idOf(req.params), ownerOf(req));
    await clearHotel(trip.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

const transportBody = z.object({ optionId: z.string().min(1) }).strict();

selectionsRouter.put('/trips/:id/selection/transport', async (req, res, next) => {
  try {
    const body = transportBody.parse(req.body);
    const trip = await getTripForOwner(idOf(req.params), ownerOf(req));
    const found = await selectTransportOption(trip, body.optionId);
    const row = found.row;
    res.json({ selection: { optionId: row.optionId, mode: row.mode, origin: found.origin, destination: found.destination, operator: row.provider, price: row.price, scheduleCertainty: row.scheduleCertainty } });
  } catch (err) {
    next(err);
  }
});

selectionsRouter.delete('/trips/:id/selection/transport', async (req, res, next) => {
  try {
    const trip = await getTripForOwner(idOf(req.params), ownerOf(req));
    await clearTransport(trip.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
