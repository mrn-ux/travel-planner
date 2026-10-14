import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Button } from './ds/Button';
import { AvatarMenu } from './AvatarMenu';
import { Mark } from './Mark';
import { PageBackdrop } from './PageBackdrop';
import { ThemePicker } from './ThemePicker';
import { NavItem } from './ds/NavItem';

/** "Plan a trip" covers the whole planning-through-booking flow; "My trips" is only /trips. */
function activeArea(pathname: string): 'plan' | 'trips' {
  return pathname === '/trips' || pathname.startsWith('/trips/') ? 'trips' : 'plan';
}

/**
 * The fixed top navigation bar (never a sidebar): Faro name, Plan a trip, My trips, avatar menu.
 * It wraps every route except /login and never changes the page flow.
 */
/** Where Back goes when there is no earlier page in this tab (a bookmarked or reloaded page). */
function fallbackFor(pathname: string): string {
  if (pathname.startsWith('/hotels/') || pathname.startsWith('/trip/')) return '/search';
  return '/';
}

export function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const area = activeArea(location.pathname);
  return (
    <div className="min-h-screen font-sans text-text">
      <PageBackdrop />
      <header className="fixed inset-x-0 top-0 z-menu flex h-nav items-center gap-2 border-b border-border bg-surface/90 px-4 shadow-raised backdrop-blur md:gap-8 md:px-8">
        <Link to="/" className="flex items-center gap-2 text-text no-underline" aria-label="Faro home">
          <Mark />
          <span className="font-display text-lg font-semibold">Faro</span>
        </Link>
        <nav className="flex gap-2" aria-label="Main">
          <NavItem to="/" active={area === 'plan'}>
            Plan a trip
          </NavItem>
          <NavItem to="/trips" active={area === 'trips'}>
            My trips
          </NavItem>
        </nav>
        <div className="ml-auto flex items-center gap-4">
          <ThemePicker />
          <AvatarMenu />
        </div>
      </header>
      <main className="px-4 pb-4 pt-nav md:px-8 md:pb-8">
        <div className="pt-4 md:pt-8">
          {location.pathname !== '/' && (
            <div className="mb-4">
              <Button
                variant="ghost"
                onClick={() => {
                  // react-router keeps the position in this tab's history in state.idx: above 0 there is a page to go back to.
                  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
                  if (idx > 0) navigate(-1);
                  else navigate(fallbackFor(location.pathname), { replace: true });
                }}
              >
                &larr; Back
              </Button>
            </div>
          )}
          {/* Every page except Plan a trip sits on a near-solid panel so text never fights the background photo. */}
          <div className={location.pathname === '/' ? '' : 'rounded-lg bg-surface p-4 shadow-lift md:p-6'}>
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
