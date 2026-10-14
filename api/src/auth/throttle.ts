import { query } from '../db.js';

const WINDOW = "interval '15 minutes'";
const MAX_FAILURES_PER_EMAIL = 5;
const MAX_FAILURES_PER_IP = 20;

export async function recordAttempt(emailLower: string, ip: string | undefined, success: boolean): Promise<void> {
  await query('INSERT INTO login_attempts (email_lower, ip, success) VALUES ($1, $2, $3)', [
    emailLower,
    ip ?? null,
    success,
  ]);
}

/** True when too many recent failures exist for this email or this address (counted in SQL). */
export async function isThrottled(emailLower: string, ip: string | undefined): Promise<boolean> {
  const res = await query<{ by_email: string; by_ip: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE email_lower = $1) AS by_email,
       COUNT(*) FILTER (WHERE ip = $2) AS by_ip
     FROM login_attempts
     WHERE success = false AND attempted_at > now() - ${WINDOW}`,
    [emailLower, ip ?? null],
  );
  const row = res.rows[0];
  if (!row) return false;
  return Number(row.by_email) >= MAX_FAILURES_PER_EMAIL || (ip !== undefined && Number(row.by_ip) >= MAX_FAILURES_PER_IP);
}
