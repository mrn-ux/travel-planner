import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import { clearToken, clearTripId, clearTripKey, getToken, getTripKey, setToken, type SessionUser } from './session';

export interface Preferences {
  preferredCurrency: string;
  defaultTransport: string | null;
  defaultAccommodation: string | null;
}

interface AuthValue {
  user: SessionUser | null;
  preferences: Preferences | null;
  /** 'loading' while a stored session is being checked with the API. */
  status: 'loading' | 'ready';
  login(email: string, password: string): Promise<void>;
  signup(name: string, email: string, password: string): Promise<void>;
  /** Exchange the one-time code from Google sign-in. Returns the saved destination, if any. */
  completeExchange(code: string): Promise<string | null>;
  logout(): Promise<void>;
  savePreferences(prefs: Preferences): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

interface SessionResponse {
  token: string;
  user: SessionUser;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready'>(getToken() ? 'loading' : 'ready');

  const loadMe = useCallback(async () => {
    const me = await api<{ user: SessionUser; preferences: Preferences }>('/auth/me', {}, { redirectOn401: false });
    setUser(me.user);
    setPreferences(me.preferences);
  }, []);

  // A stored token is checked once on start-up; an invalid one is discarded.
  useEffect(() => {
    if (!getToken()) return;
    loadMe()
      .catch(() => clearToken())
      .finally(() => setStatus('ready'));
  }, [loadMe]);

  const establish = useCallback(
    async (res: SessionResponse) => {
      setToken(res.token);
      clearTripKey(); // the draft trip, if any, was handed to this account by the server
      setUser(res.user);
      await loadMe().catch(() => undefined);
    },
    [loadMe],
  );

  const value = useMemo<AuthValue>(
    () => ({
      user,
      preferences,
      status,
      async login(email, password) {
        const res = await api<SessionResponse>(
          '/auth/login',
          { method: 'POST', body: JSON.stringify({ email, password, tripKey: getTripKey() ?? undefined }) },
          { redirectOn401: false },
        );
        await establish(res);
      },
      async signup(name, email, password) {
        const res = await api<SessionResponse>(
          '/auth/signup',
          { method: 'POST', body: JSON.stringify({ name, email, password, tripKey: getTripKey() ?? undefined }) },
          { redirectOn401: false },
        );
        await establish(res);
      },
      async completeExchange(code) {
        const res = await api<SessionResponse & { returnTo: string | null }>(
          '/auth/exchange',
          { method: 'POST', body: JSON.stringify({ code }) },
          { redirectOn401: false },
        );
        await establish(res);
        return res.returnTo;
      },
      async logout() {
        try {
          await api('/auth/logout', { method: 'POST' }, { redirectOn401: false });
        } catch {
          /* the session is cleared locally either way */
        }
        clearToken();
        clearTripId(); // the next visitor on this browser starts a fresh trip
        clearTripKey();
        setUser(null);
        setPreferences(null);
      },
      async savePreferences(prefs) {
        const res = await api<{ preferences: Preferences }>('/auth/preferences', {
          method: 'PUT',
          body: JSON.stringify(prefs),
        });
        setPreferences(res.preferences);
      },
    }),
    [user, preferences, status, establish],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
