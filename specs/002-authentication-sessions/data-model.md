# Data Model: Authentication and Session Management

## Entities

- **User**: one traveler; unique email (case-insensitive), display name, preferred currency.
- **Auth identity**: a way to sign in: `password` (holds the bcrypt hash), or `google` (holds Google's stable subject id). A user may have several.
- **Session**: a signed-in period identified by the hash of an opaque token; expires after inactivity; can be revoked.
- **Login attempt**: a record used only for throttling.
- **OAuth state**: short-lived record binding a social sign-in round trip (state, nonce, PKCE verifier, return path). Also holds the one-time exchange row (state = the code, `user_id` set, 2 minutes) that hands the browser a session without the token travelling in a URL. `trip_key` is a legacy column of the superseded draft-trip hand-over (updated 2026-10-13; still accepted by the API, inert in the login-first app).
- **User preferences**: saved defaults for the signed-in user.

## Relationships and rules

- `auth_identities.user_id → users.id` (cascade delete); `(provider, provider_subject)` unique; at most one `password` identity per user.
- `sessions.user_id → users.id`; a session is valid when `revoked_at IS NULL AND expires_at > now()`.
- Email stored lower-cased and trimmed; unique index on the lower-cased value.
- Password hash is the only place a password-derived value exists; no plain text in any table or log.
- `oauth_states` rows expire after 10 minutes (exchange rows after 2 minutes) and are deleted on use; a daily sweep (`cleanupAuthTables`) also removes expired sessions, sessions revoked more than 7 days ago, `login_attempts` older than 1 day and expired `oauth_states`.
- `user_preferences` is created on first save; `users.preferred_currency` is the default until then.
- Trips, bookings and preferences elsewhere reference `users.id`; every such query includes `WHERE user_id = $authenticated`.

## State transitions

Session: created → (used: `expires_at` pushed forward) → expired or revoked. No transition back.

## DDL fragment (002)

```sql
CREATE TABLE users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email              TEXT NOT NULL,
  name               TEXT NOT NULL DEFAULT '',
  preferred_currency CHAR(3) NOT NULL DEFAULT 'USD',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

CREATE TABLE auth_identities (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL CHECK (provider IN ('password','google')),
  provider_subject TEXT,                 -- null for password
  password_hash    TEXT,                 -- bcrypt, only for provider = 'password'
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((provider = 'password' AND password_hash IS NOT NULL AND provider_subject IS NULL)
      OR (provider <> 'password' AND provider_subject IS NOT NULL AND password_hash IS NULL))
);
CREATE UNIQUE INDEX auth_identity_subject_unique ON auth_identities (provider, provider_subject)
  WHERE provider_subject IS NOT NULL;
CREATE UNIQUE INDEX auth_identity_one_password ON auth_identities (user_id) WHERE provider = 'password';

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,           -- sha256 hex of the opaque token
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE login_attempts (
  id           BIGSERIAL PRIMARY KEY,
  email_lower  TEXT NOT NULL,
  ip           TEXT,
  success      BOOLEAN NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_email_idx ON login_attempts (email_lower, attempted_at);

CREATE TABLE oauth_states (
  state         TEXT PRIMARY KEY,
  provider      TEXT NOT NULL CHECK (provider = 'google'),
  nonce         TEXT NOT NULL,
  code_verifier TEXT,
  return_to     TEXT,
  trip_key      TEXT,
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,  -- set on one-time exchange rows (state = the code)
  expires_at    TIMESTAMPTZ NOT NULL
);

CREATE TABLE user_preferences (
  user_id                  UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  preferred_currency       CHAR(3) NOT NULL DEFAULT 'USD',
  default_transport        TEXT,
  default_accommodation    TEXT,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
