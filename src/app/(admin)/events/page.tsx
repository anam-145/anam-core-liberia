'use client';
import Link from 'next/link';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

type EventStatus = 'DRAFT' | 'SCHEDULED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
type TokenType = 'CUSTOM_ERC20' | 'USDC' | 'USDT';

interface EventItem {
  eventId: string;
  name: string;
  status: EventStatus;
  location: string | null;
  startDate: string; // ISO
  endDate: string; // ISO
  tokenType: TokenType;
  createdAt: string; // ISO
}

const MOCK_EVENTS: EventItem[] = [
  {
    eventId: 'evt_1',
    name: 'Workshop 2025',
    status: 'SCHEDULED',
    location: 'Monrovia',
    startDate: '2025-12-01',
    endDate: '2025-12-02',
    tokenType: 'USDC',
    createdAt: '2025-11-10T00:00:00Z',
  },
  {
    eventId: 'evt_2',
    name: 'Distribution Day',
    status: 'ONGOING',
    location: 'Buchanan',
    startDate: '2025-11-13',
    endDate: '2025-11-15',
    tokenType: 'CUSTOM_ERC20',
    createdAt: '2025-11-01T00:00:00Z',
  },
  {
    eventId: 'evt_3',
    name: 'Training Session',
    status: 'DRAFT',
    location: null,
    startDate: '2026-01-05',
    endDate: '2026-01-05',
    tokenType: 'USDT',
    createdAt: '2025-11-12T00:00:00Z',
  },
];

export default function EventsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<EventStatus | 'ALL'>('ALL');
  const [tokenFilter, setTokenFilter] = useState<TokenType | 'ALL'>('ALL');

  // Mock loading/empty/error states (skeleton only)
  const isLoading = false;
  const isEmpty = false;
  const hasError = false;

  const filtered = MOCK_EVENTS.filter((ev) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q || ev.name.toLowerCase().includes(q) || ev.location?.toLowerCase().includes(q) || ev.eventId.includes(q);
    const matchesStatus = statusFilter === 'ALL' || ev.status === statusFilter;
    const matchesToken = tokenFilter === 'ALL' || ev.tokenType === tokenFilter;
    return matchesSearch && matchesStatus && matchesToken;
  });

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const statusBadge = (status: EventStatus) => {
    const map: Record<EventStatus, string> = {
      DRAFT: 'bg-gray-50 text-gray-700 border-gray-200',
      SCHEDULED: 'bg-blue-50 text-blue-700 border-blue-200',
      ONGOING: 'bg-amber-50 text-amber-700 border-amber-200',
      COMPLETED: 'bg-green-50 text-green-700 border-green-200',
      CANCELLED: 'bg-red-50 text-red-700 border-red-200',
    };
    return map[status];
  };

  return (
    <div className="max-w-screen-2xl mx-auto">
      {/* Page Header */}
      <div className="mb-6 lg:mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-[var(--text)]">이벤트</h1>
            <p className="text-sm lg:text-base text-[var(--muted)] mt-1">워크숍/트레이닝/배포 이벤트 관리</p>
          </div>
          <Link href="/events/new">
            <Button>+ 새 이벤트</Button>
          </Link>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card mb-4 lg:mb-6">
        <div className="card__body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <Input
              type="text"
              placeholder="이벤트명, 위치, ID 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {/* Status Filter */}
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as EventStatus | 'ALL')}>
              <option value="ALL">모든 상태</option>
              <option value="DRAFT">Draft</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="ONGOING">Ongoing</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>

            {/* Token Filter */}
            <Select value={tokenFilter} onChange={(e) => setTokenFilter(e.target.value as TokenType | 'ALL')}>
              <option value="ALL">모든 토큰</option>
              <option value="CUSTOM_ERC20">Custom ERC20</option>
              <option value="USDC">USDC</option>
              <option value="USDT">USDT</option>
            </Select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
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

      {/* Empty State */}
      {isEmpty && !isLoading && (
        <div className="card">
          <div className="card__body text-center py-12">
            <p className="text-[var(--muted)] mb-4">아직 이벤트가 없습니다.</p>
            <Link href="/events/new">
              <Button>+ 새 이벤트 만들기</Button>
            </Link>
          </div>
        </div>
      )}

      {/* Error State */}
      {hasError && !isLoading && (
        <div className="card">
          <div className="card__body text-center py-12">
            <p className="text-red-600 mb-4">문제가 발생했어요.</p>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              다시 시도
            </Button>
          </div>
        </div>
      )}

      {/* Desktop Table */}
      {!isLoading && !isEmpty && !hasError && (
        <>
          <div className="hidden lg:block overflow-x-auto">
            <table className="table min-w-[820px]">
              <thead>
                <tr>
                  <th>이벤트</th>
                  <th>상태</th>
                  <th>기간</th>
                  <th>토큰</th>
                  <th>생성일</th>
                  <th>액션</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ev) => (
                  <tr key={ev.eventId}>
                    <td>
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: 2 }}>{ev.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{ev.location || '(위치 미정)'}</div>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${statusBadge(ev.status)}`}
                      >
                        {ev.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--muted)' }}>
                      {formatDate(ev.startDate)} ~ {formatDate(ev.endDate)}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--muted)' }}>{ev.tokenType}</td>
                    <td style={{ fontSize: 13, color: 'var(--muted)' }}>{formatDate(ev.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Button variant="secondary" size="sm">
                          상세
                        </Button>
                        <Button variant="secondary" size="sm">
                          스태프
                        </Button>
                        <Button variant="secondary" size="sm">
                          참가자
                        </Button>
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
                      <div style={{ fontSize: 13, color: 'var(--muted)' }}>{ev.location || '(위치 미정)'}</div>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${statusBadge(ev.status)}`}
                    >
                      {ev.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
                    <div>
                      기간: {formatDate(ev.startDate)} ~ {formatDate(ev.endDate)}
                    </div>
                    <div>토큰: {ev.tokenType}</div>
                    <div>생성일: {formatDate(ev.createdAt)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button variant="secondary">상세</Button>
                    <Button variant="secondary">스태프</Button>
                    <Button variant="secondary">참가자</Button>
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
