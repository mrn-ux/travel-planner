import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import type { PlanItem } from '../budget/plan.js';
import { EM_DASH, formatDate, formatDateTime, formatDuration, formatMoney, label, safe } from './format.js';
import type { PlanData } from './buildPlanData.js';

// Inter (SIL Open Font License 1.1) from @fontsource/inter. Latin covers Western European names; Latin Extended covers the rest of
// the Latin alphabets. Text is split into runs so each character is drawn with a font that has it.
const FONT_DIR = fileURLToPath(new URL('../../node_modules/@fontsource/inter/files/', import.meta.url));
const FONTS = {
  regular: `${FONT_DIR}inter-latin-400-normal.woff`,
  bold: `${FONT_DIR}inter-latin-600-normal.woff`,
  extRegular: `${FONT_DIR}inter-latin-ext-400-normal.woff`,
  extBold: `${FONT_DIR}inter-latin-ext-600-normal.woff`,
};

const COLOR = { text: '#16242B', secondary: '#566269', muted: '#8C969B', accent: '#0E6F8E', rule: '#DCE2E4', over: '#C2410C', under: '#2F8F5B' };

const isLatin = (cp: number): boolean => cp < 0x100 || (cp >= 0x2000 && cp <= 0x206f) || cp === 0x20ac;

type Doc = InstanceType<typeof PDFDocument>;

/** Draw text in runs: Latin characters with the Latin font, anything else with the Latin Extended font. */
function write(doc: Doc, text: string, o: { size?: number; bold?: boolean; color?: string; indent?: number; gap?: number } = {}): void {
  const size = o.size ?? 10;
  doc.fontSize(size).fillColor(o.color ?? COLOR.text);
  const runs: Array<{ latin: boolean; s: string }> = [];
  for (const ch of text) {
    const latin = isLatin(ch.codePointAt(0) as number);
    const last = runs[runs.length - 1];
    if (last && last.latin === latin) last.s += ch;
    else runs.push({ latin, s: ch });
  }
  if (runs.length === 0) runs.push({ latin: true, s: '' });
  const x = doc.page.margins.left + (o.indent ?? 0);
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right - (o.indent ?? 0);
  runs.forEach((r, i) => {
    doc.font(r.latin ? (o.bold ? 'bold' : 'regular') : o.bold ? 'extBold' : 'extRegular');
    const last = i === runs.length - 1;
    if (i === 0) doc.text(r.s, x, doc.y, { width, continued: !last, lineGap: 2 });
    else doc.text(r.s, { continued: !last, lineGap: 2 });
  });
  if (o.gap) doc.moveDown(o.gap);
}

const heading = (doc: Doc, text: string): void => {
  doc.moveDown(0.8);
  write(doc, text, { size: 13, bold: true, color: COLOR.accent });
  doc.moveTo(doc.page.margins.left, doc.y + 2).lineTo(doc.page.width - doc.page.margins.right, doc.y + 2).strokeColor(COLOR.rule).lineWidth(0.5).stroke();
  doc.moveDown(0.5);
};

const notYet = (doc: Doc, why: string): void => write(doc, `Not yet available: ${why}`, { color: COLOR.muted });

function costText(i: PlanItem): string {
  if (i.kind !== 'activity') return EM_DASH;
  return `${formatMoney(i.cost.amount, i.cost.currency)} (${label(i.cost.certainty)})`;
}

const SLOT_LABEL = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' } as const;

/** The plan as a PDF, built entirely in memory so a failure never leaves a partial file. */
export async function renderPlanPdf(d: PlanData): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 48, bottom: 56, left: 48, right: 48 }, info: { Title: `Trip plan: ${safe(d.plan.trip.destination)}`, Producer: 'Faro', Creator: 'Faro' } });
  doc.registerFont('regular', FONTS.regular);
  doc.registerFont('bold', FONTS.bold);
  doc.registerFont('extRegular', FONTS.extRegular);
  doc.registerFont('extBold', FONTS.extBold);

  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const { plan, trip, booking, transport } = d;
  const cur = plan.budget.currency;

  // ---- 1. Destination and dates -----------------------------------------------------------------------------------------------
  write(doc, 'Faro trip plan', { size: 9, color: COLOR.muted });
  write(doc, plan.trip.destination ? safe(plan.trip.destination) : 'Destination not chosen', { size: 22, bold: true });
  const dates = plan.trip.startDate && plan.trip.endDate ? `${formatDate(plan.trip.startDate)} – ${formatDate(plan.trip.endDate)}` : trip.dateWindowText ?? EM_DASH;
  const kids = trip.childrenAges.length;
  const travelers = trip.adults ? `${trip.adults} ${trip.adults === 1 ? 'adult' : 'adults'}${kids > 0 ? `, ${kids} ${kids === 1 ? 'child' : 'children'}` : ''}` : EM_DASH;
  heading(doc, '1. Destination and dates');
  write(doc, `Destination: ${plan.trip.destination ? safe(plan.trip.destination) : 'Not chosen yet'}`);
  write(doc, `Dates: ${dates}${trip.durationDays ? ` (${trip.durationDays} ${trip.durationDays === 1 ? 'day' : 'days'})` : ''}`);
  write(doc, `Travelers: ${travelers}`);
  write(doc, `Budget: ${trip.budget ? formatMoney(trip.budget.amount, trip.budget.currency) : EM_DASH}`);
  if (trip.interests) write(doc, `Interests: ${safe(trip.interests)}`);
  if (trip.specialRequirements) write(doc, `Notes: ${safe(trip.specialRequirements)}`);

  // ---- 2. Day-by-day itinerary ------------------------------------------------------------------------------------------------
  heading(doc, '2. Day-by-day itinerary');
  if (plan.itinerary.length === 0) notYet(doc, 'no itinerary has been generated for this trip.');
  for (const day of plan.itinerary) {
    doc.moveDown(0.3);
    write(doc, `Day ${day.day}  ·  ${formatDate(day.date)}`, { size: 11, bold: true });
    if (day.note) write(doc, day.note, { size: 8.5, color: COLOR.muted });
    for (const slot of ['morning', 'afternoon', 'evening'] as const) {
      const items = day.items.filter((i) => i.slot === slot);
      if (items.length === 0) continue;
      write(doc, SLOT_LABEL[slot], { size: 9, bold: true, color: COLOR.secondary, indent: 8 });
      for (const i of items) {
        write(doc, `${safe(i.startsAt)}  ${safe(i.title)}  ·  ${formatDuration(i.durationMinutes)}  ·  ${costText(i)}`, { indent: 16 });
        if (i.kind === 'activity' && i.openingHours) write(doc, `Opening hours: ${safe(i.openingHours)}`, { size: 8.5, color: COLOR.muted, indent: 28 });
        if (i.travelMinutesToNext !== null) write(doc, `${formatDuration(i.travelMinutesToNext)} to the next stop (${label(i.travelCertainty ?? 'estimated')})`, { size: 8.5, color: COLOR.muted, indent: 28 });
      }
    }
  }

  // ---- 3. Selected hotel ----------------------------------------------------------------------------------------------------
  heading(doc, '3. Selected hotel');
  const h = plan.selectedHotel;
  if (!h) {
    notYet(doc, 'no hotel has been selected.');
  } else {
    write(doc, safe(h.name), { bold: true });
    write(doc, `Room: ${safe(h.roomName)}`);
    write(doc, `Stay: ${formatDate(h.checkin)} – ${formatDate(h.checkout)}`);
    write(doc, `Price per night: ${formatMoney(h.price.amount, h.price.currency)} (${label(h.price.certainty)})`);
    write(doc, `Total: ${formatMoney(h.total.amount, h.total.currency)} (${label(h.total.certainty)})`);
    write(doc, 'Sandbox rate: not a real reservation.', { size: 8.5, color: COLOR.muted });
  }
  if (booking?.status === 'confirmed') {
    write(doc, `Booking: Confirmed, reference ${safe(booking.reference)}${booking.hotelConfirmationCode ? `, hotel confirmation code ${safe(booking.hotelConfirmationCode)}` : ''}`, { bold: true });
    write(doc, `${safe(booking.hotelName)}, ${formatDate(booking.checkin)} – ${formatDate(booking.checkout)}, ${formatMoney(booking.finalPrice, booking.currency)} (Confirmed)`);
  } else if (booking?.status === 'pending') {
    write(doc, 'Booking: Pending confirmation with the hotel provider. Not confirmed yet.', { bold: true, color: COLOR.over });
  } else if (h) {
    write(doc, 'Booking: Not booked.');
  }

  // ---- 4. Selected transport --------------------------------------------------------------------------------------------------
  heading(doc, '4. Selected transport');
  const tp = plan.selectedTransport;
  if (!tp || !transport) {
    notYet(doc, 'no transport option has been selected.');
  } else {
    write(doc, `${safe(tp.label)}`, { bold: true });
    if (d.flightBooking) {
      write(doc, `Flight booked in test mode, reference ${safe(d.flightBooking.reference)}${d.flightBooking.airline ? ` (${safe(d.flightBooking.airline)})` : ''}. Sandbox booking: not a real reservation.`, { bold: true });
    } else {
      write(doc, 'Not booked: Faro compares trains, buses and other modes and only books flights (test mode).', { color: COLOR.secondary });
    }
    write(doc, `Departure: ${transport.departure ? formatDateTime(new Date(transport.departure)) : 'Unavailable'}   Arrival: ${transport.arrival ? formatDateTime(new Date(transport.arrival)) : 'Unavailable'}   (${label(transport.scheduleCertainty)})`);
    write(doc, `Duration: ${formatDuration(transport.durationMinutes)}`);
    write(doc, `Price: ${formatMoney(tp.price.amount, tp.price.currency)} (${label(tp.price.certainty)})${tp.price.range ? `, range ${formatMoney(tp.price.range.low, tp.price.currency)} to ${formatMoney(tp.price.range.high, tp.price.currency)}` : ''}`);
    if (tp.price.basis) write(doc, safe(tp.price.basis), { size: 8.5, color: COLOR.muted });
  }

  // ---- 4b. Places to visit ----------------------------------------------------------------------------------------------------
  heading(doc, '4b. Places to visit');
  if (plan.selectedPlaces.length === 0) {
    notYet(doc, 'no places to visit have been chosen.');
  } else {
    for (const p of plan.selectedPlaces) {
      const entry = p.entry.kind === 'free' ? 'free entry' : p.entry.kind === 'paid' ? `paid entry${p.entry.charge ? ` ${p.entry.charge}` : ''}` : 'entry not stated';
      write(doc, `${safe(p.name)} (${safe(p.kind)}): ${entry}; ${p.openingHours ? `open ${safe(p.openingHours)}` : 'opening hours not stated'}`, { indent: 8 });
    }
  }

  // ---- 5. Budget breakdown --------------------------------------------------------------------------------------------------
  heading(doc, '5. Budget breakdown');
  const NAMES: Record<string, string> = { hotels: 'Hotels', transportation: 'Transportation', activities: 'Activities', food: 'Food', local_transport: 'Local transport', miscellaneous: 'Miscellaneous' };
  const missing = new Set(plan.budget.categoriesWithoutRealFigure);
  for (const c of plan.budget.categories) {
    const none = c.itemCount === 0;
    write(doc, `${NAMES[c.category] ?? c.category}: ${none ? EM_DASH : formatMoney(c.amount, cur)}  (${missing.has(c.category) ? (none ? 'Unavailable: no figure yet' : `${label(c.certainty)}, partial`) : label(c.certainty)})`, { indent: 8 });
  }
  doc.moveDown(0.4);
  // With no category costed at all, a total of 0.00 would read as "free": say there is no figure instead.
  const nothingCosted = plan.budget.categories.every((c) => c.itemCount === 0);
  write(doc, nothingCosted ? `Estimated total: ${EM_DASH} (Unavailable: nothing is costed yet)` : `Estimated total: ${formatMoney(plan.budget.estimatedTotal, cur)}`, { bold: true });
  write(doc, `Budget: ${formatMoney(plan.budget.budget, cur)}`);
  write(doc, `Remaining: ${nothingCosted ? EM_DASH : formatMoney(plan.budget.remaining, cur)}`, { bold: true, color: plan.overBudget.over ? COLOR.over : COLOR.under });
  if (plan.budget.partial) write(doc, `Partial total: no real figure yet for ${plan.budget.categoriesWithoutRealFigure.map((c) => NAMES[c] ?? c).join(', ')}. These are not counted as zero.`, { size: 9, color: COLOR.over });
  write(doc, 'Food, local transport and miscellaneous are Faro estimates, not quotes.', { size: 8.5, color: COLOR.muted });

  // ---- Footer -----------------------------------------------------------------------------------------------------------------
  doc.moveDown(1);
  doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor(COLOR.rule).lineWidth(0.5).stroke();
  doc.moveDown(0.5);
  write(doc, `Generated ${formatDateTime(d.generatedAt)} from the trip as it is now.`, { size: 8.5, color: COLOR.muted });
  write(doc, 'Prices and schedules marked Estimated or Unavailable are not guaranteed. Hotel rates and bookings come from a sandbox and are not real reservations.', { size: 8.5, color: COLOR.muted });
  write(doc, 'Sources: LiteAPI sandbox (hotels); Transitous timetables; Faro estimates (transport prices); Open-Meteo; © OpenStreetMap contributors (attractions, opening hours); Wikivoyage and Wikipedia (CC BY-SA 4.0); ECB reference rates via Frankfurter.', { size: 8.5, color: COLOR.muted });

  doc.end();
  return finished;
}
