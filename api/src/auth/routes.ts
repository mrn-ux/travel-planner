import { createHash, randomBytes } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { AppError } from '../errors.js';
import { IdentityError } from '../providers/identity/IdentityProvider.js';
import { GoogleIdentityProvider } from '../providers/identity/GoogleIdentityProvider.js';
import {
  createPasswordUser,
  findPasswordAccount,
  getPreferences,
  normaliseEmail,
  savePreferences,
  signInWithIdentity,
} from './accounts.js';
import { requireUser } from './middleware.js';
import { validatePassword, verifyAgainstDummy, verifyPassword } from './passwords.js';
import { createSession, revokeSession } from './sessions.js';
import { isThrottled, recordAttempt } from './throttle.js';
import { claimDraftTrip } from './tripHandover.js';

const google = new GoogleIdentityProvider();

const STATE_TTL_MS = 10 * 60 * 1000;
const EXCHANGE_TTL_MS = 2 * 60 * 1000;

const emailSchema = z.string().trim().max(254).email('Enter a valid email address.');
const tripKeySchema = z.string().max(200).optional();

const signupSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(100),
  email: emailSchema,
  password: z.string().superRefine((value, ctx) => {
    const problem = validatePassword(value);
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
  }),
  tripKey: tripKeySchema,
});
const loginSchema = z.object({ email: z.string().trim().max(254), password: z.string().max(1000), tripKey: tripKeySchema });
const preferencesSchema = z.object({
  preferredCurrency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Use a three-letter currency code.'),
  defaultTransport: z.string().trim().max(40).nullable().optional(),
  defaultAccommodation: z.string().trim().max(40).nullable().optional(),
});

function parse<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!(key in fields)) fields[key] = issue.message;
  }
  throw new AppError(400, 'Please correct the highlighted fields.', { fields });
}

/** Only internal paths are ever used as a post-login destination. */
export function safeReturnTo(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (value.length > 500 || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  return value;
}

function clientIp(req: Request): string | undefined {
  return req.ip ?? undefined;
}

export const authRouter = Router();

authRouter.post('/signup', async (req, res, next) => {
  try {
    const body = parse(signupSchema, req.body);
    const user = await createPasswordUser(body.name, normaliseEmail(body.email), body.password);
    await claimDraftTrip(body.tripKey, user.id);
    const { token } = await createSession(user.id);
    res.status(201).json({ token, user });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const body = parse(loginSchema, req.body);
    const emailLower = normaliseEmail(body.email);
    const ip = clientIp(req);

    if (await isThrottled(emailLower, ip)) {
      throw new AppError(429, 'Too many attempts. Try again in a few minutes.');
    }

    const account = await findPasswordAccount(emailLower);
    let ok = false;
    if (account) ok = await verifyPassword(body.password, account.passwordHash);
    else await verifyAgainstDummy(body.password);

    await recordAttempt(emailLower, ip, ok);
    if (!account || !ok) throw new AppError(401, 'Incorrect email or password');

    await claimDraftTrip(body.tripKey, account.id);
    const { token } = await createSession(account.id);
    res.json({ token, user: { id: account.id, email: account.email, name: account.name } });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', requireUser, async (req, res, next) => {
  try {
    if (req.sessionToken) await revokeSession(req.sessionToken);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireUser, async (req, res, next) => {
  try {
    const user = req.user as NonNullable<Request['user']>;
    res.json({ user, preferences: await getPreferences(user.id) });
  } catch (err) {
    next(err);
  }
});

authRouter.put('/preferences', requireUser, async (req, res, next) => {
  try {
    const user = req.user as NonNullable<Request['user']>;
    const body = parse(preferencesSchema, req.body);
    const preferences = await savePreferences(user.id, {
      preferredCurrency: body.preferredCurrency,
      defaultTransport: body.defaultTransport || null,
      defaultAccommodation: body.defaultAccommodation || null,
    });
    res.json({ preferences });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/providers', (_req, res) => {
  res.json({ google: google.isConfigured() });
});

function loginError(res: Response, code: string): void {
  res.redirect(302, `/login?error=${encodeURIComponent(code)}`);
}

authRouter.get('/google/start', async (req, res, next) => {
  try {
    if (!google.isConfigured()) return loginError(res, 'not_configured');
    const state = randomBytes(24).toString('base64url');
    const nonce = randomBytes(24).toString('base64url');
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const tripKey = typeof req.query['tripKey'] === 'string' ? req.query['tripKey'].slice(0, 200) : null;

    await query(
      `INSERT INTO oauth_states (state, provider, nonce, code_verifier, return_to, trip_key, expires_at)
       VALUES ($1, 'google', $2, $3, $4, $5, $6)`,
      [state, nonce, verifier, safeReturnTo(req.query['returnTo']), tripKey, new Date(Date.now() + STATE_TTL_MS)],
    );
    res.redirect(302, google.authorizationUrl({ state, nonce, codeChallenge: challenge }));
  } catch (err) {
    next(err);
  }
});

authRouter.get('/google/callback', async (req, res) => {
  try {
    const state = typeof req.query['state'] === 'string' ? req.query['state'] : '';
    const code = typeof req.query['code'] === 'string' ? req.query['code'] : '';

    // The state row is single-use: it is deleted as it is read.
    const found = await query<{ nonce: string; code_verifier: string | null; return_to: string | null; trip_key: string | null }>(
      `DELETE FROM oauth_states WHERE state = $1 AND provider = 'google' AND user_id IS NULL AND expires_at > now()
       RETURNING nonce, code_verifier, return_to, trip_key`,
      [state],
    );
    const row = found.rows[0];
    if (!row) return loginError(res, 'expired');
    if (req.query['error'] || !code) return loginError(res, 'cancelled');

    const identity = await google.completeSignIn({
      code,
      nonce: row.nonce,
      codeVerifier: row.code_verifier ?? undefined,
    });
    const user = await signInWithIdentity('google', identity);
    await claimDraftTrip(row.trip_key ?? undefined, user.id);

    // The session token never travels in a URL: hand the browser a short-lived one-time code instead.
    const exchange = randomBytes(24).toString('base64url');
    await query(
      `INSERT INTO oauth_states (state, provider, nonce, return_to, user_id, expires_at)
       VALUES ($1, 'google', '', $2, $3, $4)`,
      [exchange, row.return_to, user.id, new Date(Date.now() + EXCHANGE_TTL_MS)],
    );
    res.redirect(302, `/auth/complete?code=${encodeURIComponent(exchange)}`);
  } catch (err) {
    if (err instanceof AppError && err.status === 403) return loginError(res, 'unverified_email');
    if (err instanceof IdentityError) return loginError(res, err.code === 'not_configured' ? 'not_configured' : 'failed');
    console.error('Google callback failed:', err instanceof Error ? err.message : err);
    loginError(res, 'failed');
  }
});

authRouter.post('/exchange', async (req, res, next) => {
  try {
    const { code } = parse(z.object({ code: z.string().min(1).max(200) }), req.body);
    const found = await query<{ user_id: string; return_to: string | null }>(
      `DELETE FROM oauth_states WHERE state = $1 AND user_id IS NOT NULL AND expires_at > now()
       RETURNING user_id, return_to`,
      [code],
    );
    const row = found.rows[0];
    if (!row) throw new AppError(400, 'This sign-in link has expired. Please try again.');
    const userRes = await query<{ id: string; email: string; name: string }>(
      'SELECT id, email, name FROM users WHERE id = $1',
      [row.user_id],
    );
    const user = userRes.rows[0];
    if (!user) throw new AppError(400, 'This sign-in link has expired. Please try again.');
    const { token } = await createSession(user.id);
    res.json({ token, user, returnTo: row.return_to });
  } catch (err) {
    next(err);
  }
});
