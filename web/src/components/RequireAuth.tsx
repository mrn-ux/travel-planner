import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { saveReturnTo } from '../lib/session';
import { AsyncBoundary } from './AsyncBoundary';

/** The whole application requires a session. Without one: remember where the user was and go to /login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <AsyncBoundary state="loading" />;
  if (!user) {
    saveReturnTo(location.pathname + location.search);
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
