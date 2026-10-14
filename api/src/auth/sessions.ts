import { createHash, randomBytes } from 'node:crypto';
import { getConfig } from '../config.js';
import { query } from '../db.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function ttlMs(): number {
  return getConfig().sessionTtlDays * DAY_MS;
}

/** Create a session. The opaque token is returned once; only its SHA-256 hash is stored. */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + ttlMs());
  await query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [
    hashToken(token),
    userId,
    expiresAt,
  ]);
  return { token, expiresAt };
}

/** Returns the user for a valid (not revoked, not expired) session and slides its expiry forward. */
export async function lookupSession(token: string): Promise<AuthUser | null> {
  const hash = hashToken(token);
  const res = await query<AuthUser>(
    `UPDATE sessions s SET expires_at = $2
       FROM users u
      WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.id = s.user_id
      RETURNING u.id, u.email, u.name`,
    [hash, new Date(Date.now() + ttlMs())],
  );
  return res.rows[0] ?? null;
}

export async function revokeSession(token: string): Promise<void> {
  await query('UPDATE sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL', [hashToken(token)]);
}

/** Housekeeping: remove expired and long-revoked sessions, old login attempts and expired OAuth states. */
export async function cleanupAuthTables(): Promise<void> {
  await query(`DELETE FROM sessions WHERE expires_at < now() OR revoked_at < now() - interval '7 days'`);
  await query(`DELETE FROM login_attempts WHERE attempted_at < now() - interval '1 day'`);
  await query(`DELETE FROM oauth_states WHERE expires_at < now()`);
}
