'use client';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import EventDetailClient from '@/app/(admin)/events/[eventId]/EventDetailClient';

interface EventData {
  id: number;
  eventId: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  amountPerDay: string;
  maxParticipants: number;
  currentParticipants?: number;
  status: 'PENDING' | 'ONGOING' | 'COMPLETED';
  is_active: boolean;
}

// Mock data for UI skeleton
const MOCK_EVENTS: EventData[] = [
  {
    id: 1,
    eventId: 'evt_001',
    name: 'Climate Change Adaptation Workshop',
    description: 'Training on climate resilience strategies for local communities',
    startDate: '2025-01-20',
    endDate: '2025-01-22',
    amountPerDay: '150',
    maxParticipants: 50,
    currentParticipants: 32,
    status: 'ONGOING',
    is_active: true,
  },
  {
    id: 2,
    eventId: 'evt_002',
    name: 'Digital Literacy Training',
    description: 'Basic computer and internet skills for youth empowerment',
    startDate: '2025-01-25',
    endDate: '2025-01-27',
    amountPerDay: '120',
    maxParticipants: 30,
    currentParticipants: 28,
    status: 'PENDING',
    is_active: true,
  },
  {
    id: 3,
    eventId: 'evt_003',
    name: 'Agricultural Development Seminar',
    description: 'Sustainable farming techniques and market access strategies',
    startDate: '2025-01-10',
    endDate: '2025-01-12',
    amountPerDay: '100',
    maxParticipants: 40,
    currentParticipants: 40,
    status: 'COMPLETED',
    is_active: true,
  },
];

export default function DashboardPage() {
  const [events] = useState<EventData[]>(MOCK_EVENTS);
  const [isLoading] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // 실제 구현시 API 호출
  // useEffect(() => {
  //   fetch('/api/admin/events')
  //     .then(res => res.json())
  //     .then(data => setEvents(data.events))
  // }, []);

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

  const calculateProgress = (current?: number, max?: number) => {
    if (!current || !max) return 0;
    return Math.round((current / max) * 100);
  };

  // 선택된 이벤트가 있으면 EventDetailClient 컴포넌트 표시
  if (selectedEventId) {
    return <EventDetailClient eventId={selectedEventId} onBack={() => setSelectedEventId(null)} />;
  }

  return (
    <div className="max-w-screen-2xl mx-auto">
      {/* Page Header */}
      <div className="mb-6 lg:mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-[var(--text)]">대시보드</h1>
            <p className="text-sm lg:text-base text-[var(--muted)] mt-1">진행중인 이벤트와 참가자 현황을 확인하세요</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
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
              {events.filter((e) => e.status === 'ONGOING').length}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card__body">
            <div className="text-sm text-[var(--muted)]">예정</div>
            <div className="text-2xl font-bold mt-1 text-yellow-600">
              {events.filter((e) => e.status === 'PENDING').length}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card__body">
            <div className="text-sm text-[var(--muted)]">완료</div>
            <div className="text-2xl font-bold mt-1 text-gray-600">
              {events.filter((e) => e.status === 'COMPLETED').length}
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
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

      {/* Events Grid */}
      {!isLoading && events.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {events.map((event) => (
            <div
              key={event.eventId}
              className="card hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => setSelectedEventId(event.eventId)}
            >
              <div className="card__body">
                {/* Event Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold mb-1">{event.name}</h3>
                    <p className="text-sm text-[var(--muted)] line-clamp-2">{event.description}</p>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadgeColor(
                      event.status,
                    )}`}
                  >
                    {getStatusLabel(event.status)}
                  </span>
                </div>

                {/* Event Info */}
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

                {/* Participants Progress */}
                <div>
                  <div className="flex justify-between items-center mb-2 text-sm">
                    <span className="text-[var(--muted)]">참가자</span>
                    <span className="font-medium">
                      {event.currentParticipants || 0} / {event.maxParticipants}명
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-[var(--brand)] h-2 rounded-full transition-all"
                      style={{
                        width: `${calculateProgress(event.currentParticipants, event.maxParticipants)}%`,
                      }}
                    />
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-1">
                    {calculateProgress(event.currentParticipants, event.maxParticipants)}% 등록
                  </div>
                </div>

                {/* Action Button */}
                <div className="mt-4 pt-4 border-t">
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEventId(event.eventId);
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

      {/* Empty State */}
      {!isLoading && events.length === 0 && (
        <div className="card">
          <div className="card__body text-center py-12">
            <div className="text-6xl mb-4">📅</div>
            <h3 className="text-lg font-bold mb-2">등록된 이벤트가 없습니다</h3>
            <p className="text-[var(--muted)]">관리자가 새로운 이벤트를 등록하면 여기에 표시됩니다</p>
          </div>
        </div>
      )}
    </div>
  );
}
