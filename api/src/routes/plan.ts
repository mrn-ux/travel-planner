import { Router } from 'express';
import { z } from 'zod';
import { optionalUser } from '../auth/middleware.js';
import { applyProposals, dismissProposal } from '../budget/proposals.js';
import { buildPlan } from '../budget/plan.js';
import { deleteItem, swapItem } from '../itinerary/edit.js';
import { generateItinerary } from '../itinerary/generate.js';
import { getTripForOwner } from '../trips/service.js';
import { ownerOf } from '../trips/routes.js';

export const planRouter = Router();
planRouter.use(optionalUser);

const idOf = (req: { params: Record<string, string | undefined> }, name = 'id'): string => String(req.params[name] ?? '');

planRouter.get('/trips/:id/plan', async (req, res, next) => {
  try {
    const trip = await getTripForOwner(idOf(req), ownerOf(req));
    res.json(await buildPlan(trip.id));
  } catch (err) {
    next(err);
  }
});

const generateBody = z.object({ days: z.array(z.number().int().min(1).max(14)).max(14).optional() }).strict();

planRouter.post('/trips/:id/plan/generate', async (req, res, next) => {
  try {
    const body = generateBody.parse(req.body ?? {});
    const trip = await getTripForOwner(idOf(req), ownerOf(req));
    const result = await generateItinerary(trip.id, body.days);
    res.json({ ...(await buildPlan(trip.id)), notes: result.notes });
  } catch (err) {
    next(err);
  }
});

const applyBody = z.object({ proposalIds: z.array(z.number().int()).min(1).max(10) }).strict();

planRouter.post('/trips/:id/plan/proposals/apply', async (req, res, next) => {
  try {
    const body = applyBody.parse(req.body);
    const owner = ownerOf(req);
    const trip = await getTripForOwner(idOf(req), owner);
    await applyProposals(trip.id, owner, body.proposalIds);
    res.json(await buildPlan(trip.id));
  } catch (err) {
    next(err);
  }
});

planRouter.post('/trips/:id/plan/proposals/:pid/dismiss', async (req, res, next) => {
  try {
    const trip = await getTripForOwner(idOf(req), ownerOf(req));
    await dismissProposal(trip.id, Number(req.params['pid']));
    res.json(await buildPlan(trip.id));
  } catch (err) {
    next(err);
  }
});

planRouter.delete('/trips/:id/plan/items/:itemId', async (req, res, next) => {
  try {
    const trip = await getTripForOwner(idOf(req), ownerOf(req));
    await deleteItem(trip, idOf(req, 'itemId'));
    res.json(await buildPlan(trip.id));
  } catch (err) {
    next(err);
  }
});

const swapBody = z.object({ attractionId: z.string().min(1).max(60) }).strict();

planRouter.post('/trips/:id/plan/items/:itemId/swap', async (req, res, next) => {
  try {
    const body = swapBody.parse(req.body);
    const trip = await getTripForOwner(idOf(req), ownerOf(req));
    await swapItem(trip, idOf(req, 'itemId'), body.attractionId);
    res.json(await buildPlan(trip.id));
  } catch (err) {
    next(err);
  }
});
