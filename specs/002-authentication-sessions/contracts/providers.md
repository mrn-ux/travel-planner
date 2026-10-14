# Contract: IdentityProvider interface

File: `api/src/providers/identity/IdentityProvider.ts`. Selected per provider by whether its environment variables are set; no mock implementation exists.

```ts
export interface IdentityProvider {
  readonly id: 'google';
  isConfigured(): boolean;
  /** Build the provider authorisation URL (state, nonce, PKCE challenge). */
  authorizationUrl(input: { state: string; nonce: string; codeChallenge?: string }): string;
  /** Exchange the callback code and return verified claims, or throw IdentityError. */
  completeSignIn(input: { code: string; nonce: string; codeVerifier?: string }): Promise<VerifiedIdentity>;
}

export interface VerifiedIdentity {
  subject: string;        // stable provider user id
  email: string;
  emailVerified: boolean; // must be true to link or create
  name?: string;
}
```

| Implementation | Config |
|---|---|
| `GoogleIdentityProvider` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, return address `${PUBLIC_BASE_URL}/api/auth/google/callback` |

The routes use only this interface; adding another identity provider means a new implementation, not route changes.
