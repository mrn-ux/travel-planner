import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { optionalUser } from '../auth/middleware.js';
import { getConfig } from '../config.js';
import { AppError } from '../errors.js';
import { ensureDestinationKnowledge, knowledgeStatus } from '../knowledge/ensure.js';
import { refreshExpired } from '../knowledge/refresh.js';
import { resolveDestination } from '../providers/knowledge/OpenMeteo.js';
import { getTripForOwner, setTripDestination } from '../trips/service.js';
import { ownerOf } from '../trips/routes.js';
import { getRecommendations, refreshRecommendations } from './service.js';

export const recommendationsRouter = Router();

const idOf = (req: { params: Record<string, string | undefined> }): string => String(req.params['id'] ?? '');

recommendationsRouter.get('/trips/:id/recommendations', optionalUser, async (req, res, next) => {
  try {
    const trip = await getTripForOwner(idOf(req), ownerOf(req));
    res.json(await getRecommendations(trip));
  } catch (err) {
    next(err);
  }
});

const refreshBody = z.object({ excluded: z.array(z.string().max(120)).max(50).optional() }).strict();

recommendationsRouter.post('/trips/:id/recommendations/refresh', optionalUser, async (req, res, next) => {
  try {
    const body = refreshBody.parse(req.body ?? {});
    const trip = await getTripForOwner(idOf(req), ownerOf(req));
    res.json(await refreshRecommendations(trip, body.excluded ?? []));
  } catch (err) {
    next(err);
  }
});

const destinationBody = z.object({ destination: z.string().trim().min(1).max(200), countryCode: z.string().length(2).optional() }).strict();

recommendationsRouter.put('/trips/:id/destination', optionalUser, async (req, res, next) => {
  try {
    const body = destinationBody.parse(req.body);
    const owner = ownerOf(req);
    const ref = await resolveDestination(body.destination);
    if (!ref || ref.lat === null || ref.lon === null || !ref.countryCode) {
      throw new AppError(400, 'That place could not be found.', { fields: { destination: 'That place could not be found.' } });
    }
    const trip = await setTripDestination(idOf(req), owner, { name: ref.name, countryCode: ref.countryCode, lat: ref.lat, lon: ref.lon, countryName: ref.countryName });
    // First time this place is discussed: fetch its guides in the background. Failure shows as unavailable later.
    void ensureDestinationKnowledge(ref).catch((err) => console.warn('Ingestion failed:', err instanceof Error ? err.message : err));
    res.json({ trip });
  } catch (err) {
    next(err);
  }
});

recommendationsRouter.delete('/trips/:id/destination', optionalUser, async (req, res, next) => {
  try {
    res.json({ trip: await setTripDestination(idOf(req), ownerOf(req), null) });
  } catch (err) {
    next(err);
  }
});

recommendationsRouter.get('/knowledge/status', async (req, res, next) => {
  try {
    const destination = String(req.query['destination'] ?? '').trim();
    if (!destination) throw new AppError(400, 'Say which destination.', { fields: { destination: 'Required.' } });
    res.json(await knowledgeStatus(destination));
  } catch (err) {
    next(err);
  }
});

function tokenMatches(given: string | undefined, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

recommendationsRouter.post('/admin/refresh', (req, res, next) => {
  const token = getConfig().adminToken;
  if (!token) return next(new AppError(404, 'Not found')); // disabled when ADMIN_TOKEN is unset
  if (!tokenMatches(req.header('x-admin-token'), token)) return next(new AppError(401, 'Wrong admin token.'));
  void refreshExpired().catch((err) => console.warn('Manual refresh failed:', err instanceof Error ? err.message : err));
  res.status(202).json({ started: true });
});
