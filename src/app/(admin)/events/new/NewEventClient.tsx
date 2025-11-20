'use client';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ProgressModal from '@/components/ui/ProgressModal';

export default function NewEventClient() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [start, setStart] = useState(''); // date-only (YYYY-MM-DD)
  const [end, setEnd] = useState(''); // date-only (YYYY-MM-DD)
  const [description, setDescription] = useState('');
  const [amountPerDay, setAmountPerDay] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('100');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMsg, setModalMsg] = useState('Creating event...');
  const [modalDone, setModalDone] = useState(false);
  const [nextHref, setNextHref] = useState('/events');

  const submit = async () => {
    setError('');
    // Client-side validation with per-field messages (like admin-signup)
    const fe: Record<string, string> = {};
    if (!name.trim()) fe.name = 'Please enter an event name.';
    if (!start) fe.start = 'Please select a start date.';
    if (!end) fe.end = 'Please select an end date.';
    if (!amountPerDay) fe.amountPerDay = 'Please enter the daily DSA amount.';
    const amt = Number(amountPerDay);
    if (amountPerDay && (!Number.isFinite(amt) || amt <= 0)) {
      fe.amountPerDay = 'Amount per day must be a positive number.';
    }
    if (!maxParticipants) {
      fe.maxParticipants = 'Please enter the maximum number of participants.';
    } else {
      const mp = parseInt(maxParticipants, 10);
      if (!Number.isInteger(mp) || mp <= 0) {
        fe.maxParticipants = 'Max participants must be an integer greater than or equal to 1.';
      }
    }
    if (Object.keys(fe).length > 0) {
      setFieldErrors(fe);
      setError('Please check the input values.');
      return;
    }
    setSubmitting(true);
    setModalMsg('Deploying contract and funding event. Please wait...');
    setModalDone(false);
    setModalOpen(true);
    try {
      // 시/분은 사용하지 않음: date input(YYYY-MM-DD) 그대로 전달
      const normalizeDate = (d: string) => d.trim();
      const body = {
        name: name.trim(),
        description: description.trim() || undefined,
        startDate: normalizeDate(start),
        endDate: normalizeDate(end),
        amountPerDay: Number(amountPerDay).toFixed(6),
        maxParticipants: maxParticipants ? parseInt(maxParticipants, 10) : undefined,
      };
      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        // Map server-side field details to inline errors when present
        const feServer: Record<string, string> = { ...fieldErrors };
        const details = (data && data.details) || {};
        // Prefer fieldErrors map (like admin-signup)
        if (details.fieldErrors && typeof details.fieldErrors === 'object') {
          const map: Record<string, string> = details.fieldErrors as Record<string, string>;
          // Map server keys to local input keys
          if (map.name) feServer.name = map.name;
          if (map.startDate) feServer.start = map.startDate;
          if (map.endDate) feServer.end = map.endDate;
          if (map.amountPerDay) feServer.amountPerDay = map.amountPerDay;
          if (map.maxParticipants) feServer.maxParticipants = map.maxParticipants;
        }
        // Single field hint
        if (details.field && typeof details.field === 'string') {
          const f = details.field as string;
          const msg = data?.error || 'Please check the input values.';
          if (f === 'name') feServer.name = msg;
          if (f === 'startDate') feServer.start = msg;
          if (f === 'endDate') feServer.end = msg;
          if (f === 'amountPerDay') feServer.amountPerDay = msg;
          if (f === 'maxParticipants') feServer.maxParticipants = msg;
        }
        setFieldErrors(feServer);
        setError(data?.error || 'Failed to create event.');
        setModalOpen(false);
        return;
      }
      setModalMsg('Event has been created.');
      setModalDone(true);
      const eventId = data?.event?.eventId as string | undefined;
      setNextHref(eventId ? `/events/${eventId}` : '/events');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'A network error has occurred.');
      setModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <ProgressModal
        open={modalOpen}
        title={modalDone ? 'Completed' : 'Processing'}
        message={modalMsg}
        done={modalDone}
        confirmText="OK"
        onConfirm={() => {
          setModalOpen(false);
          setModalDone(false);
          router.push(nextHref);
        }}
      />
      <h1 className="text-xl lg:text-2xl font-bold mb-4">Create New Event</h1>
      <div className="grid grid-cols-1 gap-4">
        <Card>
          <CardHeader>Basic Information</CardHeader>
          <CardBody>
            <div className="grid gap-4">
              {error && (
                <div className="text-[13px] p-3 rounded-lg border border-red-200 bg-red-50 text-red-700">{error}</div>
              )}
              <Input
                label="Event Name"
                placeholder="Financial Literacy Workshop 2025"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (fieldErrors.name) setFieldErrors((s) => ({ ...s, name: '' }));
                }}
                required
              />
              {fieldErrors.name && <div className="text-red-600 text-[12px]">{fieldErrors.name}</div>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  label="Start Date"
                  type="date"
                  value={start}
                  onChange={(e) => {
                    setStart(e.target.value);
                    if (fieldErrors.start) setFieldErrors((s) => ({ ...s, start: '' }));
                  }}
                />
                <Input
                  label="End Date"
                  type="date"
                  value={end}
                  onChange={(e) => {
                    setEnd(e.target.value);
                    if (fieldErrors.end) setFieldErrors((s) => ({ ...s, end: '' }));
                  }}
                />
              </div>
              {(fieldErrors.start || fieldErrors.end) && (
                <div className="text-red-600 text-[12px]">{fieldErrors.start || fieldErrors.end}</div>
              )}
              <div>
                <label className="label">Description (optional)</label>
                <textarea
                  className="textarea"
                  rows={5}
                  placeholder="Enter event description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <div className="helper">Brief 2-3 sentence summary recommended</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Input
                    label="Amount per Day (USDC)"
                    type="number"
                    placeholder="50.000000"
                    value={amountPerDay}
                    onChange={(e) => {
                      setAmountPerDay(e.target.value);
                      if (fieldErrors.amountPerDay) setFieldErrors((s) => ({ ...s, amountPerDay: '' }));
                    }}
                    required
                  />
                  {fieldErrors.amountPerDay && (
                    <div className="text-red-600 text-[12px] mt-1">{fieldErrors.amountPerDay}</div>
                  )}
                </div>
                <div>
                  <Input
                    label="Max Participants"
                    type="number"
                    placeholder="100"
                    value={maxParticipants}
                    onChange={(e) => {
                      setMaxParticipants(e.target.value);
                      if (fieldErrors.maxParticipants) setFieldErrors((s) => ({ ...s, maxParticipants: '' }));
                    }}
                    required
                  />
                  {fieldErrors.maxParticipants && (
                    <div className="text-red-600 text-[12px] mt-1">{fieldErrors.maxParticipants}</div>
                  )}
                </div>
              </div>
              <div className="helper">
                Token is fixed to USDC on Base for all events. Location and event type are omitted.
              </div>
            </div>
          </CardBody>
          <CardFooter>
            <div className="flex justify-end gap-2 w-full">
              <Button onClick={submit} disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Event'}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
