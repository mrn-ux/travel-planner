import { Router, type Request } from 'express';
import { z } from 'zod';
import { getPreferences } from '../auth/accounts.js';
import { optionalUser, requireUser } from '../auth/middleware.js';
import { AgentTurnError, lastUnansweredMessage, listMessages, runAgentTurn } from '../agent/run.js';
import { AppError } from '../errors.js';
import { listTrips } from './listTrips.js';
import {
  applyBriefPatch,
  claimTrip,
  createTrip,
  getTripForOwner,
  hashTripKey,
  latestTripForUser,
  deleteTrip,
  missingMinimum,
  type Owner,
} from './service.js';

export const tripsRouter = Router();

// Visitors can plan without an account, so these routes never answer 401 (that would send a visitor to /login).
// A trip that is missing or belongs to someone else is a 404 either way.
tripsRouter.use(optionalUser);

export function ownerOf(req: Request): Owner {
  if (req.user) return { userId: req.user.id };
  const key = req.header('x-trip-key');
  if (key) return { anonKeyHash: hashTripKey(key) };
  throw new AppError(404, 'Trip not found');
}

const idOf = (req: Request): string => String(req.params['id'] ?? '');

// ---- Trips ----------------------------------------------------------------------------------------------

tripsRouter.post('/', async (req, res, next) => {
  try {
    const initial = req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0 ? req.body : undefined;
    const { trip, tripKey } = await createTrip(req.user ? { userId: req.user.id } : { anonymous: true });
    if (initial) {
      const owner: Owner = req.user ? { userId: req.user.id } : { anonKeyHash: hashTripKey(tripKey as string) };
      const result = await applyBriefPatch(trip.id, owner, initial);
      res.status(201).json({ trip: result.trip, missing: result.missing, ...(tripKey ? { tripKey } : {}) });
      return;
    }
    res.status(201).json({ trip, missing: missingMinimum(trip), ...(tripKey ? { tripKey } : {}) });
  } catch (err) {
    next(err);
  }
});

// The signed-in user's most recently updated trip (used when the home screen has no stored trip id).
// The signed-in user's saved trips (My trips). Registered before '/:id'.
tripsRouter.get('/', requireUser, async (req, res, next) => {
  try {
    res.json({ trips: await listTrips((req.user as { id: string }).id) });
  } catch (err) {
    next(err);
  }
});

tripsRouter.get('/latest', async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(404, 'Trip not found');
    const trip = await latestTripForUser(req.user.id);
    if (!trip) throw new AppError(404, 'Trip not found');
    res.json({ trip, missing: missingMinimum(trip) });
  } catch (err) {
    next(err);
  }
});

tripsRouter.post('/claim', requireUser, async (req, res, next) => {
  try {
    const { tripKey } = z.object({ tripKey: z.string().min(1).max(200) }).parse(req.body);
    const ids = await claimTrip(tripKey, (req.user as NonNullable<Request['user']>).id);
    const id = ids[0];
    if (!id) throw new AppError(404, 'Trip not found');
    const trip = await getTripForOwner(id, { userId: (req.user as NonNullable<Request['user']>).id });
    res.json({ trip, missing: missingMinimum(trip) });
  } catch (err) {
    next(err);
  }
});

tripsRouter.get('/:id', async (req, res, next) => {
  try {
    const trip = await getTripForOwner(idOf(req), ownerOf(req));
    res.json({ trip, missing: missingMinimum(trip) });
  } catch (err) {
    next(err);
  }
});

tripsRouter.delete('/:id', requireUser, async (req, res, next) => {
  try {
    await deleteTrip((req.user as { id: string }).id, idOf(req));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

tripsRouter.patch('/:id', async (req, res, next) => {
  try {
    res.json(await applyBriefPatch(idOf(req), ownerOf(req), req.body));
  } catch (err) {
    next(err);
  }
});

// ---- Conversation ---------------------------------------------------------------------------------------

tripsRouter.get('/:id/messages', async (req, res, next) => {
  try {
    const trip = await getTripForOwner(idOf(req), ownerOf(req));
    res.json({ messages: await listMessages(trip.id) });
  } catch (err) {
    next(err);
  }
});

const messageSchema = z.object({
  text: z
    .string()
    .transform((t) => t.trim())
    .pipe(z.string().min(1, 'Write a message first.').max(4000, 'That message is too long (4,000 characters at most).')),
});

async function preferredCurrencyOf(req: Request): Promise<string | null> {
  return req.user ? (await getPreferences(req.user.id)).preferredCurrency : null;
}

tripsRouter.post('/:id/messages', async (req, res, next) => {
  try {
    const owner = ownerOf(req);
    const trip = await getTripForOwner(idOf(req), owner);
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0]?.message ?? 'Write a message first.');

    const result = await runAgentTurn({
      trip,
      owner,
      userId: req.user?.id ?? null,
      preferredCurrency: await preferredCurrencyOf(req),
      text: parsed.data.text,
    });
    res.json(result);
  } catch (err) {
    if (err instanceof AgentTurnError) return next(err);
    next(err);
  }
});

// Retry the last traveler message that has no reply (after an assistant failure). Nothing is lost or duplicated.
tripsRouter.post('/:id/messages/retry', async (req, res, next) => {
  try {
    const owner = ownerOf(req);
    const trip = await getTripForOwner(idOf(req), owner);
    const pending = await lastUnansweredMessage(trip.id);
    if (!pending) throw new AppError(409, 'There is nothing to retry.');
    const result = await runAgentTurn({
      trip,
      owner,
      userId: req.user?.id ?? null,
      preferredCurrency: await preferredCurrencyOf(req),
      text: pending.content,
      existingUserMessage: pending,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});
