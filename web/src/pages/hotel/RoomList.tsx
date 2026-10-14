import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AsyncBoundary } from '../../components/AsyncBoundary';
import { CertaintyBadge } from '../../components/CertaintyBadge';
import { Select } from '../../components/ds/Select';
import { Money } from '../../components/Money';
import { SkeletonRows } from '../../components/Skeleton';
import { Button } from '../../components/ds/Button';
import { Card } from '../../components/ds/Card';
import { ApiError } from '../../lib/api';
import { getRooms, selectHotel, type Room } from '../../lib/comparison';
import { formatDate } from '../../lib/format';

interface Props {
  hotelId: string;
  tripId: string;
  checkin?: string;
  checkout?: string;
  rooms?: number;
  /** The traveler changed how many rooms to book. */
  onRooms?: (n: number) => void;
}

/** The Rooms card: live prices every time it opens, select a room, see the breakdown and continue to booking. */
export function RoomList({ hotelId, tripId, checkin, checkout, rooms: roomCount = 1, onRooms }: Props) {
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [stay, setStay] = useState<{ checkin: string; checkout: string; nights: number; adults: number; rooms: number } | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('We could not load room prices.');
  const [picked, setPicked] = useState<string | null>(null);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const res = await getRooms(hotelId, tripId, { checkin, checkout, rooms: roomCount });
      setRooms(res.rooms);
      setStay(res.stay);
      setState('ready');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We could not load room prices.');
      setState('error');
    }
  }, [hotelId, tripId, checkin, checkout, roomCount]);

  useEffect(() => {
    void load();
  }, [load]);

  // With several rooms the traveler can say what type each room should be; only offers that hold exactly those rooms are listed.
  const [types, setTypes] = useState<string[]>([]);
  useEffect(() => {
    setTypes((t) => Array.from({ length: roomCount }, (_, i) => t[i] ?? ''));
  }, [roomCount]);
  const typeNames = [...new Set((rooms ?? []).flatMap((r) => r.roomDetails.map((d) => d.name)))].sort((a, b) => a.localeCompare(b));
  const holds = (r: Room): boolean => {
    const left = r.roomDetails.map((d) => d.name.toLowerCase());
    for (const want of types.filter(Boolean)) {
      const at = left.indexOf(want.toLowerCase());
      if (at < 0) return false;
      left.splice(at, 1);
    }
    return true;
  };
  const visibleRooms = roomCount > 1 ? (rooms ?? []).filter(holds) : (rooms ?? []);
  // Once every room has a type, the cheapest offer holding exactly those rooms is selected for the traveler (they can pick another).
  const allTyped = roomCount > 1 && types.length === roomCount && types.every(Boolean);
  const typedKey = types.join('|');
  useEffect(() => {
    if (!allTyped) return;
    const first = visibleRooms[0];
    setPicked(first ? first.roomId : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTyped, typedKey, rooms]);
  const room = rooms?.find((r) => r.roomId === picked) ?? null;

  const useHotel = async () => {
    if (!stay) return;
    setSaved('saving');
    setSaveError(null);
    try {
      await selectHotel(tripId, { hotelId, roomId: room?.roomId, checkin: stay.checkin, checkout: stay.checkout, rooms: roomCount });
      setSaved('saved');
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'We could not save this hotel.');
      setSaved('idle');
    }
  };

  return (
    <Card title="Rooms">
      <AsyncBoundary
        state={state === 'ready' && rooms && rooms.length === 0 ? 'empty' : state}
        emptyMessage="These dates are fully booked, but the right room is out there. Try nearby dates or a different hotel."
        errorMessage={error}
        onRetry={() => void load()}
        loading={<SkeletonRows count={3} />}
      >
        <div className="flex flex-col gap-4 font-sans text-sm">
          {onRooms && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-solid border-border p-3">
              <span className="font-medium">Number of rooms</span>
              <span className="flex items-center gap-2">
                <Button variant="secondary" disabled={roomCount <= 1} onClick={() => onRooms(roomCount - 1)}>
                  &minus;
                </Button>
                <span className="tabular min-w-4 text-center font-medium">{roomCount}</span>
                <Button variant="secondary" disabled={stay !== null && roomCount >= stay.adults} onClick={() => onRooms(roomCount + 1)}>
                  +
                </Button>
              </span>
              <span className="w-full text-xs text-text-secondary">The guests are shared between the rooms, with an adult in each. With more than one room, each offer lists every room.</span>
            </div>
          )}
          {roomCount > 1 && typeNames.length > 0 && (
            <div className="flex flex-col gap-2 rounded-md border border-solid border-border p-3">
              <span className="font-medium">Type of each room</span>
              {types.map((t, i) => (
                <Select
                  key={i}
                  label={`Room ${i + 1}`}
                  value={t}
                  options={['', ...typeNames]}
                  labels={{ '': 'Any room type' }}
                  onChange={(e) => setTypes((all) => all.map((x, j) => (j === i ? e.target.value : x)))}
                />
              ))}
              {visibleRooms.length === 0 && <span className="text-over-budget">The hotel does not offer this combination of rooms. Choose other types.</span>}
            </div>
          )}
          {visibleRooms.map((r) => (
            <div key={r.roomId} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{r.roomDetails.length > 1 ? `${r.roomDetails.length} rooms` : r.name}</span>
                <span className="flex items-center gap-2">
                  <CertaintyBadge certainty={r.pricePerNight.certainty} />
                  <span>
                    <Money amount={r.pricePerNight.amount} currency={r.pricePerNight.currency} /> / night
                  </span>
                </span>
              </div>
              {r.roomDetails.map((d, i) => (
                <div key={i} className="text-xs text-text-secondary">
                  {r.roomDetails.length > 1 ? `Room ${i + 1}: ${d.name}. ` : ''}
                  {d.sleeps !== null ? `Sleeps ${d.sleeps}` : 'Capacity not stated'}
                  {d.beds ? `, ${d.beds}` : ', beds not stated'}
                </div>
              ))}
              <div className="text-xs text-text-muted">{r.cancellation.text} Sandbox rate.</div>
              <Button variant={picked === r.roomId ? 'primary' : 'secondary'} fullWidth onClick={() => setPicked(r.roomId)}>
                {picked === r.roomId ? 'Selected' : 'Select room'}
              </Button>
            </div>
          ))}

          {room && stay && (
            <div className="flex flex-col gap-2 border-0 border-t border-solid border-border pt-4">
              <div className="flex justify-between">
                <span className="text-text-secondary">
                  {room.breakdown.nights} {room.breakdown.nights === 1 ? 'night' : 'nights'} &times; <Money amount={room.breakdown.nightly} currency={room.pricePerNight.currency} />
                </span>
                <Money amount={room.total.amount} currency={room.total.currency} />
              </div>
              {room.breakdown.taxesAndFees && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">Taxes &amp; fees (payable at the hotel, not in the total)</span>
                  <Money amount={room.breakdown.taxesAndFees} currency={room.total.currency} />
                </div>
              )}
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <Money amount={room.breakdown.total} currency={room.total.currency} />
              </div>
              <div className="text-sm text-text-secondary">
                {room.cancellation.refundable && room.cancellation.freeUntil ? `Free cancellation until ${formatDate(room.cancellation.freeUntil.slice(0, 10))}` : room.cancellation.text}
              </div>
              <Link
                to={`/trip/${encodeURIComponent(tripId)}/book/${encodeURIComponent(hotelId)}?room=${encodeURIComponent(room.roomId)}&offer=${encodeURIComponent(room.offerId)}&checkin=${stay.checkin}&checkout=${stay.checkout}&total=${encodeURIComponent(room.total.amount ?? '')}&cur=${encodeURIComponent(room.total.currency ?? '')}&name=${encodeURIComponent(room.name)}${roomCount > 1 ? `&rooms=${roomCount}` : ''}`}
                className="inline-flex h-control-lg items-center justify-center rounded-md border border-transparent bg-accent px-4 font-sans text-sm font-medium text-white no-underline md:h-control"
              >
                Continue to booking
              </Link>
            </div>
          )}

          {stay && rooms && rooms.length > 0 && (
            <div className="flex flex-col gap-2">
              <Button variant="ghost" fullWidth onClick={() => void useHotel()} disabled={saved === 'saving'}>
                {saved === 'saved' ? 'Saved to your trip' : 'Use this hotel'}
              </Button>
              {saved === 'saved' && (
                <Link to={`/trip/${encodeURIComponent(tripId)}`} className="text-center text-accent">
                  Open trip plan
                </Link>
              )}
              {saveError && (
                <span role="alert" className="text-xs text-danger">
                  {saveError}
                </span>
              )}
            </div>
          )}
        </div>
      </AsyncBoundary>
    </Card>
  );
}
