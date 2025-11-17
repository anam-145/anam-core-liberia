'use client';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

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

  const submit = async () => {
    setError('');
    if (!name.trim() || !start || !end || !amountPerDay) {
      setError('필수 항목을 입력해 주세요.');
      return;
    }
    setSubmitting(true);
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
        setError(data?.error || '이벤트 생성에 실패했습니다');
        return;
      }
      router.push('/events');
    } catch (e) {
      setError(e instanceof Error ? e.message : '네트워크 오류가 발생했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
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
                onChange={(e) => setName(e.target.value)}
                required
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input label="Start Date" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
                <Input label="End Date" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
              <div>
                <label className="label">Description</label>
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
                <Input
                  label="Amount per Day (USDC)"
                  type="number"
                  placeholder="50.000000"
                  value={amountPerDay}
                  onChange={(e) => setAmountPerDay(e.target.value)}
                />
                <Input
                  label="Max Participants"
                  type="number"
                  placeholder="100"
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(e.target.value)}
                />
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
