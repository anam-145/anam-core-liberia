'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

type KnownStatus = 'PENDING' | 'ONGOING' | 'COMPLETED';

interface ApiEvent {
  eventId: string;
  name: string;
  derivedStatus?: string; // 서버에서 파생된 상태
  status?: string; // (호환용) 서버가 주는 기존 상태가 있을 수 있음
  startDate: string; // ISO
  endDate: string; // ISO
  createdAt: string; // ISO
}

export default function EventsClient() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<KnownStatus | 'ALL'>('ALL');
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function fetchEvents(status?: string) {
    setLoading(true);
    setError('');
    try {
      const url = new URL('/api/admin/events', window.location.origin);
      if (status && status !== 'ALL') url.searchParams.set('status', status);
      const res = await fetch(url.toString(), { cache: 'no-store' });

      // Parse JSON only when content-type is JSON
      const contentType = res.headers.get('content-type') || '';
      let data: { events?: ApiEvent[]; error?: string } | null = null;
      if (contentType.includes('application/json')) {
        data = await res.json().catch(() => null);
      } else {
        const text = await res.text();
        if (!res.ok) throw new Error(text || 'Failed to load');
        // If somehow success with non-JSON, treat as empty list
        data = { events: [] };
      }

      if (!res.ok) throw new Error(data?.error || 'Failed to load');

      const list: ApiEvent[] = (data?.events ?? []).map((e) => ({
        eventId: e.eventId,
        name: e.name,
        derivedStatus: e.derivedStatus,
        status: e.status,
        startDate: e.startDate,
        endDate: e.endDate,
        createdAt: e.createdAt,
      }));
      setEvents(list);
    } catch (e) {
      // Common helpful messages for auth errors
      const msg = e instanceof Error ? e.message : 'Network error';
      if (/Unauthorized|401/.test(msg)) setError('You are not authorized. Please log in again.');
      else if (/Forbidden|403/.test(msg)) setError('You do not have permission to access this page.');
      else if (msg.startsWith('<!DOCTYPE')) setError('A server error has occurred.');
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEvents(statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return events.filter((ev) => {
      const matchesSearch = !q || ev.name.toLowerCase().includes(q) || ev.eventId.includes(q);
      const s = (ev.derivedStatus || ev.status || '').toUpperCase();
      const matchesStatus = statusFilter === 'ALL' || s === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [events, searchQuery, statusFilter]);

  const isEmpty = !loading && !error && filtered.length === 0;

  const formatDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-';

  const statusBadge = (statusRaw: string) => {
    const status = (statusRaw || '').toUpperCase() as KnownStatus;
    const map: Record<KnownStatus, string> = {
      PENDING: 'bg-blue-50 text-blue-700 border-blue-200',
      ONGOING: 'bg-amber-50 text-amber-700 border-amber-200',
      COMPLETED: 'bg-green-50 text-green-700 border-green-200',
    };
    return map[status] || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  return (
    <div className="max-w-screen-2xl mx-auto">
      <div className="mb-6 lg:mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-[var(--text)]">Events</h1>
            <p className="text-sm lg:text-base text-[var(--muted)] mt-1">
              Manage workshops, trainings, and distribution events
            </p>
          </div>
          <Link href="/events/new">
            <Button>+ New Event</Button>
          </Link>
        </div>
      </div>

      <div className="card mb-4 lg:mb-6">
        <div className="card__body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              type="text"
              placeholder="Search by event name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <select
              className="select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as KnownStatus | 'ALL')}
            >
              <option value="ALL">All</option>
              <option value="PENDING">Upcoming</option>
              <option value="ONGOING">Ongoing</option>
              <option value="COMPLETED">Completed</option>
            </select>
            <div />
          </div>
        </div>
      </div>

      {loading && (
        <div className="card">
          <div className="card__body">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="card">
          <div className="card__body text-center py-12">
            <p className="text-red-600 mb-4">Something went wrong. {error}</p>
            <Button variant="secondary" onClick={() => fetchEvents(statusFilter)}>
              Try again
            </Button>
          </div>
        </div>
      )}

      {isEmpty && (
        <div className="card">
          <div className="card__body text-center py-12">
            <p className="text-[var(--muted)] mb-4">There are no events yet.</p>
            {/* 새 이벤트 만들기 버튼은 임시로 숨김 처리 */}
          </div>
        </div>
      )}

      {!loading && !error && !isEmpty && (
        <>
          <div className="hidden lg:block overflow-x-auto">
            <table className="table min-w-[820px]">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Status</th>
                  <th>Period</th>
                  <th>Created At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ev) => (
                  <tr key={ev.eventId}>
                    <td>
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: 2 }}>{ev.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>ID: {ev.eventId}</div>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${statusBadge(
                          (ev.derivedStatus || ev.status) as string,
                        )}`}
                      >
                        {(ev.derivedStatus || ev.status) as string}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--muted)' }}>
                      {formatDate(ev.startDate)} ~ {formatDate(ev.endDate)}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--muted)' }}>{formatDate(ev.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Link href={`/events/${ev.eventId}`}>
                          <Button variant="secondary" size="sm">
                            Details
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-4">
            {filtered.map((ev) => (
              <div key={ev.eventId} className="card">
                <div className="card__body">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>{ev.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--muted)' }}>ID: {ev.eventId}</div>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${statusBadge(
                        (ev.derivedStatus || ev.status) as string,
                      )}`}
                    >
                      {(ev.derivedStatus || ev.status) as string}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
                    <div>
                      Period: {formatDate(ev.startDate)} ~ {formatDate(ev.endDate)}
                    </div>
                    <div>Created At: {formatDate(ev.createdAt)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Link href={`/events/${ev.eventId}`}>
                      <Button variant="secondary">Details</Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
