import { Router } from 'express';
import { z } from 'zod';
import { requireUser } from '../auth/middleware.js';
import { acceptPrice, complete, confirm, getBooking, guestSchema, priceAndTerms, resend, saveGuest, startBooking, startSchema, verify } from '../bookings/service.js';

export const bookingsRouter = Router();
bookingsRouter.use(requireUser);

const uid = (req: { user?: { id: string } }): string => (req.user as { id: string }).id;
const idOf = (req: { params: Record<string, string | undefined> }, name = 'id'): string => String(req.params[name] ?? '');

bookingsRouter.post('/trips/:tripId/bookings', async (req, res, next) => {
  try {
    const { booking, created } = await startBooking(uid(req), idOf(req, 'tripId'), startSchema.parse(req.body));
    res.status(created ? 201 : 200).json({ booking });
  } catch (err) {
    next(err);
  }
});

bookingsRouter.get('/bookings/:id', async (req, res, next) => {
  try {
    res.json({ booking: await getBooking(uid(req), idOf(req)) });
  } catch (err) {
    next(err);
  }
});

bookingsRouter.post('/bookings/:id/verify', async (req, res, next) => {
  try {
    res.json(await verify(uid(req), idOf(req)));
  } catch (err) {
    next(err);
  }
});

bookingsRouter.post('/bookings/:id/price', async (req, res, next) => {
  try {
    res.json(await priceAndTerms(uid(req), idOf(req)));
  } catch (err) {
    next(err);
  }
});

const acceptBody = z.object({ amount: z.string().regex(/^\d{1,12}(\.\d{1,2})?$/), currency: z.string().length(3) }).strict();

bookingsRouter.post('/bookings/:id/accept-price', async (req, res, next) => {
  try {
    const body = acceptBody.parse(req.body);
    res.json({ booking: await acceptPrice(uid(req), idOf(req), body) });
  } catch (err) {
    next(err);
  }
});

bookingsRouter.put('/bookings/:id/guest', async (req, res, next) => {
  try {
    const parsed = guestSchema.safeParse(req.body);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const i of parsed.error.issues) if (!(String(i.path[0]) in fields)) fields[String(i.path[0] ?? 'form')] = i.message;
      res.status(400).json({ error: 'Please correct the highlighted fields.', fields });
      return;
    }
    res.json({ booking: await saveGuest(uid(req), idOf(req), parsed.data) });
  } catch (err) {
    next(err);
  }
});

bookingsRouter.post('/bookings/:id/confirm', async (req, res, next) => {
  try {
    res.json(await confirm(uid(req), idOf(req)));
  } catch (err) {
    next(err);
  }
});

const completeBody = z.object({ paymentIntentId: z.string().regex(/^pi_[A-Za-z0-9_]{8,100}$/) }).strict();

bookingsRouter.post('/bookings/:id/complete', async (req, res, next) => {
  try {
    const body = completeBody.parse(req.body);
    res.json({ booking: await complete(uid(req), idOf(req), body.paymentIntentId) });
  } catch (err) {
    next(err);
  }
});

bookingsRouter.post('/bookings/:id/resend', async (req, res, next) => {
  try {
    res.json({ message: await resend(uid(req), idOf(req)) });
  } catch (err) {
    next(err);
  }
});
