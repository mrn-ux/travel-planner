import { PageBackdrop } from '../../components/PageBackdrop';
import { ThemePicker } from '../../components/ThemePicker';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AsyncBoundary } from '../../components/AsyncBoundary';
import { Mark } from '../../components/Mark';
import { Button } from '../../components/ds/Button';
import { Input } from '../../components/ds/Input';
import { ApiError, api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { getTripKey, peekReturnTo, popReturnTo } from '../../lib/session';

const SOCIAL_ERRORS: Record<string, string> = {
  cancelled: 'Google sign-in was cancelled.',
  expired: 'That sign-in attempt expired. Please try again.',
  unverified_email: 'Your Google email address is not verified, so it cannot be used to sign in.',
  not_configured: 'Google sign-in is not configured.',
  failed: 'Google sign-in failed. Please try again.',
};

type Fields = Partial<Record<'name' | 'email' | 'password' | 'confirm', string>>;

/** /login: log in and sign up in one card (docs/UI-SPEC.md 2.2). The one screen without the navigation bar. */
export default function LoginPage() {
  const { user, status, login, signup } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Fields>({});
  const [formError, setFormError] = useState<string | null>(
    () => SOCIAL_ERRORS[params.get('error') ?? ''] ?? null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [googleReady, setGoogleReady] = useState<boolean | null>(null);
  // While our own submit is in flight we navigate to the saved destination ourselves; don't also bounce to '/'.
  const authing = useRef(false);

  useEffect(() => {
    api<{ google: boolean }>('/auth/providers', {}, { redirectOn401: false })
      .then((p) => setGoogleReady(p.google))
      .catch(() => setGoogleReady(false));
  }, []);

  if (status === 'loading') return <AsyncBoundary state="loading" />;
  if (user && !authing.current) return <Navigate to="/" replace />;

  const switchMode = (next: 'login' | 'signup') => {
    setMode(next);
    setFieldErrors({});
    setFormError(null);
    setPassword('');
    setConfirm('');
  };

  const validateSignup = (): Fields => {
    const errs: Fields = {};
    if (!name.trim()) errs.name = 'Enter your name.';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = 'Enter a valid email address.';
    if (password.length < 8) errs.password = 'Password must be at least 8 characters.';
    if (confirm !== password) errs.confirm = 'Passwords do not match.';
    return errs;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);
    if (mode === 'signup') {
      const errs = validateSignup();
      setFieldErrors(errs);
      if (Object.keys(errs).length > 0) return;
    } else {
      setFieldErrors({});
    }

    setSubmitting(true);
    authing.current = true;
    try {
      if (mode === 'login') await login(email.trim(), password);
      else await signup(name.trim(), email.trim(), password);
      navigate(popReturnTo() ?? '/', { replace: true });
    } catch (err) {
      authing.current = false;
      if (err instanceof ApiError) {
        setPassword('');
        setConfirm('');
        if (err.fields) {
          setFieldErrors(err.fields as Fields);
          if (err.status === 409) setFormError(null);
          else if (!err.fields['email'] && !err.fields['password'] && !err.fields['name']) setFormError(err.message);
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const startGoogle = () => {
    const q = new URLSearchParams();
    const returnTo = peekReturnTo();
    if (returnTo) q.set('returnTo', returnTo);
    const tripKey = getTripKey();
    if (tripKey) q.set('tripKey', tripKey);
    window.location.assign(`/api/auth/google/start${q.size > 0 ? `?${q.toString()}` : ''}`);
  };

  const isSignup = mode === 'signup';

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <PageBackdrop bold />
      <div className="absolute right-4 top-4">
        <ThemePicker />
      </div>
      <div className="flex w-full max-w-login-wide flex-col items-center gap-8 md:flex-row md:justify-between md:gap-16">
        <section className="flex flex-col gap-4 text-white drop-shadow-lg md:max-w-modal">
          <div className="flex items-center gap-2">
            <span className="flex size-avatar items-center justify-center rounded-full bg-white">
              <Mark />
            </span>
            <span className="font-display text-2xl font-semibold text-photo-sun">Faro</span>
          </div>
          <h1 className="m-0 font-display text-3xl font-semibold text-photo-sun">Your next adventure starts here</h1>
          <div className="h-1 w-12 rounded-full bg-photo-coral" aria-hidden="true" />
          <p className="m-0 font-sans text-base text-white">
            Dream it, plan it, book it. Faro turns a spark of an idea into a trip you cannot wait to take, with real hotels, honest prices, hidden-gem places and a day-by-day plan that fits your budget.
          </p>
          <ul className="m-0 flex list-none flex-col items-start gap-2 p-0 font-sans text-sm">
            <li className="rounded-full border border-photo-sky/70 bg-photo-sky/20 px-4 py-2 font-semibold text-white shadow-lift backdrop-blur">&#10022; Wake up somewhere wonderful: hotels with live prices and the rooms you want</li>
            <li className="rounded-full border border-photo-mint/70 bg-photo-mint/20 px-4 py-2 font-semibold text-white shadow-lift backdrop-blur">&#10022; Find the smartest way there, flights and trains side by side</li>
            <li className="rounded-full border border-photo-coral/70 bg-photo-coral/20 px-4 py-2 font-semibold text-white shadow-lift backdrop-blur">&#10022; Discover places worth the trip, with photos, hours and fees</li>
            <li className="rounded-full border border-photo-lilac/70 bg-photo-lilac/20 px-4 py-2 font-semibold text-white shadow-lift backdrop-blur">&#10022; See every day mapped out and every cost counted</li>
          </ul>
          <p className="m-0 font-sans text-xs font-bold text-photo-sun">Test mode: bookings here are sandbox bookings, no real money moves.</p>
        </section>
      <form
        onSubmit={onSubmit}
        noValidate
        className="flex w-full max-w-login flex-col gap-4 rounded-lg border border-border bg-surface/95 p-8 font-sans shadow-lift backdrop-blur md:shrink-0"
      >
        <div className="mb-2 flex flex-col gap-1">
          <h2 className="m-0 font-display text-xl font-semibold text-text">{isSignup ? 'Create your account' : 'Welcome back'}</h2>
          <span className="text-sm text-text-secondary">{isSignup ? 'Plan, compare and book your next trip.' : 'Log in to continue planning.'}</span>
        </div>

        {isSignup && <Input label="Name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} error={fieldErrors.name} />}
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
        />
        {isSignup && (
          <Input
            label="Confirm password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={fieldErrors.confirm}
          />
        )}

        <Button type="submit" fullWidth disabled={submitting}>
          {submitting ? 'Please wait...' : isSignup ? 'Create account' : 'Log in'}
        </Button>

        <div className="flex items-center gap-3 text-sm text-text-muted" role="separator">
          <div className="h-px flex-1 bg-border" />
          or
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button variant="secondary" fullWidth disabled={googleReady !== true} onClick={startGoogle}>
          Continue with Google
        </Button>
        {googleReady === false && (
          <div className="-mt-2 text-center text-xs text-text-muted">Google sign-in is not configured.</div>
        )}

        <div className="min-h-error text-center text-sm text-danger" role="alert" aria-live="polite">
          {formError}
        </div>

        <div className="text-center text-sm text-text-secondary">
          {isSignup ? (
            <button type="button" className="font-medium text-accent hover:text-accent-hover" onClick={() => switchMode('login')}>
              Already have an account? Log in
            </button>
          ) : (
            <>
              New here?{' '}
              <button type="button" className="font-medium text-accent hover:text-accent-hover" onClick={() => switchMode('signup')}>
                Create account
              </button>
            </>
          )}
        </div>
      </form>
      </div>
    </div>
  );
}
