'use client';
import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/stores/session.store';

interface ApiEvent {
  eventId: string;
  name: string;
  description: string | null;
  startDate: string; // ISO
  endDate: string; // ISO
  amountPerDay: string;
  maxParticipants: number;
  isActive: boolean;
  derivedStatus?: 'PENDING' | 'ONGOING' | 'COMPLETED';
  status?: 'PENDING' | 'ONGOING' | 'COMPLETED';
}

export default function DashboardClient() {
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  // Use Zustand store for session management (already loaded by AdminShell)
  const { role } = useSessionStore();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        if (role === 'SYSTEM_ADMIN') {
          const res = await fetch('/api/admin/events', { cache: 'no-store' });
          const data = (await res.json().catch(() => ({}))) as { events?: ApiEvent[]; error?: string };
          if (!res.ok) throw new Error((data as { error?: string })?.error || '이벤트를 불러오지 못했습니다');
          const list: ApiEvent[] = (data.events ?? [])
            .filter((e) => e.isActive) // ✅ isActive가 true인 이벤트만 표시
            .map((e) => ({
              eventId: e.eventId,
              name: e.name,
              description: e.description ?? null,
              startDate: e.startDate,
              endDate: e.endDate,
              amountPerDay: e.amountPerDay,
              maxParticipants: e.maxParticipants ?? 0,
              isActive: Boolean(e.isActive),
              derivedStatus: e.derivedStatus as ApiEvent['derivedStatus'],
              status: e.status as ApiEvent['status'],
            }));
          if (!cancelled) setEvents(list);
        } else if (role === 'STAFF') {
          const res = await fetch('/api/admin/events/staff/me?role=APPROVER', { cache: 'no-store' });
          const data = (await res.json().catch(() => ({}))) as {
            events?: Array<Partial<ApiEvent> & { derivedStatus?: ApiEvent['derivedStatus'] }>;
            assignedEventIds?: string[];
            error?: string;
          };
          if (!res.ok) throw new Error(data?.error || '이벤트를 불러오지 못했습니다');

          const staffList: ApiEvent[] = (data.events ?? [])
            .filter((e) => {
              const d = e as unknown as Record<string, unknown>;
              return Boolean(d.isActive); // ✅ isActive가 true인 이벤트만 표시
            })
            .map((e) => {
              const d = e as unknown as Record<string, unknown>;
              const start = new Date(String(d.startDate));
              const end = new Date(String(d.endDate));
              const now = new Date();
              const derived = now < start ? 'PENDING' : now > end ? 'COMPLETED' : 'ONGOING';
              return {
                eventId: String(d.eventId),
                name: String(d.name),
                description: d.description ?? null,
                startDate: String(d.startDate),
                endDate: String(d.endDate),
                amountPerDay: String(d.amountPerDay ?? ''),
                maxParticipants: Number(d.maxParticipants ?? 0),
                isActive: Boolean(d.isActive),
                derivedStatus: (d.derivedStatus as ApiEvent['derivedStatus']) ?? derived,
                status: d.status as ApiEvent['status'],
              } as ApiEvent;
            });
          if (!cancelled) setEvents(staffList);
        } else {
          if (!cancelled) setEvents([]);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '이벤트를 불러오지 못했습니다');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role]);

  const getStatusBadgeColor = (status: string) => {
    const map: Record<string, string> = {
      PENDING: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      ONGOING: 'bg-green-50 text-green-700 border-green-200',
      COMPLETED: 'bg-gray-50 text-gray-700 border-gray-200',
    };
    return map[status] || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      PENDING: '예정',
      ONGOING: '진행중',
      COMPLETED: '완료',
    };
    return map[status] || status;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const calculateDays = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const getDerivedStatus = (e: ApiEvent): 'PENDING' | 'ONGOING' | 'COMPLETED' => {
    if (e.derivedStatus) return e.derivedStatus;
    if (e.status) return e.status;
    try {
      const start = new Date(e.startDate);
      const end = new Date(e.endDate);
      const now = new Date();
      if (now < start) return 'PENDING';
      if (now > end) return 'COMPLETED';
      return 'ONGOING';
    } catch {
      return 'PENDING';
    }
  };

  // 이벤트가 없을 때는 체크인과 동일한 빈 화면만 표시
  if (!error && events.length === 0) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center p-4">
        <div className="w-full max-w-xl">
          <div className="card">
            <div className="card__header">대시보드</div>
            <div className="card__body">
              {isLoading ? (
                <div className="text-center py-8 text-gray-500">이벤트 목록을 불러오는 중...</div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-500 mb-2">배정된 이벤트가 없습니다</div>
                  <p className="text-sm text-gray-400">관리자가 이벤트에 배정하면 여기에 표시됩니다</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-screen-2xl mx-auto">
      <div className="mb-6 lg:mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-[var(--text)]">대시보드</h1>
            <p className="text-sm lg:text-base text-[var(--muted)] mt-1">진행중인 이벤트와 참가자 현황을 확인하세요</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="card__body">
            <div className="text-sm text-[var(--muted)]">전체 이벤트</div>
            <div className="text-2xl font-bold mt-1">{events.length}</div>
          </div>
        </div>
        <div className="card">
          <div className="card__body">
            <div className="text-sm text-[var(--muted)]">진행중</div>
            <div className="text-2xl font-bold mt-1 text-green-600">
              {events.filter((e) => getDerivedStatus(e) === 'ONGOING').length}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card__body">
            <div className="text-sm text-[var(--muted)]">예정</div>
            <div className="text-2xl font-bold mt-1 text-yellow-600">
              {events.filter((e) => getDerivedStatus(e) === 'PENDING').length}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card__body">
            <div className="text-sm text-[var(--muted)]">완료</div>
            <div className="text-2xl font-bold mt-1 text-gray-600">
              {events.filter((e) => getDerivedStatus(e) === 'COMPLETED').length}
            </div>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card">
              <div className="card__body">
                <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && !error && events.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {events.map((event) => (
            <div key={event.eventId} className="card hover:shadow-lg transition-shadow">
              <div className="card__body">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold mb-1">{event.name}</h3>
                    <p className="text-sm text-[var(--muted)] line-clamp-2">{event.description}</p>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadgeColor(
                      (event.derivedStatus || event.status || 'PENDING') as string,
                    )}`}
                  >
                    {getStatusLabel((event.derivedStatus || event.status || 'PENDING') as string)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div>
                    <div className="text-[var(--muted)]">일정</div>
                    <div className="font-medium mt-1">
                      {formatDate(event.startDate)} - {formatDate(event.endDate)}
                    </div>
                    <div className="text-xs text-[var(--muted)] mt-1">
                      {calculateDays(event.startDate, event.endDate)}일간
                    </div>
                  </div>
                  <div>
                    <div className="text-[var(--muted)]">일일 수당</div>
                    <div className="font-medium mt-1">${event.amountPerDay} USDC</div>
                    <div className="text-xs text-[var(--muted)] mt-1">
                      총 ${Number(event.amountPerDay) * calculateDays(event.startDate, event.endDate)} USDC
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2 text-sm">
                    <span className="text-[var(--muted)]">참가자</span>
                    <span className="font-medium">
                      {0} / {event.maxParticipants}명
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-[var(--brand)] h-2 rounded-full transition-all"
                      style={{ width: `${Math.round((0 / (event.maxParticipants || 1)) * 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-1">0% 등록</div>
                </div>

                <div className="mt-4 pt-4 border-t">
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/dashboard/${event.eventId}`);
                    }}
                  >
                    상세 보기 →
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && error && (
        <div className="card">
          <div className="card__body text-center py-12">
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
