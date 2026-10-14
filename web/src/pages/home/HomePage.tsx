import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AsyncBoundary } from '../../components/AsyncBoundary';
import { SkeletonCard } from '../../components/Skeleton';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import {
  clearTripId,
  createTrip,
  getLatestTrip,
  getTrip,
  getTripId,
  listMessages,
  setTripId,
  type ChatMessageData,
  type TripState,
} from '../../lib/trip';
import { PageHero } from '../../components/PageHero';
import { DREAM_DESTINATIONS } from '../../lib/destinationPhoto';
import { ChatPanel } from './ChatPanel';
import { TripForm } from './TripForm';

/** True when the trip has any saved detail or any message. */
function hasContent(state: TripState, messages: ChatMessageData[]): boolean {
  const t = state.trip;
  return (
    messages.length > 0 ||
    t.destination !== null ||
    t.recommendRequested ||
    t.startDate !== null ||
    t.endDate !== null ||
    t.dateWindowText !== null ||
    t.durationDays !== null ||
    t.adults !== null ||
    t.childrenAges.length > 0 ||
    t.budget !== null ||
    t.transportPreference !== null ||
    t.accommodationPreference !== null ||
    t.interests !== null ||
    t.specialRequirements !== null
  );
}

/**
 * Home (trip intake): the trip form on the left (360 px), the chat on the right; stacked on narrow screens
 * with the form above the chat. Both edit the same trip. Opening /?tripId=... loads that trip ("Edit in chat").
 */
export default function HomePage() {
  // Until a destination is chosen, the banner shows a beautiful dream destination (one per visit).
  const dreamPlace = useMemo(() => DREAM_DESTINATIONS[Math.floor(Math.random() * DREAM_DESTINATIONS.length)] as string, []);
  const { status, user } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [replying, setReplying] = useState(false);
  const requestedTrip = params.get('tripId');

  const [load, setLoad] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorText, setErrorText] = useState('We could not open your trip.');
  const [state, setState] = useState<TripState | null>(null);
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const started = useRef(false);

  const open = useCallback(async () => {
    setLoad('loading');
    try {
      let current: TripState | null = null;
      const id = requestedTrip ?? getTripId();
      if (id) {
        try {
          current = await getTrip(id);
        } catch (err) {
          if (!(err instanceof ApiError) || err.status !== 404) throw err;
          clearTripId(); // it no longer exists or is not ours
        }
      }
      // A fresh visit (just logged in): the form starts empty. The latest trip is reused only when it is still blank; a trip with details
      // stays saved in My trips and is opened from there.
      if (!current && user) {
        try {
          const latest = await getLatestTrip();
          if (!hasContent(latest, await listMessages(latest.trip.id))) current = latest;
        } catch (err) {
          if (!(err instanceof ApiError) || err.status !== 404) throw err;
        }
      }
      current ??= await createTrip();
      setTripId(current.trip.id);
      setState(current);
      setMessages(await listMessages(current.trip.id));
      setLoad('ready');
    } catch (err) {
      setErrorText(err instanceof ApiError ? err.message : 'We could not open your trip.');
      setLoad('error');
    }
  }, [requestedTrip, user]);

  // Open a blank trip. A signed-in traveler's previous trip stays saved; a visitor's draft is discarded.
  const startNewTrip = useCallback(async () => {
    const fresh = await createTrip(); // stores the new trip id (and a new anonymous key for a visitor)
    setState(fresh);
    setMessages([]);
    navigate('/', { replace: true }); // drop any ?tripId= so the new trip is the one shown
  }, [navigate]);

  // Wait until the stored session has been checked, then open the trip once (React may run effects twice).
  useEffect(() => {
    if (status !== 'ready' || started.current) return;
    started.current = true;
    void open();
  }, [status, open]);

  const skeleton = (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-home">
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );

  if (status === 'loading' || load === 'loading') return <AsyncBoundary state="loading" loading={skeleton} />;
  if (load === 'error' || !state) {
    return (
      <AsyncBoundary
        state="error"
        errorMessage={errorText}
        onRetry={() => {
          started.current = true;
          void open();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHero
        title="Welcome to Faro"
        subtitle="Tell us the trip you are dreaming of, in the form or in a friendly chat, and we will find the stays, the flights and the places that make it unforgettable."
        photoOf={[state.trip.destinationCity, state.trip.destinationCountry, dreamPlace].filter((x): x is string => Boolean(x))}
      />
    <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-home">
      <TripForm state={state} onTripState={setState} hasContent={hasContent(state, messages)} busy={replying} onNewTrip={startNewTrip} />
      <ChatPanel
        key={state.trip.id}
        tripId={state.trip.id}
        messages={messages}
        onMessages={setMessages}
        onTripState={setState}
        onPendingChange={setReplying}
      />
    </div>
    </div>
  );
}
