import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ds/Button';
import { Card } from '../../components/ds/Card';
import { Input } from '../../components/ds/Input';
import { Modal } from '../../components/ds/Modal';
import { Select } from '../../components/ds/Select';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { setBackdropPlaces } from '../../lib/destinationPhoto';
import { getCities, getCountries, getCountryCurrency, type Country } from '../../lib/places';
import {
  ACCOMMODATION_OPTIONS,
  CURRENCY_OPTIONS,
  currencyLabel,
  MISSING_LABELS,
  TRANSPORT_OPTIONS,
  patchTrip,
  type BriefPatch,
  type TripState,
} from '../../lib/trip';

interface TripFormProps {
  state: TripState;
  onTripState: (state: TripState) => void;
  /** True when the trip has any detail or any message: only then does New trip make sense. */
  hasContent: boolean;
  /** True while the assistant is replying (a new trip then would receive a reply meant for the old one). */
  busy: boolean;
  /** Open a blank trip. Rejects if it could not be created; the current trip then stays open. */
  onNewTrip: () => Promise<void>;
}

type Errors = Record<string, string>;

function Group({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-sm font-medium text-text-secondary">{label}</div>
      {children}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

/**
 * The trip form (left column): every field is editable at any time, in this order: Destination, Dates,
 * Duration, Travelers, Budget, Transport preference, Accommodation preference, Activities / interests,
 * Special requirements. Edits save immediately and the chat reflects the same trip.
 */
export function TripForm({ state, onTripState, hasContent, busy, onNewTrip }: TripFormProps) {
  const { trip, missing } = state;
  const { preferences, user } = useAuth();
  const [confirmNew, setConfirmNew] = useState(false);
  const [starting, setStarting] = useState(false);
  const [newTripError, setNewTripError] = useState<string | null>(null);
  const navigate = useNavigate();

  const [countryList, setCountryList] = useState<Country[]>([]);
  const [cityList, setCityList] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [duration, setDuration] = useState('');
  const [adults, setAdults] = useState('');
  const [children, setChildren] = useState('');
  const [ages, setAges] = useState<string[]>([]);
  const [currency, setCurrency] = useState('USD');
  const [countryCur, setCountryCur] = useState<string | null>(null); // the destination country's currency
  const [amount, setAmount] = useState('');
  const [interests, setInterests] = useState('');
  const [special, setSpecial] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  // Show what the trip says whenever it changes (a chat reply may have filled fields in).
  useEffect(() => {
    setStartDate(trip.startDate ?? '');
    setEndDate(trip.endDate ?? '');
    setDuration(trip.durationDays !== null ? String(trip.durationDays) : '');
    setAdults(trip.adults !== null ? String(trip.adults) : '');
    setChildren(trip.childrenAges.length > 0 ? String(trip.childrenAges.length) : '');
    setAges(trip.childrenAges.map(String));
    setCurrency(trip.budget?.currency ?? countryCur ?? preferences?.preferredCurrency ?? 'USD');
    setAmount(trip.budget ? trip.budget.amount : '');
    setInterests(trip.interests ?? '');
    setSpecial(trip.specialRequirements ?? '');
  }, [trip, preferences?.preferredCurrency, countryCur]);

  // The country list (from the hotel provider) loads once; the city list follows the chosen country.
  useEffect(() => {
    void getCountries().then(setCountryList).catch(() => setCountryList([]));
  }, []);
  const country = trip.destinationCountry ?? (trip.destination && !trip.destinationCity ? trip.destination : '');
  const city = trip.destinationCity ?? '';
  const countryCode = countryList.find((c) => c.name.toLowerCase() === country.toLowerCase())?.code ?? null;
  // The photo behind the whole app follows the chosen city and country.
  useEffect(() => {
    setBackdropPlaces([trip.destinationCity ?? '', trip.destinationCountry ?? ''].filter(Boolean));
  }, [trip.destinationCity, trip.destinationCountry]);

  // The budget currency follows the destination country until a budget amount has been entered (then it is left alone, so the amount keeps its meaning).
  useEffect(() => {
    if (!countryCode) {
      setCountryCur(null);
      return;
    }
    let alive = true;
    void getCountryCurrency(countryCode).then((c) => {
      if (alive) setCountryCur(c);
    });
    return () => {
      alive = false;
    };
  }, [countryCode]);
  useEffect(() => {
    setCityList([]);
    if (countryCode) void getCities(countryCode).then(setCityList).catch(() => setCityList([]));
  }, [countryCode]);

  // A different trip starts with a clean slate of validation messages.
  useEffect(() => {
    setErrors({});
  }, [trip.id]);

  const save = async (patch: BriefPatch, fieldKeys: string[]) => {
    setErrors((e) => {
      const next = { ...e };
      for (const k of fieldKeys) delete next[k];
      return next;
    });
    try {
      onTripState(await patchTrip(trip.id, patch));
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors((e) => ({ ...e, ...(err.fields ?? { form: err.message }) }));
      } else {
        setErrors((e) => ({ ...e, form: 'Could not save. Check your connection.' }));
      }
    }
  };

  const saveBudget = (nextAmount: string, nextCurrency: string) => {
    const trimmed = nextAmount.trim();
    if (trimmed === '') {
      if (trip.budget) void save({ budget: null }, ['budget']);
      return;
    }
    // A budget is a positive amount: a minus sign, zero or anything that is not a number is never sent.
    if (!/^\d{1,12}(\.\d{1,2})?$/.test(trimmed) || !(Number(trimmed) > 0)) {
      setErrors((e) => ({ ...e, budget: 'Enter an amount greater than zero, for example 4000.' }));
      return;
    }
    setErrors((e) => {
      const { budget: _drop, ...rest } = e;
      return rest;
    });
    if (trip.budget && trip.budget.amount === trimmed && trip.budget.currency === nextCurrency) return;
    void save({ budget: { amount: trimmed, currency: nextCurrency } }, ['budget']);
  };

  const onChildrenChange = (value: string) => {
    const n = Math.max(0, Math.min(10, Number.parseInt(value, 10) || 0));
    setChildren(value.trim() === '' ? '' : String(n)); // never shows a negative or oversized count
    setAges((prev) => Array.from({ length: n }, (_, i) => prev[i] ?? ''));
    if (n === 0 && trip.childrenAges.length > 0) void save({ childrenAges: [] }, ['childrenAges']);
  };

  // An age is a whole number of years from 0 to 17.
  const ageProblem = (a: string | undefined): string | undefined => {
    const v = (a ?? '').trim();
    if (v === '') return undefined;
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 && n <= 17 ? undefined : 'Enter a whole number from 0 to 17.';
  };

  const saveAges = (next: string[]) => {
    if (next.length === 0 || next.some((a) => a.trim() === '')) return; // wait until every age is entered
    if (next.some((a) => ageProblem(a))) return; // never send an impossible age
    void save({ childrenAges: next.map((a) => Number(a)) }, ['childrenAges']);
  };

  const currencyOptions = CURRENCY_OPTIONS.includes(currency) ? CURRENCY_OPTIONS : [currency, ...CURRENCY_OPTIONS];
  const currencyLabels = Object.fromEntries(currencyOptions.map((c) => [c, currencyLabel(c)]));
  const childCount = Math.max(0, Math.min(10, Number.parseInt(children, 10) || 0));
  const agesDone = childCount === 0 || (ages.length >= childCount && !ages.slice(0, childCount).some((a) => ageProblem(a)) && ages.slice(0, childCount).every((a) => a.trim() !== '') && trip.childrenAges.length === childCount);
  const needed = [...missing.map((m) => MISSING_LABELS[m]), ...(agesDone ? [] : ["each child's age"])];
  const ready = needed.length === 0;
  const hint = ready ? 'All required details are set.' : `Still needed: ${needed.join(', ')}.`;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div className="font-display text-lg font-semibold text-text">Trip details</div>
          <Button
            variant="primary"
            disabled={!hasContent || busy}
            onClick={() => {
              setNewTripError(null);
              setConfirmNew(true);
            }}
          >
            + New trip
          </Button>
        </div>
        <div className="flex flex-col gap-4">
          <Select
            label="Destination country *"
            value={country}
            options={['', ...(country && !countryList.some((c) => c.name.toLowerCase() === country.toLowerCase()) ? [country] : []), ...countryList.map((c) => c.name)]}
            labels={{ '': 'Select a country' }}
            onChange={(e) => void save({ destinationCountry: e.target.value || null, destinationCity: null }, ['destinationCountry', 'destinationCity', 'destination'])}
          />
          {(errors['destinationCountry'] ?? errors['destination']) && <span className="-mt-2 text-xs text-danger">{errors['destinationCountry'] ?? errors['destination']}</span>}
          <Select
            label="Destination city"
            value={city}
            options={['', ...(city && !cityList.includes(city) ? [city] : []), ...cityList]}
            labels={{ '': country ? 'Whole country (no city)' : 'Select a country first' }}
            onChange={(e) => void save({ destinationCity: e.target.value || null }, ['destinationCity', 'destinationCountry', 'destination'])}
          />

          <Group label="Dates * (start and end)" error={errors['startDate'] ?? errors['endDate']}>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  void save({ startDate: e.target.value || null }, ['startDate', 'endDate', 'durationDays']);
                }}
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  void save({ endDate: e.target.value || null }, ['startDate', 'endDate', 'durationDays']);
                }}
              />
            </div>
          </Group>

          <Input
            label="Duration"
            type="number"
            placeholder="Number of days"
            value={duration}
            error={errors['durationDays']}
            onChange={(e) => setDuration(e.target.value)}
            onBlur={() => {
              const v = duration.trim();
              if (v === String(trip.durationDays ?? '')) return;
              void save({ durationDays: v === '' ? null : Number(v) }, ['durationDays', 'endDate']);
            }}
          />

          <Group label="Travelers * (adults and children)" error={errors['adults'] ?? errors['childrenAges']}>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                min={1}
                max={20}
                step={1}
                placeholder="Adults"
                value={adults}
                onChange={(e) => setAdults(e.target.value)}
                onBlur={() => {
                  const v = adults.trim();
                  if (v === String(trip.adults ?? '')) return;
                  void save({ adults: v === '' ? null : Number(v) }, ['adults']);
                }}
              />
              <Input type="number" min={0} max={10} step={1} placeholder="Children" value={children} onChange={(e) => onChildrenChange(e.target.value)} />
            </div>
            {childCount > 0 && (
              <div className="mt-2 flex flex-col gap-2">
                <div className="text-xs text-text-secondary">Age of each child in years (0 to 17). For a baby under 1 year, enter 0.</div>
                <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: childCount }, (_, i) => (
                  <Input
                    key={i}
                    type="number"
                    label={`Child ${i + 1} age`}
                    placeholder="Years"
                    min={0}
                    max={17}
                    step={1}
                    error={ageProblem(ages[i])}
                    value={ages[i] ?? ''}
                    onChange={(e) => {
                      const next = [...ages];
                      next[i] = e.target.value;
                      setAges(next);
                    }}
                    onBlur={() => saveAges(ages)}
                  />
                ))}
                </div>
              </div>
            )}
          </Group>

          <Group label="Budget *" error={errors['budget']}>
            <div className="grid grid-cols-5 gap-2">
              <div className="col-span-3">
              <Select
                value={currency}
                options={currencyOptions}
                labels={currencyLabels}
                onChange={(e) => {
                  setCurrency(e.target.value);
                  saveBudget(amount, e.target.value);
                }}
              />
              </div>
              <div className="col-span-2">
                <Input
                  type="number"
                  min={1}
                  step={0.01}
                  placeholder="Total"
                  onKeyDown={(e) => {
                    if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E') e.preventDefault();
                  }}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onBlur={() => saveBudget(amount, currency)}
                />
              </div>
            </div>
          </Group>

          <Select
            label="Transport preference *"
            value={trip.transportPreference ?? TRANSPORT_OPTIONS[0]}
            options={TRANSPORT_OPTIONS}
            onChange={(e) => void save({ transportPreference: e.target.value === TRANSPORT_OPTIONS[0] ? null : e.target.value }, ['transportPreference'])}
          />
          <Select
            label="Accommodation preference *"
            value={trip.accommodationPreference ?? ACCOMMODATION_OPTIONS[0]}
            options={ACCOMMODATION_OPTIONS}
            onChange={(e) => void save({ accommodationPreference: e.target.value === ACCOMMODATION_OPTIONS[0] ? null : e.target.value }, ['accommodationPreference'])}
          />
          <Input
            label="Activities / interests"
            placeholder="e.g. temples, food, hiking"
            value={interests}
            error={errors['interests']}
            onChange={(e) => setInterests(e.target.value)}
            onBlur={() => {
              const v = interests.trim();
              if (v !== (trip.interests ?? '')) void save({ interests: v || null }, ['interests']);
            }}
          />
          <Input
            label="Special requirements"
            placeholder="Anything we should know"
            value={special}
            error={errors['specialRequirements']}
            onChange={(e) => setSpecial(e.target.value)}
            onBlur={() => {
              const v = special.trim();
              if (v !== (trip.specialRequirements ?? '')) void save({ specialRequirements: v || null }, ['specialRequirements']);
            }}
          />
          {errors['form'] && <div className="text-sm text-danger">{errors['form']}</div>}
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        <Button fullWidth disabled={!ready} onClick={() => navigate('/search')}>
          See results
        </Button>
        <span className="text-chip text-text-secondary">{hint}</span>
      </div>

      {confirmNew && (
        <Modal
          title="Start a new trip?"
          onClose={starting ? undefined : () => setConfirmNew(false)}
          actions={
            <>
              <Button variant="secondary" disabled={starting} onClick={() => setConfirmNew(false)}>
                Cancel
              </Button>
              <Button
                disabled={starting}
                onClick={async () => {
                  setStarting(true);
                  setNewTripError(null);
                  try {
                    await onNewTrip();
                    setConfirmNew(false);
                  } catch (err) {
                    setNewTripError(err instanceof ApiError ? err.message : 'Could not start a new trip. Try again.');
                  } finally {
                    setStarting(false);
                  }
                }}
              >
                {starting ? 'Starting...' : 'Start new trip'}
              </Button>
            </>
          }
        >
          <p>
            {user
              ? 'Your current trip stays saved in My trips. Faro will open a blank trip.'
              : 'You are not logged in, so your current trip will be discarded. Log in first if you want to keep your trips.'}
          </p>
          {newTripError && (
            <p role="alert" className="mt-3 text-danger">
              {newTripError}
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}
