import { useCallback, useRef, useState } from 'react';
import { clearToken, getToken, getTripKey, saveReturnTo } from './session';

/** Fetch the plan PDF (a plain link cannot send the session header) and save it through an object URL. Throws a readable message. */
async function fetchAndSave(tripId: string): Promise<void> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const key = getTripKey();
  if (key) headers.set('X-Trip-Key', key);

  let res: Response;
  try {
    res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/plan.pdf`, { headers });
  } catch {
    throw new Error('Could not reach Faro. Check your connection and try again.');
  }
  if (res.status === 401) {
    clearToken();
    saveReturnTo(window.location.pathname + window.location.search);
    window.location.assign('/login');
    throw new Error('Please log in to continue.');
  }
  if (!res.ok) {
    let message = res.status === 404 ? 'This trip could not be found.' : 'We could not prepare your plan. Please try again.';
    try {
      const body = (await res.json()) as { error?: string };
      if (typeof body.error === 'string' && body.error) message = body.error;
    } catch {
      /* keep the default */
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const match = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = match?.[1] ?? 'faro-trip-plan.pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export type DownloadState = 'idle' | 'preparing' | 'error';

/** Download state for one trip's plan: "Preparing your plan" until done, repeated clicks ignored, an error that can be retried. */
export function usePlanDownload(tripId: string) {
  const [state, setState] = useState<DownloadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const start = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setState('preparing');
    setError(null);
    try {
      await fetchAndSave(tripId);
      setState('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not prepare your plan.');
      setState('error');
    } finally {
      busy.current = false;
    }
  }, [tripId]);

  return { state, error, start };
}
