/**
 * Sign-in identity provider (one real implementation per provider, enabled when its configuration is set).
 * Routes depend only on this interface, so adding a provider never changes the routes.
 */
export interface IdentityProvider {
  readonly id: 'google';
  isConfigured(): boolean;
  /** Build the provider's authorisation URL (state, nonce, PKCE challenge). */
  authorizationUrl(input: { state: string; nonce: string; codeChallenge?: string }): string;
  /** Exchange the callback code and return verified claims, or throw IdentityError. */
  completeSignIn(input: { code: string; nonce: string; codeVerifier?: string }): Promise<VerifiedIdentity>;
}

export interface VerifiedIdentity {
  /** Stable provider user id. */
  subject: string;
  email: string;
  /** Must be true to link to an existing account or create one. */
  emailVerified: boolean;
  name?: string;
}

export class IdentityError extends Error {
  constructor(
    public readonly code: 'not_configured' | 'exchange_failed' | 'invalid_token',
    message: string,
  ) {
    super(message);
    this.name = 'IdentityError';
  }
}
