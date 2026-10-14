// Browser-side session storage. Every access is wrapped in try/catch: storage can be blocked or empty
// (private windows, cleared data) and the app must still work without it.

const TOKEN_KEY = 'faro.token';
const RETURN_KEY = 'faro.returnTo';
const TRIP_KEY = 'faro.tripKey';
const TRIP_ID = 'faro.tripId';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage unavailable: the session lasts until the page is closed */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: nothing to clear */
  }
}

/** The anonymous key of the visitor's draft trip (plan 003), sent on sign-in so the draft is kept. */
export function getTripKey(): string | null {
  try {
    return localStorage.getItem(TRIP_KEY);
  } catch {
    return null;
  }
}

export function setTripKey(key: string): void {
  try {
    localStorage.setItem(TRIP_KEY, key);
  } catch {
    /* storage unavailable: the draft cannot be recovered after a reload */
  }
}

/** Forget the anonymous key once the draft belongs to an account. */
export function clearTripKey(): void {
  try {
    localStorage.removeItem(TRIP_KEY);
  } catch {
    /* ignore */
  }
}

/** The trip the home screen is working on. */
export function getTripId(): string | null {
  try {
    return localStorage.getItem(TRIP_ID);
  } catch {
    return null;
  }
}

export function setTripId(id: string): void {
  try {
    localStorage.setItem(TRIP_ID, id);
  } catch {
    /* ignore */
  }
}

export function clearTripId(): void {
  try {
    localStorage.removeItem(TRIP_ID);
  } catch {
    /* ignore */
  }
}

/** True for an internal path; anything else (another site, protocol-relative, backslashes) is refused. */
export function isInternalPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('\\');
}

/** Remember where to go after login. Only internal paths are accepted. */
export function saveReturnTo(path: string): void {
  if (!isInternalPath(path) || path === '/login') return;
  try {
    sessionStorage.setItem(RETURN_KEY, path);
  } catch {
    /* storage unavailable: the user lands on the home screen after login */
  }
}

/** Read the saved destination without clearing it (used when leaving for Google). */
export function peekReturnTo(): string | null {
  try {
    const v = sessionStorage.getItem(RETURN_KEY);
    return v && isInternalPath(v) ? v : null;
  } catch {
    return null;
  }
}

/** Read and clear the saved destination. */
export function popReturnTo(): string | null {
  const v = peekReturnTo();
  try {
    sessionStorage.removeItem(RETURN_KEY);
  } catch {
    /* ignore */
  }
  return v;
}
