import { Router, type Request } from 'express';
import { bookFlight, checkFlight, getFlightBooking, resendFlightEmail } from '../flights/bookings.js';
import { getTripForOwner } from '../trips/service.js';
import { ownerOf } from '../trips/routes.js';

export const flightBookingsRouter = Router();

const idOf = (req: Request): string => String(req.params['id'] ?? '');

/** The trip's confirmed flight booking, if any. */
flightBookingsRouter.get('/trips/:id/flight-booking', async (req, res, next) => {
  try {
    const trip = await getTripForOwner(idOf(req), ownerOf(req));
    res.json({ booking: await getFlightBooking(trip.id) });
  } catch (err) {
    next(err);
  }
});

/** Look the chosen flight up again: live price, terms and who must be named. */
flightBookingsRouter.post('/trips/:id/flight-booking/check', async (req, res, next) => {
  try {
    const trip = await getTripForOwner(idOf(req), ownerOf(req));
    res.json(await checkFlight(trip));
  } catch (err) {
    next(err);
  }
});

flightBookingsRouter.post('/trips/:id/flight-booking', async (req, res, next) => {
  try {
    const trip = await getTripForOwner(idOf(req), ownerOf(req));
    const user = req.user as { id: string };
    res.status(201).json({ booking: await bookFlight(trip, user.id, req.body) });
  } catch (err) {
    next(err);
  }
});

flightBookingsRouter.post('/trips/:id/flight-booking/resend', async (req, res, next) => {
  try {
    const trip = await getTripForOwner(idOf(req), ownerOf(req));
    res.json(await resendFlightEmail(trip, (req.user as { id: string }).id));
  } catch (err) {
    next(err);
  }
});
