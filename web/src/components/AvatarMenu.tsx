import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button } from './ds/Button';
import { Select } from './ds/Select';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'INR'];
const TRANSPORT = ['None stated', 'Flight', 'Train', 'Bus', 'Car'];
const ACCOMMODATION = ['No preference', 'Hotel', 'Villa', 'Cottage', 'Guest house', 'Apartment'];

function initials(name: string, email: string): string {
  const source = name.trim() || email.trim();
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join('') || '?'
  );
}

/**
 * Avatar button with a dropdown: Profile & preferences and Log out for a signed-in traveler, Log in for a
 * visitor. Closes on Escape or an outside click and returns focus to the avatar. Profile & preferences opens
 * a panel inside the menu (the application has no separate profile screen).
 */
export function AvatarMenu() {
  const { user, preferences, logout, savePreferences } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [currency, setCurrency] = useState('USD');
  const [transport, setTransport] = useState(TRANSPORT[0] as string);
  const [stay, setStay] = useState(ACCOMMODATION[0] as string);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const close = () => {
    setOpen(false);
    setPanel(false);
    setMessage(null);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        buttonRef.current?.focus();
      }
    };
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open]);

  const openPanel = () => {
    setCurrency(preferences?.preferredCurrency ?? 'USD');
    setTransport(preferences?.defaultTransport ?? (TRANSPORT[0] as string));
    setStay(preferences?.defaultAccommodation ?? (ACCOMMODATION[0] as string));
    setMessage(null);
    setPanel(true);
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await savePreferences({
        preferredCurrency: currency,
        defaultTransport: transport === TRANSPORT[0] ? null : transport,
        defaultAccommodation: stay === ACCOMMODATION[0] ? null : stay,
      });
      setMessage({ text: 'Preferences saved.', ok: true });
    } catch (err) {
      setMessage({ text: err instanceof ApiError ? err.message : 'Could not save your preferences.', ok: false });
    } finally {
      setSaving(false);
    }
  };

  const itemClass =
    'block w-full rounded-sm px-3 py-2 text-left text-sm text-text no-underline hover:bg-surface-muted';

  return (
    <div className="relative ml-auto">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => (open ? close() : setOpen(true))}
        className="flex size-avatar-sm items-center justify-center rounded-full bg-accent-soft text-chip font-medium text-accent md:size-avatar md:text-sm"
      >
        {user ? (
          initials(user.name, user.email)
        ) : (
          <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
        )}
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          className={`absolute right-0 top-full z-menu mt-2 rounded-md border border-border bg-surface p-1 shadow-overlay ${panel ? 'w-panel-w' : 'w-menu-w'}`}
        >
          {!user && (
            <Link to="/login" role="menuitem" className={itemClass} onClick={close}>
              Log in
            </Link>
          )}
          {user && !panel && (
            <>
              <div className="truncate px-3 py-2 text-xs text-text-muted" title={user.email}>
                {user.email}
              </div>
              <button type="button" role="menuitem" className={itemClass} onClick={openPanel}>
                Profile &amp; preferences
              </button>
              <button
                type="button"
                role="menuitem"
                className={itemClass}
                onClick={async () => {
                  close();
                  await logout();
                  navigate('/', { replace: true });
                }}
              >
                Log out
              </button>
            </>
          )}
          {user && panel && (
            <div className="flex flex-col gap-3 p-3">
              <div className="font-display text-lg font-semibold text-text">Profile &amp; preferences</div>
              <div className="text-sm text-text-secondary">
                <div className="truncate">{user.name || '—'}</div>
                <div className="truncate" title={user.email}>
                  {user.email}
                </div>
              </div>
              <Select label="Preferred currency" value={currency} options={CURRENCIES} onChange={(e) => setCurrency(e.target.value)} />
              <Select label="Default transport" value={transport} options={TRANSPORT} onChange={(e) => setTransport(e.target.value)} />
              <Select label="Default accommodation" value={stay} options={ACCOMMODATION} onChange={(e) => setStay(e.target.value)} />
              {message && (
                <div className={`text-sm ${message.ok ? 'text-confirmed' : 'text-danger'}`} role="status">
                  {message.text}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setPanel(false)}>
                  Back
                </Button>
                <Button onClick={save} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
