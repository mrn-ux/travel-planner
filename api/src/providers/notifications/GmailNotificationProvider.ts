import nodemailer from 'nodemailer';
import { getConfig } from '../../config.js';
import type { ProviderResult } from '../types.js';
import type { BookingConfirmationMessage, FlightConfirmationMessage, NotificationProvider } from './NotificationProvider.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = (d: string): string => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;

/** "USD 1,240.00": currency code first, thousands separators, two decimals. */
export function money(amount: string, currency: string): string {
  const [whole = '0', frac = '00'] = amount.split('.');
  return `${currency.toUpperCase()} ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${frac.padEnd(2, '0').slice(0, 2)}`;
}

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

export function confirmationText(m: BookingConfirmationMessage): { subject: string; text: string; html: string } {
  const lines = [
    `Booking reference: ${m.bookingReference}`,
    ...(m.hotelConfirmationCode ? [`Hotel confirmation code: ${m.hotelConfirmationCode}`] : []),
    `Hotel: ${m.hotelName}`,
    `Check-in: ${day(m.checkin)}`,
    `Check-out: ${day(m.checkout)}`,
    `Final price: ${money(m.finalPrice, m.currency)}`,
    `Cancellation: ${m.cancellationSummary}`,
    '',
    'Sandbox booking: no real reservation was made and no real money was taken.',
  ];
  return {
    subject: `Faro booking confirmation ${m.bookingReference}`,
    text: lines.join('\n'),
    html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6">${lines.map((l) => (l === '' ? '<br>' : `<div>${esc(l)}</div>`)).join('')}</div>`,
  };
}

function flightText(m: FlightConfirmationMessage): { subject: string; text: string; html: string } {
  const when = (iso: string): string => (iso ? `${day(iso.slice(0, 10))}, ${iso.slice(11, 16)}` : 'not stated');
  const lines = [
    `Flight booking reference: ${m.bookingReference}`,
    `Airline: ${m.airline}`,
    `From: ${m.origin}`,
    `To: ${m.destination}`,
    `Departure: ${when(m.departure)} (local time)`,
    `Arrival: ${when(m.arrival)} (local time)`,
    `Travelers: ${m.passengers.join(', ')}`,
    `Total price: ${money(m.total, m.currency)}`,
    '',
    'Sandbox booking: made in the airline service test mode. No real reservation was made and no real money was taken.',
  ];
  return {
    subject: `Faro flight confirmation ${m.bookingReference}`,
    text: lines.join(String.fromCharCode(10)),
    html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6">${lines.map((l) => (l === '' ? '<br>' : `<div>${esc(l)}</div>`)).join('')}</div>`,
  };
}

/** Email through Gmail SMTP with an app password. Unconfigured means "not sent", and the booking stands. */
export class GmailNotificationProvider implements NotificationProvider {
  isConfigured(): boolean {
    const { gmail } = getConfig();
    return Boolean(gmail.user && gmail.appPassword);
  }

  async sendFlightConfirmation(input: FlightConfirmationMessage): Promise<ProviderResult<{ messageId: string }>> {
    return this.send(input.to, flightText(input));
  }

  async sendBookingConfirmation(input: BookingConfirmationMessage): Promise<ProviderResult<{ messageId: string }>> {
    return this.send(input.to, confirmationText(input));
  }

  private async send(to: string, body: { subject: string; text: string; html: string }): Promise<ProviderResult<{ messageId: string }>> {
    const { gmail } = getConfig();
    if (!gmail.user || !gmail.appPassword) return { ok: false, reason: 'http_error', detail: 'not_configured' };
    const transport = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: gmail.user, pass: gmail.appPassword }, connectionTimeout: 10000, socketTimeout: 15000 });
    try {
      const info = await transport.sendMail({ from: `Faro <${gmail.user}>`, to, subject: body.subject, text: body.text, html: body.html });
      return { ok: true, data: { messageId: String(info.messageId) }, provenance: { source: 'gmail', source_url: null, fetched_at: new Date().toISOString(), certainty: 'confirmed' } };
    } catch (err) {
      const e = err as { code?: string; message?: string };
      console.warn('Confirmation email failed:', e.code ?? '', e.message ?? '');
      return { ok: false, reason: e.code === 'ETIMEDOUT' || e.code === 'ESOCKET' ? 'timeout' : 'http_error', detail: e.message };
    } finally {
      transport.close();
    }
  }
}
