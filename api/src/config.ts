// Reads environment variables once. Missing required variables stop the API with a message naming them.

const REQUIRED = [
  'OLLAMA_BASE_URL',
  'OLLAMA_MODEL',
  'OLLAMA_EMBED_MODEL',
  'LITEAPI_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_PUBLISHABLE_KEY',
  'DATA_USER_AGENT',
] as const;

type RequiredName = (typeof REQUIRED)[number];

function read(name: string): string | undefined {
  const v = process.env[name];
  return v === undefined || v.trim() === '' ? undefined : v.trim();
}

function loadConfig() {
  const missing = REQUIRED.filter((n) => read(n) === undefined);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. ` +
        'Set them in the local .env file (see .env.example).',
    );
  }
  const req = (n: RequiredName): string => read(n) as string;
  const num = (name: string, fallback: number): number => {
    const raw = read(name);
    if (raw === undefined) return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n)) throw new Error(`Environment variable ${name} must be a number, got "${raw}".`);
    return n;
  };

  // A provider setting must name an implementation that exists: no silent fallback.
  const oneOf = (name: string, fallback: string, allowed: string[]): string => {
    const v = (read(name) ?? fallback).toLowerCase();
    if (!allowed.includes(v)) throw new Error(`Unknown ${name} "${v}". Supported: ${allowed.join(', ')}.`);
    return v;
  };

  return {
    port: num('PORT', 3000),
    databaseUrl: read('DATABASE_URL') ?? 'postgres://faro:faro@postgres:5432/faro',

    ollama: {
      baseUrl: req('OLLAMA_BASE_URL'),
      model: req('OLLAMA_MODEL'),
      embedModel: req('OLLAMA_EMBED_MODEL'),
      numCtx: num('OLLAMA_NUM_CTX', 32768),
    },

    liteApiKey: req('LITEAPI_API_KEY'),
    stripe: {
      secretKey: req('STRIPE_SECRET_KEY'),
      publishableKey: req('STRIPE_PUBLISHABLE_KEY'),
    },
    dataUserAgent: req('DATA_USER_AGENT'),

    // Optional features: unset means the feature is disabled and shown as such.
    google: { clientId: read('GOOGLE_CLIENT_ID'), clientSecret: read('GOOGLE_CLIENT_SECRET') },
    // Google shows an app password in four groups separated by spaces; the spaces are not part of it.
    gmail: { user: read('GMAIL_USER'), appPassword: read('GMAIL_APP_PASSWORD')?.replace(/\s+/g, '') },
    // Duffel test-mode token for flight offers (sandbox data). Unset: flights stay estimates.
    duffelAccessToken: read('DUFFEL_ACCESS_TOKEN'),
    adminToken: read('ADMIN_TOKEN'),
    publicBaseUrl: read('PUBLIC_BASE_URL') ?? 'http://localhost:8080',

    bookTimeoutMs: num('BOOK_TIMEOUT_MS', 20000),
    sessionTtlDays: num('SESSION_TTL_DAYS', 7),
    refreshCron: read('REFRESH_CRON') ?? '0 * * * *',
    warmupDestinations: num('WARMUP_DESTINATIONS', 30),

    // ISO country of the guests, required by the hotel rates call.
    guestNationality: (read('GUEST_NATIONALITY') ?? 'US').toUpperCase(),

    providers: {
      hotel: oneOf('HOTEL_PROVIDER', 'liteapi', ['liteapi']),
      transport: oneOf('TRANSPORT_PROVIDER', 'transitous', ['transitous']),
      maps: oneOf('MAPS_PROVIDER', 'osm', ['osm']),
      payment: read('PAYMENT_PROVIDER') ?? 'stripe',
      notification: read('NOTIFICATION_PROVIDER') ?? 'gmail',
    },
  } as const;
}

export type Config = ReturnType<typeof loadConfig>;

let cached: Config | undefined;

export function getConfig(): Config {
  cached ??= loadConfig();
  return cached;
}
