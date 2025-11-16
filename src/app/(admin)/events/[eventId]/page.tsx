'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

type EventStatus = 'DRAFT' | 'SCHEDULED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';

interface Props {
  params: { eventId: string };
}

export default function EventDetailPage({ params }: Props) {
  const [tab, setTab] = useState<'overview' | 'staff' | 'participants' | 'checkins'>('overview');
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [addStaffRole, setAddStaffRole] = useState<'APPROVER' | 'VERIFIER'>('APPROVER');
  const [addStaffQuery, setAddStaffQuery] = useState('');

  // ESC to close modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowAddStaff(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Mock skeleton data (static)
  const event = {
    eventId: params.eventId,
    name: 'Workshop 2025',
    status: 'SCHEDULED' as EventStatus,
    location: 'Monrovia',
    startDate: '2025-12-01',
    endDate: '2025-12-02',
    createdAt: '2025-11-10T00:00:00Z',
  };

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
      {/* Header */}
      <div className="mb-6 lg:mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl lg:text-3xl font-bold text-[var(--text)]">{event.name}</h1>
              <span
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${statusBadge(event.status)}`}
              >
                {event.status}
              </span>
            </div>
            <p className="text-sm lg:text-base text-[var(--muted)] mt-1">
              ID: {event.eventId} · {event.location || '(위치 미정)'} · {formatDate(event.startDate)} ~{' '}
              {formatDate(event.endDate)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/events">
              <Button variant="secondary">목록으로</Button>
            </Link>
            <Button variant="secondary">편집</Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card mb-4 lg:mb-6">
        <div className="card__body">
          <div className="flex gap-2 overflow-auto">
            {(
              [
                ['overview', '개요'],
                ['staff', '스태프'],
                ['participants', '참가자'],
                ['checkins', '체크인'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                className={`btn btn--secondary btn--sm ${tab === key ? 'border-[var(--brand)]' : ''}`}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Panels */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card">
            <div className="card__header">세부 정보</div>
            <div className="card__body">
              <div className="space-y-3 text-sm text-[var(--muted)]">
                <div>이벤트 ID: {event.eventId}</div>
                <div>위치: {event.location || '(위치 미정)'}</div>
                <div>
                  기간: {formatDate(event.startDate)} ~ {formatDate(event.endDate)}
                </div>
                <div>생성일: {formatDate(event.createdAt)}</div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card__header">최근 활동</div>
            <div className="card__body">
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'staff' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">스태프</h2>
            <Button onClick={() => setShowAddStaff(true)}>+ 관리자 추가</Button>
          </div>
          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="table min-w-[720px]">
              <thead>
                <tr>
                  <th>관리자</th>
                  <th>역할</th>
                  <th>상태</th>
                  <th>할당일</th>
                  <th>액션</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map((i) => (
                  <tr key={i}>
                    <td>
                      <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
                    </td>
                    <td>
                      <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                    </td>
                    <td>
                      <div className="h-6 w-20 bg-gray-100 rounded-full animate-pulse" />
                    </td>
                    <td>
                      <div className="h-4 w-28 bg-gray-100 rounded animate-pulse" />
                    </td>
                    <td>
                      <div className="h-8 w-32 bg-gray-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="lg:hidden space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card">
                <div className="card__body space-y-3">
                  <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
                  <div className="flex gap-2">
                    <div className="h-6 w-20 bg-gray-100 rounded-full animate-pulse" />
                    <div className="h-6 w-20 bg-gray-100 rounded-full animate-pulse" />
                  </div>
                  <div className="h-8 w-32 bg-gray-100 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'participants' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">참가자</h2>
            <div className="flex gap-2">
              <Button variant="secondary">가져오기</Button>
              <Button>+ 참가자 등록</Button>
            </div>
          </div>
          <div className="hidden lg:block overflow-x-auto">
            <table className="table min-w-[820px]">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>지갑/DID</th>
                  <th>KYC</th>
                  <th>상태</th>
                  <th>액션</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4].map((i) => (
                  <tr key={i}>
                    <td>
                      <div className="h-4 w-36 bg-gray-100 rounded animate-pulse" />
                    </td>
                    <td>
                      <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
                    </td>
                    <td>
                      <div className="h-6 w-20 bg-gray-100 rounded-full animate-pulse" />
                    </td>
                    <td>
                      <div className="h-6 w-24 bg-gray-100 rounded-full animate-pulse" />
                    </td>
                    <td>
                      <div className="h-8 w-32 bg-gray-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="lg:hidden space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card">
                <div className="card__body space-y-3">
                  <div className="h-4 w-36 bg-gray-100 rounded animate-pulse" />
                  <div className="h-4 w-56 bg-gray-100 rounded animate-pulse" />
                  <div className="flex gap-2">
                    <div className="h-6 w-24 bg-gray-100 rounded-full animate-pulse" />
                    <div className="h-6 w-20 bg-gray-100 rounded-full animate-pulse" />
                  </div>
                  <div className="h-8 w-32 bg-gray-100 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'checkins' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">체크인</h2>
            <Button variant="secondary">내보내기</Button>
          </div>
          <div className="hidden lg:block overflow-x-auto">
            <table className="table min-w-[820px]">
              <thead>
                <tr>
                  <th>시간</th>
                  <th>참가자</th>
                  <th>확인자</th>
                  <th>방법</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i}>
                    <td>
                      <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
                    </td>
                    <td>
                      <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
                    </td>
                    <td>
                      <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
                    </td>
                    <td>
                      <div className="h-6 w-20 bg-gray-100 rounded-full animate-pulse" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="lg:hidden space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card">
                <div className="card__body space-y-3">
                  <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
                  <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
                  <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
                  <div className="h-6 w-20 bg-gray-100 rounded-full animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Staff Modal (skeleton) */}
      {showAddStaff && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-staff-title"
          className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/40"
          onClick={() => setShowAddStaff(false)}
        >
          <div className="card w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
            <div className="card__header" id="add-staff-title">
              이벤트 스태프 추가
            </div>
            <div className="card__body">
              <div className="grid gap-4">
                <div>
                  <Input
                    type="text"
                    label="관리자 검색"
                    placeholder="이름, 아이디, 이메일"
                    value={addStaffQuery}
                    onChange={(e) => setAddStaffQuery(e.target.value)}
                  />
                  {/* 검색 결과 스켈레톤 */}
                  <div className="mt-3 space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                    ))}
                  </div>
                </div>
                <div>
                  <Select
                    label="역할"
                    value={addStaffRole}
                    onChange={(e) => setAddStaffRole(e.target.value as 'APPROVER' | 'VERIFIER')}
                  >
                    <option value="APPROVER">Approver</option>
                    <option value="VERIFIER">Verifier</option>
                  </Select>
                </div>
                <div className="text-sm text-[var(--muted)]">
                  💡 선택한 관리자는 이 이벤트에 지정한 역할로 할당됩니다.
                </div>
              </div>
            </div>
            <div className="card__footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setShowAddStaff(false)}>
                취소
              </Button>
              <Button disabled>할당</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
