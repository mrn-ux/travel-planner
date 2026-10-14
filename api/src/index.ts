import { requireUser } from './auth/middleware.js';
import express from 'express';
import { getConfig } from './config.js';
import { connectWithRetry, query } from './db.js';
import { authRouter } from './auth/routes.js';
import { setTripClaimHandler } from './auth/tripHandover.js';
import { cleanupAuthTables } from './auth/sessions.js';
import { errorHandler, notFoundHandler } from './errors.js';
import { claimTrip, deleteStaleDrafts } from './trips/service.js';
import { tripsRouter } from './trips/routes.js';
import cron from 'node-cron';
import { flightProvider, notificationProvider, paymentProvider } from './providers/index.js';
import { hotelsRouter } from './routes/hotels.js';
import { flightBookingsRouter } from './routes/flightBookings.js';
import { placesRouter } from './routes/places.js';
import { bookingsRouter } from './routes/bookings.js';
import { reconcileAll } from './bookings/service.js';
import { planFileRouter } from './routes/planFile.js';
import { planRouter } from './routes/plan.js';
import { selectionsRouter } from './routes/selections.js';
import { transportRouter } from './routes/transport.js';
import { recommendationsRouter } from './recommendations/routes.js';
import { refreshExpired } from './knowledge/refresh.js';
import { warmUp } from './knowledge/warmup.js';
import { registerKnowledgeTools } from './tools/index.js';

async function main(): Promise<void> {
  // Fails fast with a message naming any missing required variable.
  const config = getConfig();
  // Refuse to start with live Stripe keys or an unknown provider value.
  paymentProvider();
  flightProvider(); // refuses a live Duffel token at start-up
  notificationProvider();

  const app = express();
  app.disable('x-powered-by');
  // Behind the nginx proxy: use the real client address (for login throttling).
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', async (_req, res, next) => {
    try {
      await query('SELECT 1');
      res.json({ status: 'ok' });
    } catch (err) {
      next(err);
    }
  });

  // Only the Stripe publishable key reaches the browser. Never return other configuration here.
  app.get('/api/config/public', (_req, res) => {
    res.json({ stripePublishableKey: config.stripe.publishableKey });
  });

  // A visitor's draft trip becomes the user's trip when they sign in or sign up.
  setTripClaimHandler(async (tripKey, userId) => {
    await claimTrip(tripKey, userId);
  });

  app.use('/api/auth', authRouter);
  // Everything below needs a signed-in user, except the admin refresh (its own token) and the public destination photo shown behind the login page.
  app.use('/api', (req, res, next) => (req.path.startsWith('/admin/') || req.path === '/places/destination-photo' ? next() : requireUser(req, res, next)));
  app.use('/api/trips', tripsRouter);
  registerKnowledgeTools();
  app.use('/api', recommendationsRouter);
  app.use('/api', placesRouter);
  app.use('/api', flightBookingsRouter);
  app.use('/api', hotelsRouter);
  app.use('/api', transportRouter);
  app.use('/api', selectionsRouter);
  app.use('/api', planRouter);
  app.use('/api', planFileRouter);
  app.use('/api', bookingsRouter);
  // Other feature routers are mounted here by later plans (trips, search, bookings, ...).

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  await connectWithRetry();

  // Housekeeping: expired sessions, old login attempts and OAuth states, abandoned draft trips.
  const daily = 24 * 60 * 60 * 1000;
  const sweep = () =>
    Promise.all([cleanupAuthTables(), deleteStaleDrafts()]).catch((err) => console.warn('Housekeeping failed:', err));
  void sweep();
  setInterval(sweep, daily).unref();

  // Bookings waiting on the hotel provider, a payment return or a refund are settled every minute (the substitute for webhooks).
  cron.schedule('* * * * *', () => {
    reconcileAll().catch((err) => console.warn('Booking reconcile failed:', err instanceof Error ? err.message : err));
  });

  if (cron.validate(config.refreshCron)) {
    cron.schedule(config.refreshCron, () => {
      refreshExpired().catch((err) => console.warn('Scheduled refresh failed:', err instanceof Error ? err.message : err));
    });
  } else {
    console.warn(`REFRESH_CRON "${config.refreshCron}" is not a valid cron expression: scheduled refresh is off.`);
  }

  app.listen(config.port, () => {
    console.log(`Faro API listening on port ${config.port}`);
    // Background: never blocks requests.
    void warmUp().catch((err) => console.warn('Knowledge warm-up failed:', err instanceof Error ? err.message : err));
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
