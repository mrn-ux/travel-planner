import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getConfig } from '../../config.js';
import { fetchJson } from '../../http.js';
import { IdentityError, type IdentityProvider, type VerifiedIdentity } from './IdentityProvider.js';

// Endpoints from Google's OpenID Connect discovery document (https://accounts.google.com/.well-known/openid-configuration).
const AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

interface TokenResponse {
  id_token?: string;
}

export class GoogleIdentityProvider implements IdentityProvider {
  readonly id = 'google' as const;
  private jwks = createRemoteJWKSet(new URL(JWKS_URI));

  private creds(): { clientId: string; clientSecret: string } | null {
    const { clientId, clientSecret } = getConfig().google;
    return clientId && clientSecret ? { clientId, clientSecret } : null;
  }

  isConfigured(): boolean {
    return this.creds() !== null;
  }

  private redirectUri(): string {
    return `${getConfig().publicBaseUrl.replace(/\/$/, '')}/api/auth/google/callback`;
  }

  authorizationUrl(input: { state: string; nonce: string; codeChallenge?: string }): string {
    const creds = this.creds();
    if (!creds) throw new IdentityError('not_configured', 'Google sign-in is not configured.');
    const params = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: this.redirectUri(),
      response_type: 'code',
      scope: 'openid email profile',
      state: input.state,
      nonce: input.nonce,
      prompt: 'select_account',
    });
    if (input.codeChallenge) {
      params.set('code_challenge', input.codeChallenge);
      params.set('code_challenge_method', 'S256');
    }
    return `${AUTHORIZATION_ENDPOINT}?${params.toString()}`;
  }

  async completeSignIn(input: { code: string; nonce: string; codeVerifier?: string }): Promise<VerifiedIdentity> {
    const creds = this.creds();
    if (!creds) throw new IdentityError('not_configured', 'Google sign-in is not configured.');

    const form = new URLSearchParams({
      code: input.code,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      redirect_uri: this.redirectUri(),
      grant_type: 'authorization_code',
    });
    if (input.codeVerifier) form.set('code_verifier', input.codeVerifier);

    const res = await fetchJson<TokenResponse>(TOKEN_ENDPOINT, {
      provider: 'google',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      ttlMs: 0,
    });
    if (!res.ok || !res.body.id_token) {
      throw new IdentityError('exchange_failed', 'Google did not accept the sign-in.');
    }

    try {
      const { payload } = await jwtVerify(res.body.id_token, this.jwks, {
        issuer: ISSUERS,
        audience: creds.clientId,
      });
      if (payload['nonce'] !== input.nonce) throw new Error('nonce mismatch');
      const email = payload['email'];
      if (typeof payload.sub !== 'string' || typeof email !== 'string') throw new Error('missing claims');
      const verified = payload['email_verified'];
      return {
        subject: payload.sub,
        email,
        emailVerified: verified === true || verified === 'true',
        name: typeof payload['name'] === 'string' ? payload['name'] : undefined,
      };
    } catch {
      throw new IdentityError('invalid_token', 'Google sign-in could not be verified.');
    }
  }
}
