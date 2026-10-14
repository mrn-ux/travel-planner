import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ds/Button';
import { Card } from '../../components/ds/Card';
import { formatDate } from '../../lib/format';
import type { Plan } from '../../lib/plan';
import { setTripId } from '../../lib/session';

function Dot({ filled }: { filled: boolean }) {
  return <span aria-hidden="true" className={`box-border size-dot shrink-0 rounded-full ${filled ? 'bg-confirmed' : 'border border-text-muted'}`} />;
}

/** Selected hotel and transport. A filled dot means a confirmed booking (hotels only); transport is never booked. */
export function SelectedLists({ plan }: { plan: Plan }) {
  const h = plan.selectedHotel;
  const t = plan.selectedTransport;
  const navigate = useNavigate();
  const { tripId } = useParams();
  return (
    <Card>
      <div className="flex flex-col gap-3 font-sans text-sm text-text">
        <div className="text-xs font-medium text-text-secondary">Selected hotels</div>
        {h ? (
          <div className="flex items-center gap-2">
            <Dot filled={h.booked} />
            <span>
              {h.name}
              <span className="text-text-muted">
                {' '}
                ({formatDate(h.checkin)} to {formatDate(h.checkout)}, {h.booked ? 'booked' : 'not booked'})
              </span>
            </span>
          </div>
        ) : (
          <span className="text-text-secondary">None selected yet.</span>
        )}
        <div className="mt-2 text-xs font-medium text-text-secondary">Selected transport</div>
        {t ? (
          <div className="flex items-center gap-2">
            <Dot filled={false} />
            <span>
              {t.label}
              <span className="text-text-muted"> ({t.booked ? `booked, reference ${t.bookingReference ?? ''}` : t.bookable ? 'not booked yet' : 'compared only, not booked'})</span>
            </span>
          </div>
        ) : (
          <>
            <span className="text-text-secondary">None selected yet.</span>
            {tripId && (
              <div>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setTripId(tripId);
                    navigate('/search?tab=transport');
                  }}
                >
                  Add transport
                </Button>
              </div>
            )}
          </>
        )}
        <div className="mt-2 text-xs font-medium text-text-secondary">Places to visit</div>
        {plan.selectedPlaces.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {plan.selectedPlaces.map((p) => (
              <li key={p.id} className="flex items-start gap-2">
                <Dot filled={false} />
                <span>
                  {p.name}
                  <span className="text-text-muted">
                    {' '}
                    ({p.kind}, {p.entry.kind === 'free' ? 'free entry' : p.entry.kind === 'paid' ? `paid entry${p.entry.charge ? ` ${p.entry.charge}` : ''}` : 'entry not stated'}, {p.openingHours ? `open ${p.openingHours}` : 'opening hours not stated'})
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-text-secondary">None chosen yet.</span>
        )}
      </div>
    </Card>
  );
}
