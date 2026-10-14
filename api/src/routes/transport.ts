import { Router } from 'express';
import { z } from 'zod';
import { optionalUser } from '../auth/middleware.js';
import { MODES, searchTransportForTrip } from '../search/transport.js';
import { getTripForOwner } from '../trips/service.js';
import { ownerOf } from '../trips/routes.js';

export const transportRouter = Router();
transportRouter.use(optionalUser);

const query = z.object({
  // comma-separated: modes=train,bus
  modes: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').map((m) => m.trim()).filter(Boolean) : undefined))
    .pipe(z.array(z.enum(MODES)).optional()),
  from: z.string().trim().max(120).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sort: z.enum(['price', 'duration', 'departure', 'recommended']).optional(),
  dir: z.enum(['asc', 'desc']).optional(),
});

transportRouter.get('/trips/:id/transport', async (req, res, next) => {
  try {
    const trip = await getTripForOwner(String(req.params['id'] ?? ''), ownerOf(req));
    res.json(await searchTransportForTrip(trip, query.parse(req.query)));
  } catch (err) {
    next(err);
  }
});
