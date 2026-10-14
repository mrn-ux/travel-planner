import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BACKDROP_EVENT, backdropNames, photoFor, type DestinationPhoto } from '../lib/destinationPhoto';

// The login page always shows Ha Long Bay (Wikipedia lead photo, free licence).
const LOGIN_PLACE = ['Ha Long Bay'];

/**
 * A full-page background photo (Wikipedia, free licence) behind everything, softened so text stays easy to read. Elsewhere than the login
 * page it shows the country the traveler chose (its city first, then the country) and changes as soon as the destination changes.
 * `bold` is for the login page, where the photo fills the screen.
 */
export function PageBackdrop({ bold = false }: { bold?: boolean }) {
  // The Plan a trip page (/) shows the photo more clearly: its form and chat sit on their own panels.
  const home = useLocation().pathname === '/';
  const initial = useMemo(() => (bold ? LOGIN_PLACE : backdropNames()), [bold]);
  const [names, setNames] = useState<string[]>(initial);
  const [photo, setPhoto] = useState<DestinationPhoto | null>(null);

  useEffect(() => {
    if (bold) return;
    const onChange = () => setNames(backdropNames());
    window.addEventListener(BACKDROP_EVENT, onChange);
    return () => window.removeEventListener(BACKDROP_EVENT, onChange);
  }, [bold]);

  const key = names.join('|');
  useEffect(() => {
    let alive = true;
    void (async () => {
      for (const name of names) {
        const p = await photoFor(name);
        if (p) {
          if (alive) setPhoto(p);
          return;
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const url = photo?.url;
  if (!url) return null;
  return (
    <>
      <img
        key={url}
        src={url}
        alt=""
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 -z-10 size-full object-cover transition-opacity duration-700 ${bold ? 'opacity-100' : 'opacity-100'}`}
      />
      <div
        className={`pointer-events-none fixed inset-0 -z-10 ${bold ? 'bg-gradient-to-r from-text/75 via-text/35 to-text/10' : 'bg-bg/95 backdrop-blur-sm'}`}
        aria-hidden="true"
      />
    </>
  );
}
