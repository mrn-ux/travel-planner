import type pg from 'pg';
import { getPool, query } from '../db.js';
import { AppError } from '../errors.js';
import type { VerifiedIdentity } from '../providers/identity/IdentityProvider.js';
import { hashPassword } from './passwords.js';
import type { AuthUser } from './sessions.js';

export interface Preferences {
  preferredCurrency: string;
  defaultTransport: string | null;
  defaultAccommodation: string | null;
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findPasswordAccount(
  emailLower: string,
): Promise<(AuthUser & { passwordHash: string }) | null> {
  const res = await query<AuthUser & { password_hash: string }>(
    `SELECT u.id, u.email, u.name, i.password_hash
       FROM users u JOIN auth_identities i ON i.user_id = u.id AND i.provider = 'password'
      WHERE lower(u.email) = $1`,
    [emailLower],
  );
  const row = res.rows[0];
  return row ? { id: row.id, email: row.email, name: row.name, passwordHash: row.password_hash } : null;
}

/** Creates a user and a password identity in one transaction. 409 when the email is already registered. */
export async function createPasswordUser(name: string, emailLower: string, password: string): Promise<AuthUser> {
  const hash = await hashPassword(password);
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const created = await client.query<AuthUser>(
      'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id, email, name',
      [emailLower, name],
    );
    const user = created.rows[0] as AuthUser;
    await client.query(
      `INSERT INTO auth_identities (user_id, provider, password_hash) VALUES ($1, 'password', $2)`,
      [user.id, hash],
    );
    await client.query('COMMIT');
    return user;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    if ((err as pg.DatabaseError).code === '23505') {
      throw new AppError(409, 'An account with this email already exists. Log in instead.', {
        fields: { email: 'An account with this email already exists.' },
      });
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Social sign-in. Match by (provider, subject) first; otherwise link to an existing account with the same
 * VERIFIED email; otherwise create an account. An unverified provider email is refused.
 */
export async function signInWithIdentity(provider: 'google', identity: VerifiedIdentity): Promise<AuthUser> {
  const existing = await query<AuthUser>(
    `SELECT u.id, u.email, u.name FROM auth_identities i JOIN users u ON u.id = i.user_id
      WHERE i.provider = $1 AND i.provider_subject = $2`,
    [provider, identity.subject],
  );
  if (existing.rows[0]) return existing.rows[0];

  if (!identity.emailVerified) {
    throw new AppError(403, 'Your Google email address is not verified, so it cannot be used to sign in.');
  }
  const emailLower = normaliseEmail(identity.email);

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const found = await client.query<AuthUser>('SELECT id, email, name FROM users WHERE lower(email) = $1', [emailLower]);
    let user = found.rows[0];
    if (!user) {
      const name = identity.name?.trim() || emailLower.split('@')[0] || '';
      const created = await client.query<AuthUser>(
        'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id, email, name',
        [emailLower, name],
      );
      user = created.rows[0] as AuthUser;
    }
    await client.query(
      `INSERT INTO auth_identities (user_id, provider, provider_subject) VALUES ($1, $2, $3)`,
      [user.id, provider, identity.subject],
    );
    await client.query('COMMIT');
    return user;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function getPreferences(userId: string): Promise<Preferences> {
  const res = await query<{
    preferred_currency: string | null;
    default_transport: string | null;
    default_accommodation: string | null;
    user_currency: string;
  }>(
    `SELECT p.preferred_currency, p.default_transport, p.default_accommodation, u.preferred_currency AS user_currency
       FROM users u LEFT JOIN user_preferences p ON p.user_id = u.id WHERE u.id = $1`,
    [userId],
  );
  const row = res.rows[0];
  return {
    preferredCurrency: (row?.preferred_currency ?? row?.user_currency ?? 'USD').trim(),
    defaultTransport: row?.default_transport ?? null,
    defaultAccommodation: row?.default_accommodation ?? null,
  };
}

export async function savePreferences(userId: string, prefs: Preferences): Promise<Preferences> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO user_preferences (user_id, preferred_currency, default_transport, default_accommodation, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (user_id) DO UPDATE
         SET preferred_currency = EXCLUDED.preferred_currency, default_transport = EXCLUDED.default_transport,
             default_accommodation = EXCLUDED.default_accommodation, updated_at = now()`,
      [userId, prefs.preferredCurrency, prefs.defaultTransport, prefs.defaultAccommodation],
    );
    await client.query('UPDATE users SET preferred_currency = $2 WHERE id = $1', [userId, prefs.preferredCurrency]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
  return getPreferences(userId);
}
