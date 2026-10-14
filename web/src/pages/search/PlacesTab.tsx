import { useCallback, useEffect, useState } from 'react';
import { AsyncBoundary } from '../../components/AsyncBoundary';
import { SkeletonRows } from '../../components/Skeleton';
import { ApiError } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { Button } from '../../components/ds/Button';
import { addPlace, addPlaces, getPlacePhoto, getPlaces, removePlace, type PlaceRow, type PlacesResult } from '../../lib/places';
import type { Trip } from '../../lib/trip';

const entryText = (p: PlaceRow): string => (p.entry.kind === 'free' ? 'Free entry' : p.entry.kind === 'paid' ? (p.entry.charge ? `Paid entry (${p.entry.charge})` : 'Paid entry') : 'Entry not stated');

/** Places to visit in the trip's chosen city, from OpenStreetMap. Opening hours and entry fees are shown only when the map data states them. */
/** The photo on the right of a card. A place with none from the map data gets one looked up when its card appears. */
function PlacePhoto({ place }: { place: PlaceRow }) {
  const [photo, setPhoto] = useState(place.photo);
  const [looking, setLooking] = useState(place.photo === null);
  useEffect(() => {
    setPhoto(place.photo);
    if (place.photo !== null) return;
    let alive = true;
    setLooking(true);
    void getPlacePhoto(place).then((p) => alive && setPhoto(p)).catch(() => undefined).finally(() => alive && setLooking(false));
    return () => {
      alive = false;
    };
  }, [place.id]);
  return photo ? (
    <img src={photo.url} alt={place.name} loading="lazy" className="h-place-h w-full shrink-0 rounded-sm bg-surface-muted object-cover md:w-place-w" />
  ) : (
    <div className="flex h-place-h w-full shrink-0 items-center justify-center rounded-sm bg-surface-muted text-xs text-text-muted md:w-place-w" aria-hidden="true">
      {looking ? 'Looking for a photo' : 'No photo'}
    </div>
  );
}

export function PlacesTab({ trip, onCount }: { trip: Trip; onCount: (n: number) => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [data, setData] = useState<PlacesResult | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('We could not load places to visit.');

  const load = useCallback(async () => {
    setState('loading');
    try {
      setData(await getPlaces(trip.id));
      setState('ready');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We could not load places to visit.');
      setState('error');
    }
  }, [trip.id, trip.destinationCity, trip.destinationCountry, trip.interests]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (p: PlaceRow) => {
    setBusyId(p.id);
    setActionError(null);
    try {
      const items = p.selected ? await removePlace(trip.id, p.id) : await addPlace(trip.id, p.id);
      const ids = new Set(items.map((i) => i.id));
      setData((d) => (d ? { ...d, items: d.items.map((x) => ({ ...x, selected: ids.has(x.id) })) } : d));
      onCount(items.length);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not update your places. Try again.');
    } finally {
      setBusyId(null);
    }
  };
  // Several places can be ticked and added together; each card's own button still adds or removes one.
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const addTicked = async () => {
    setBusyId('bulk');
    setActionError(null);
    try {
      const items = await addPlaces(trip.id, [...ticked]);
      const ids = new Set(items.map((i) => i.id));
      setData((d) => (d ? { ...d, items: d.items.map((x) => ({ ...x, selected: ids.has(x.id) })) } : d));
      onCount(items.length);
      setTicked(new Set());
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not add those places. Try again.');
    } finally {
      setBusyId(null);
    }
  };
  const tick = (id: string) =>
    setTicked((t) => {
      const next = new Set(t);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const chosenCount = data?.items.filter((i) => i.selected).length ?? 0;

  const [shown, setShown] = useState(30);
  const needsCity = state === 'ready' && data?.needsCity === true;
  const empty = state === 'ready' && data !== null && !data.needsCity && data.items.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <AsyncBoundary
        state={needsCity || empty ? 'empty' : state}
        emptyMessage={needsCity ? 'Pick a city on the first page and we will show you the places worth the trip.' : 'No places to visit were found in the map data for this city.'}
        errorMessage={error}
        onRetry={() => void load()}
        loading={
          <div className="flex flex-col gap-3">
            {!trip.destinationCity && <p className="m-0 font-sans text-sm text-text-secondary">Finding places across the whole country. The first time this can take a few minutes; after that it is quick.</p>}
            <SkeletonRows count={5} />
          </div>
        }
      >
        {data && (
          <>
            <p className="m-0 font-sans text-sm font-semibold text-text">
              Top {data.items.length} {data.items.length === 1 ? 'place' : 'places'} to visit in {data.place}
              {data.totalFound > data.items.length ? ` (best of ${data.totalFound} found)` : ''}
              {data.wholeCountry ? ': across the whole country, choose a city on the first page to see only that city' : ''}
              {trip.startDate && trip.endDate ? `, for your stay (${formatDate(trip.startDate)} to ${formatDate(trip.endDate)})` : ''}. Best-known first, and those that match your interests where you gave any.
            </p>
            <p className="m-0 font-sans text-sm text-text">
              {chosenCount === 0 ? 'Choose at least one place to visit to open your trip plan.' : `${chosenCount} ${chosenCount === 1 ? 'place' : 'places'} chosen for your trip.`}
            </p>
            {actionError && (
              <div role="alert" className="font-sans text-sm text-danger">
                {actionError}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 font-sans text-sm">
              <Button variant="secondary" onClick={() => setTicked(new Set(data.items.slice(0, shown).filter((p) => !p.selected).map((p) => p.id)))}>
                Tick all shown
              </Button>
              <Button variant="secondary" disabled={ticked.size === 0} onClick={() => setTicked(new Set())}>
                Clear ticks
              </Button>
              <Button disabled={ticked.size === 0 || busyId !== null} onClick={() => void addTicked()}>
                Add {ticked.size} ticked {ticked.size === 1 ? 'place' : 'places'} to trip
              </Button>
            </div>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {data.items.slice(0, shown).map((p) => (
                <li key={p.id} className={`flex flex-col gap-3 rounded-md border border-solid p-4 font-sans text-sm md:flex-row ${p.selected ? 'border-accent bg-accent-soft' : 'border-border bg-surface'}`}>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2 font-medium text-text">
                      {!p.selected && <input type="checkbox" checked={ticked.has(p.id)} onChange={() => tick(p.id)} aria-label={`Tick ${p.name}`} />}
                      {p.name}
                    </label>
                    <span className="flex items-center gap-2">
                      {p.selected && <span className="rounded-sm bg-accent px-2 py-1 text-xs font-medium text-white">&#10003; Chosen for your trip</span>}
                      <span className="rounded-sm bg-accent-soft px-2 py-1 text-xs text-accent">{p.kind}</span>
                    </span>
                  </div>
                  <div className="text-text-secondary">
                    {p.distanceKm !== null ? `${p.distanceKm} km from the centre · ` : ''}{entryText(p)} &middot; {p.openingHours ? `Opening hours: ${p.openingHours}` : 'Opening hours not stated'}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <Button variant={p.selected ? 'primary' : 'secondary'} disabled={busyId === p.id} onClick={() => void toggle(p)}>
                      {p.selected ? 'Chosen: remove' : 'Add to trip'}
                    </Button>
                    {p.website && (
                      <a href={p.website} target="_blank" rel="noreferrer" className="text-accent">
                        Website
                      </a>
                    )}
                    <a href={p.osmUrl} target="_blank" rel="noreferrer" className="text-accent">
                      On the map
                    </a>
                    {p.wikidataUrl && (
                      <a href={p.wikidataUrl} target="_blank" rel="noreferrer" className="text-accent">
                        Wikidata
                      </a>
                    )}
                  </div>
                  </div>
                  <PlacePhoto place={p} />
                </li>
              ))}
            </ul>
            {data.items.length > shown && (
              <div>
                <Button variant="secondary" onClick={() => setShown((n) => n + 30)}>
                  Show more places ({data.items.length - shown} more)
                </Button>
              </div>
            )}
            <p className="m-0 font-sans text-xs font-medium text-text-secondary">
              Places, hours and entry fees from <a href={data.sourceUrl} target="_blank" rel="noreferrer" className="text-accent">{data.source}</a>, {data.attribution}. Fetched {data.fetchedAt ? formatDate(data.fetchedAt.slice(0, 10)) : 'just now'}. Hours and fees are shown only where the map data states them; check before you go.
            </p>
          </>
        )}
      </AsyncBoundary>
    </div>
  );
}
