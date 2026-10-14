import { query } from '../db.js';
import { notificationProvider } from '../providers/index.js';
import type { BookingRow } from './machine.js';

export type EmailStatus = 'sent' | 'failed' | 'not_configured';

/**
 * Send the booking confirmation to the signed-in user's address and record the outcome. This never throws and never touches the
 * booking: a failed or unconfigured email leaves the booking confirmed and the page offers Resend.
 */
export async function sendConfirmationEmail(row: BookingRow): Promise<EmailStatus> {
  const user = await query<{ email: string }>('SELECT email FROM users WHERE id = $1', [row.user_id]);
  const to = user.rows[0]?.email ?? row.guest?.email ?? '';
  const record = (status: EmailStatus, error?: string) =>
    query('INSERT INTO confirmation_messages (booking_id, to_address, status, error) VALUES ($1, $2, $3, $4)', [row.id, to, status, error ?? null]);

  const provider = notificationProvider();
  if (!provider.isConfigured()) {
    await record('not_configured');
    return 'not_configured';
  }
  if (!row.provider_booking_id || !row.final_price || !to) {
    await record('failed', 'Missing booking details');
    return 'failed';
  }
  try {
    const result = await provider.sendBookingConfirmation({
      to,
      bookingReference: row.provider_booking_id,
      hotelName: row.hotel_name,
      checkin: row.checkin,
      checkout: row.checkout,
      finalPrice: row.final_price,
      currency: row.currency.trim(),
      cancellationSummary: row.cancellation?.text ?? 'See the hotel terms.',
      hotelConfirmationCode: row.hotel_confirmation_code,
      sandbox: true,
    });
    if (result.ok) {
      await record('sent');
      return 'sent';
    }
    await record('failed', result.detail ?? result.reason);
    return 'failed';
  } catch (err) {
    await record('failed', err instanceof Error ? err.message : 'error').catch(() => undefined);
    return 'failed';
  }
}

export async function latestEmailStatus(bookingId: string): Promise<EmailStatus | null> {
  const r = await query<{ status: EmailStatus }>('SELECT status FROM confirmation_messages WHERE booking_id = $1 ORDER BY attempted_at DESC, id DESC LIMIT 1', [bookingId]);
  return r.rows[0]?.status ?? null;
}
