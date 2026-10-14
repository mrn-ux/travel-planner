import type { ApiErrorBody } from './types';
import { clearToken, getToken, getTripKey, saveReturnTo } from './session';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** Per-field validation messages from a 400 or 409, keyed by field name. */
    public readonly fields?: Record<string, string>,
    /** The full error body, for extra fields such as the stored userMessage after an assistant failure. */
    public readonly body?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiOptions {
  /**
   * When true (default) any 401 clears the stored token, remembers where the user was and sends them to
   * /login. Login and sign-up pass false so their own 401 message ("Incorrect email or password") is shown.
   */
  redirectOn401?: boolean;
}

/** Fetch from the API on this origin. Adds the session token and the anonymous trip key when present. */
export async function api<T>(path: string, init: RequestInit = {}, options: ApiOptions = {}): Promise<T> {
  const { redirectOn401 = true } = options;
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const key = getTripKey();
  if (key) headers.set('X-Trip-Key', key);

  let res: Response;
  try {
    res = await fetch(`/api${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'Could not reach Faro. Check your connection and try again.');
  }

  if (res.status === 401 && redirectOn401) {
    clearToken();
    saveReturnTo(window.location.pathname + window.location.search);
    if (window.location.pathname !== '/login') window.location.assign('/login');
    throw new ApiError(401, 'Please log in to continue.');
  }

  if (!res.ok) {
    let message = 'Something went wrong. Please try again.';
    let fields: Record<string, string> | undefined;
    let errorBody: Record<string, unknown> | undefined;
    try {
      const body = (await res.json()) as Partial<ApiErrorBody> & { fields?: Record<string, string> };
      if (typeof body.error === 'string' && body.error.length > 0) message = body.error;
      if (body.fields && typeof body.fields === 'object') fields = body.fields;
      errorBody = body as Record<string, unknown>;
    } catch {
      /* keep the default message */
    }
    throw new ApiError(res.status, message, fields, errorBody);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
