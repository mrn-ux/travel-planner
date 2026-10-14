import { PageHero } from '../../components/PageHero';
import { LODGING_IMAGES } from '../../lib/destinationPhoto';
import { usePageImages } from '../../lib/usePageImages';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { AsyncBoundary } from '../../components/AsyncBoundary';
import { SkeletonCard } from '../../components/Skeleton';
import { ApiError } from '../../lib/api';
import { getHotelDetails, type HotelDetails } from '../../lib/comparison';
import { getTripId } from '../../lib/session';
import { Gallery } from './Gallery';
import { HotelMap } from './HotelMap';
import { ProviderQuote, Reviews } from './Reviews';
import { RoomList } from './RoomList';

/** /hotels/:hotelId: gallery band, then details beside the rooms column (stacked on mobile). */
export default function HotelPage() {
  const stayImages = usePageImages(LODGING_IMAGES);
  const { hotelId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tripId = params.get('tripId') ?? getTripId() ?? '';
  const checkin = params.get('checkin') ?? undefined;
  const checkout = params.get('checkout') ?? undefined;
  const rooms = Math.max(1, Math.min(10, Number(params.get('rooms') ?? '1') || 1));

  const [data, setData] = useState<HotelDetails | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [error, setError] = useState('We could not load this hotel.');

  const load = useCallback(async () => {
    if (!tripId || !hotelId) {
      setState('empty');
      return;
    }
    setState('loading');
    try {
      setData(await getHotelDetails(hotelId, tripId, { checkin, checkout }));
      setState('ready');
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setState('empty');
        return;
      }
      setError(err instanceof ApiError ? err.message : 'We could not load this hotel.');
      setState('error');
    }
  }, [hotelId, tripId, checkin, checkout]);

  useEffect(() => {
    void load();
  }, [load]);

  const h = data?.hotel;
  const stars = h?.stars ? `${Math.round(h.stars)}-star hotel` : 'Hotel';
  return (
    <AsyncBoundary
      state={state}
      emptyMessage="This hotel could not be found. Open it from the search results."
      errorMessage={error}
      onRetry={() => void load()}
      loading={
        <div className="flex flex-col gap-8">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      }
    >
      {data && h && (
        <div className="flex flex-col gap-8">
          <PageHero title={h.name} subtitle={[h.city, h.address].filter(Boolean).join(', ') || undefined} photoOf={stayImages} />
          <Gallery images={data.images} name={h.name} />
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-hotel">
            <div className="flex min-w-0 flex-col gap-6">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <h1 className="m-0 font-display text-lg font-semibold text-text">{h.name}</h1>
                <span className="font-sans text-sm text-text-secondary">{stars}</span>
                {h.rating && <span className="tabular font-sans text-sm font-medium">{h.rating} / 10</span>}
              </div>

              {data.description ? <ProviderQuote text={data.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()} label="Provider description" /> : <p className="m-0 font-sans text-sm text-text-secondary">Description not available.</p>}

              <div>
                <div className="mb-2 font-sans text-sm font-medium text-text-secondary">Amenities</div>
                {data.amenities.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {data.amenities.slice(0, 20).map((a) => (
                      <span key={a} className="rounded-full bg-surface-muted px-3 py-1 font-sans text-chip text-text">
                        {a}
                      </span>
                    ))}
                    {data.amenities.length > 20 && <span className="px-3 py-1 font-sans text-chip text-text-secondary">+{data.amenities.length - 20} more</span>}
                  </div>
                ) : (
                  <p className="m-0 font-sans text-sm text-text-secondary">Not available.</p>
                )}
              </div>

              <div>
                <div className="mb-2 font-sans text-sm font-medium text-text-secondary">Map</div>
                {data.location ? <HotelMap lat={data.location.lat} lon={data.location.lon} tiles={data.map} name={h.name} /> : <p className="m-0 font-sans text-sm text-text-secondary">Map not available.</p>}
                {h.address && <p className="mb-0 mt-2 font-sans text-sm text-text-secondary">{h.address}</p>}
              </div>

              <div className="flex flex-col gap-3">
                <div className="font-sans text-sm font-medium text-text-secondary">Reviews</div>
                <Reviews reviews={data.reviews} note={data.reviewsNote} />
              </div>
              <p className="m-0 font-sans text-xs text-text-muted">Hotel content from the LiteAPI sandbox.</p>
            </div>

            <RoomList
              hotelId={hotelId}
              tripId={tripId}
              checkin={checkin}
              checkout={checkout}
              rooms={rooms}
              onRooms={(n) =>
                setParams(
                  (prev) => {
                    const next = new URLSearchParams(prev);
                    if (n > 1) next.set('rooms', String(n));
                    else next.delete('rooms');
                    return next;
                  },
                  { replace: true },
                )
              }
            />
          </div>
        </div>
      )}
    </AsyncBoundary>
  );
}
