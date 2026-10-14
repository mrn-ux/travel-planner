import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AsyncBoundary } from '../../components/AsyncBoundary';
import { SkeletonCard } from '../../components/Skeleton';
import { Button } from '../../components/ds/Button';
import { ApiError } from '../../lib/api';
import { listMyTrips, type TripCardData } from '../../lib/myTrips';
import { PageHero } from '../../components/PageHero';
import { TripCard } from './TripCard';

/** /trips: one card per saved trip, three per row on desktop and one on mobile, newest first. */
export default function MyTripsPage() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<TripCardData[] | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [error, setError] = useState('We could not load your trips.');

  const load = useCallback(async () => {
    setState('loading');
    try {
      const list = await listMyTrips();
      setTrips(list);
      setState(list.length === 0 ? 'empty' : 'ready');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We could not load your trips.');
      setState('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <PageHero title="Your adventures" subtitle="Every journey you have dreamed up, safe in one place and ready when you are." />
      <div className="flex flex-col gap-1">
        <h1 className="m-0 font-display text-xl font-semibold text-text">My trips</h1>
        <p className="m-0 font-sans text-sm font-medium text-text">Pick up where you left off, or start something new.</p>
      </div>
      <AsyncBoundary
        state={state}
        emptyMessage="Your travel story starts here. Plan your first trip and it will wait for you in this space."
        errorMessage={error}
        onRetry={() => void load()}
        loading={
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">{trips?.map((t) => <TripCard key={t.tripId} trip={t} onDeleted={() => void load()} />)}</div>
      </AsyncBoundary>
      {state === 'empty' && (
        <div className="flex justify-center">
          <Button onClick={() => navigate('/')}>Plan a trip</Button>
        </div>
      )}
    </div>
  );
}
