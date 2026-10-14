import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AsyncBoundary } from '../../components/AsyncBoundary';
import { isInternalPath, popReturnTo } from '../../lib/session';
import { useAuth } from '../../lib/auth';

/**
 * Landing point after Google sign-in: exchanges the one-time code for a session, then continues to the
 * screen the user originally wanted. A transient handler, not one of the application's screens.
 */
export default function AuthCompletePage() {
  const { completeExchange } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // the code is single-use: never exchange it twice
    started.current = true;
    const code = params.get('code');
    if (!code) {
      navigate('/login?error=failed', { replace: true });
      return;
    }
    completeExchange(code)
      .then((returnTo) => {
        const saved = popReturnTo();
        const target = returnTo && isInternalPath(returnTo) ? returnTo : saved;
        navigate(target ?? '/', { replace: true });
      })
      .catch(() => setFailed(true));
  }, [completeExchange, navigate, params]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="w-full max-w-login">
        <AsyncBoundary
          state={failed ? 'error' : 'loading'}
          errorMessage="This sign-in link has expired. Please try again."
          onRetry={() => navigate('/login', { replace: true })}
        />
      </div>
    </div>
  );
}
