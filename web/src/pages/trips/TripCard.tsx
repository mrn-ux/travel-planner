import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components/ds/Modal';
import { ApiError } from '../../lib/api';
import { clearTripId, getTripId } from '../../lib/session';
import { Button } from '../../components/ds/Button';
import { Card } from '../../components/ds/Card';
import { EM_DASH, formatDateRange, formatMoney } from '../../lib/format';
import { usePlanDownload } from '../../lib/download';
import { deleteMyTrip, type TripCardData } from '../../lib/myTrips';

const HOTEL_TEXT: Record<TripCardData['hotel']['status'], string> = {
  not_booked: 'Hotels: not booked',
  pending: 'Hotels: pending confirmation',
  confirmed: 'Hotels: confirmed',
  failed: 'Hotels: booking failed',
};

function Dot({ filled }: { filled: boolean }) {
  return <span aria-hidden="true" className={`box-border size-dot shrink-0 rounded-full ${filled ? 'bg-confirmed' : 'border border-text-muted'}`} />;
}

/** One saved trip (UI-SPEC 2.8, frame 1o): title, dates, booking dots, the estimated total with its certainty, Open and Download. */
export function TripCard({ trip, onDeleted }: { trip: TripCardData; onDeleted: () => void }) {
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // A trip with a booking is kept: only planned trips can be deleted.
  const canDelete = trip.hotel.status !== 'confirmed' && trip.hotel.status !== 'pending' && trip.transport.bookingReference === null;
  const { state, error, start } = usePlanDownload(trip.tripId);
  const total = trip.estimatedTotal;

  return (
    <Card title={trip.title}>
      <div className="flex flex-col gap-3 font-sans text-sm">
        <div className="text-text-secondary">{trip.startDate && trip.endDate ? formatDateRange(trip.startDate, trip.endDate) : 'Dates not set'}</div>
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <Dot filled={trip.hotel.status === 'confirmed'} />
            <span>
              <span className="font-medium">{trip.hotel.name ? 'Hotel' : HOTEL_TEXT[trip.hotel.status]}</span>
              {trip.hotel.name && (
                <>
                  : {trip.hotel.name}
                  {trip.hotel.room ? `, ${trip.hotel.room}` : ''}
                  {trip.hotel.total && (
                    <>
                      {' '}
                      (<span className="tabular">{formatMoney(trip.hotel.total.amount, trip.hotel.total.currency)}</span>)
                    </>
                  )}
                </>
              )}
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Dot filled={trip.transport.bookingReference !== null} />
            <span>
              <span className="font-medium">{trip.transport.label ? (trip.transport.bookingReference ? 'Flight booked' : 'Transport') : 'Transport: not selected'}</span>
              {trip.transport.label && (
                <>
                  : {trip.transport.label}
                  {trip.transport.price && (
                    <>
                      {' '}
                      (<span className="tabular">{formatMoney(trip.transport.price.amount, trip.transport.price.currency)}</span>)
                    </>
                  )}
                  {trip.transport.bookingReference && <span className="text-text-muted"> reference {trip.transport.bookingReference}</span>}
                </>
              )}
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Dot filled={trip.places.count > 0} />
            <span>
              <span className="font-medium">{trip.places.count > 0 ? `Places to visit (${trip.places.count})` : 'Places to visit: none chosen'}</span>
              {trip.places.count > 0 && (
                <>
                  : {trip.places.names.slice(0, 4).join(', ')}
                  {trip.places.count > 4 ? ` and ${trip.places.count - 4} more` : ''}
                </>
              )}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-1 rounded-md border border-border bg-surface p-4">
          {trip.budget && (
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-text-secondary">Budget</span>
              <span className="tabular font-medium text-text">{formatMoney(trip.budget.amount, trip.budget.currency)}</span>
            </div>
          )}
          <div className="text-text-secondary">Estimated total</div>
          <div className="tabular text-xl font-semibold text-text">{total.amount && total.certainty !== 'unavailable' ? formatMoney(total.amount, total.currency) : EM_DASH}</div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate(`/trip/${encodeURIComponent(trip.tripId)}`)}>Open</Button>
          <Button variant="secondary" onClick={() => void start()} disabled={state === 'preparing'}>
            {state === 'preparing' ? 'Preparing your plan' : 'Download'}
          </Button>
          {canDelete && (
            <Button
              variant="ghost"
              onClick={() => {
                setDeleteError(null);
                setConfirmDelete(true);
              }}
            >
              Delete
            </Button>
          )}
        </div>
        {!canDelete && <div className="text-xs text-text-muted">A trip with a booking cannot be deleted.</div>}
        {confirmDelete && (
          <Modal
            title="Delete this trip?"
            onClose={deleting ? undefined : () => setConfirmDelete(false)}
            actions={
              <>
                <Button variant="secondary" disabled={deleting} onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  disabled={deleting}
                  onClick={async () => {
                    setDeleting(true);
                    setDeleteError(null);
                    try {
                      await deleteMyTrip(trip.tripId);
                      if (getTripId() === trip.tripId) clearTripId();
                      setConfirmDelete(false);
                      onDeleted();
                    } catch (err) {
                      setDeleteError(err instanceof ApiError ? err.message : 'Could not delete the trip. Try again.');
                    } finally {
                      setDeleting(false);
                    }
                  }}
                >
                  {deleting ? 'Deleting...' : 'Delete trip'}
                </Button>
              </>
            }
          >
            <p>
              {trip.title}
              {trip.startDate && trip.endDate ? `, ${formatDateRange(trip.startDate, trip.endDate)}` : ''} will be removed with its plan, chosen places and selections. This cannot be undone.
            </p>
            {deleteError && (
              <p role="alert" className="mt-3 text-danger">
                {deleteError}
              </p>
            )}
          </Modal>
        )}
        {state === 'error' && (
          <div role="alert" className="flex items-center justify-between gap-2 text-danger">
            <span>{error}</span>
            <Button variant="secondary" onClick={() => void start()}>
              Retry
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
