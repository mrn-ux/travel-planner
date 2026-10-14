import { useEffect, useState, type ReactNode } from 'react';
import { backdropNames, photoFor, type DestinationPhoto as Photo } from '../lib/destinationPhoto';

interface PageHeroProps {
  title: string;
  subtitle?: ReactNode;
  /** Place names to find a photo for, best first (for example the city, then the country). No names: a plain colour banner. */
  photoOf?: string[];
  children?: ReactNode;
}

/**
 * The banner at the top of a page: a photo of the destination from Wikipedia (free licence, credited) under a dark wash so the white
 * title stays readable, or the theme colour when there is no photo.
 */
export function PageHero({ title, subtitle, photoOf: given = [], children }: PageHeroProps) {
  // Without place names the banner shows the country the traveler selected (or a dream destination before one is chosen).
  const photoOf = given.length > 0 ? given : backdropNames();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const key = photoOf.join('|');
  useEffect(() => {
    let alive = true;
    setPhoto(null);
    void (async () => {
      for (const name of photoOf) {
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

  return (
    <section className="relative flex min-h-banner flex-col justify-end overflow-hidden rounded-lg bg-gradient-to-br from-accent to-accent-hover p-6 shadow-lift">
      {photo && <img src={photo.url} alt="" className="absolute inset-0 size-full object-cover" />}
      <div className="absolute inset-0 bg-gradient-to-t from-text/85 via-text/40 to-text/10" aria-hidden="true" />
      <div className="relative flex flex-col gap-1 text-white drop-shadow-lg">
        <h2 className="m-0 font-display text-3xl font-semibold">{title}</h2>
        {subtitle && <div className="font-sans text-sm font-semibold text-white">{subtitle}</div>}
        {children}
      </div>
    </section>
  );
}
