import { useState } from 'react';
import { Button } from '../../../components/ds/Button';
import { Card } from '../../../components/ds/Card';
import { Input } from '../../../components/ds/Input';
import { ApiError } from '../../../lib/api';
import { saveGuest, type Booking } from '../../../lib/booking';
import { Alert } from './Alert';

interface Props {
  booking: Booking;
  email: string;
  onBooking: (b: Booking) => void;
}

/** Step 3: primary guest details. The mockup has one name field; it is split into first and last name for the provider. */
export function Guest({ booking, email, onBooking }: Props) {
  const g = booking.guest;
  const [name, setName] = useState(g ? `${g.firstName} ${g.lastName}` : '');
  const [mail, setMail] = useState(g?.email ?? email);
  const [phone, setPhone] = useState(g?.phone ?? '');
  const [requests, setRequests] = useState(g?.specialRequests ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    const parts = name.trim().split(/\s+/);
    if (parts.length < 2) return setErrors({ name: 'Enter a first and last name.' });
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      const res = await saveGuest(booking.id, { firstName: parts[0] as string, lastName: parts.slice(1).join(' '), email: mail, phone, ...(requests.trim() ? { specialRequests: requests } : {}) });
      onBooking(res.booking);
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        const f = { ...err.fields };
        if (f['firstName'] || f['lastName']) f['name'] = f['firstName'] ?? f['lastName'] ?? '';
        setErrors(f);
      } else {
        setError(err instanceof ApiError ? err.message : 'We could not save the guest details.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-booking">
      <Card title="Guest details">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Input label="Primary guest name" value={name} onChange={(e) => setName(e.target.value)} error={errors['name']} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input label="Email" type="email" value={mail} onChange={(e) => setMail(e.target.value)} error={errors['email']} />
            <Input label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors['phone']} />
          </div>
          <Input label="Special requests (optional)" placeholder="Cots, quiet floor, late arrival" value={requests} onChange={(e) => setRequests(e.target.value)} error={errors['specialRequests']} />
          {error && <Alert tone="danger" title={error} />}
          <div>
            <Button type="submit" disabled={busy}>
              Continue
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
