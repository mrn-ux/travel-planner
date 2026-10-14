import { Router } from 'express';
import { optionalUser } from '../auth/middleware.js';
import { buildPlanData } from '../plan-file/buildPlanData.js';
import { renderPlanPdf } from '../plan-file/renderPdf.js';
import { getTripForOwner } from '../trips/service.js';
import { ownerOf } from '../trips/routes.js';

export const planFileRouter = Router();
planFileRouter.use(optionalUser);

/** ASCII-only file name from the destination and start date, never empty. */
function fileName(destination: string | null, start: string | null): string {
  const base = [destination, start].filter(Boolean).join('-').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  return base ? `${base}-plan.pdf` : 'faro-trip-plan.pdf';
}

/** A fresh PDF of the trip's current data on every request. Nothing is stored; an unowned trip is a 404. */
planFileRouter.get('/trips/:id/plan.pdf', async (req, res, next) => {
  try {
    const trip = await getTripForOwner(String(req.params['id'] ?? ''), ownerOf(req));
    const data = await buildPlanData(trip.id);
    const pdf = await renderPlanPdf(data); // built in memory: a failure here sends no partial file
    res.status(200);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName(trip.destination, trip.startDate)}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Length', String(pdf.length));
    res.end(pdf);
  } catch (err) {
    next(err);
  }
});
