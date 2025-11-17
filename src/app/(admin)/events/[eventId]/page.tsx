'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

type EventStatus = 'PENDING' | 'ONGOING' | 'COMPLETED';

interface Props {
  params: { eventId: string };
}

export default function EventDetailPage({ params }: Props) {
  const eventId = params.eventId;
  const [tab, setTab] = useState<'overview' | 'staff' | 'participants' | 'checkins' | 'payments'>('overview');
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [addStaffRole, setAddStaffRole] = useState<'APPROVER' | 'VERIFIER'>('VERIFIER');
  const [addStaffQuery, setAddStaffQuery] = useState('');
  const [admins, setAdmins] = useState<
    Array<{
      id: number;
      adminId: string;
      username: string;
      fullName: string;
      role: 'SYSTEM_ADMIN' | 'STAFF';
      email: string | null;
    }>
  >([]);
  const [selectedAdminId, setSelectedAdminId] = useState<string>('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [assignFieldErrors, setAssignFieldErrors] = useState<Record<string, string>>({});
  const [staffRows, setStaffRows] = useState<
    Array<{
      adminId: string;
      fullName: string;
      username: string;
      email: string | null;
      eventRole: 'APPROVER' | 'VERIFIER';
      assignedAt: string;
      updating?: boolean;
    }>
  >([]);
  const [staffError, setStaffError] = useState('');
  const [hasApprover, setHasApprover] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activateMsg, setActivateMsg] = useState('');
  const [activateError, setActivateError] = useState(false);
  const [eventActive, setEventActive] = useState<boolean | null>(null);

  // ESC to close modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowAddStaff(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Load eligible admins when modal opens (SYSTEM_ADMIN only API)
  useEffect(() => {
    if (!showAddStaff) return;
    (async () => {
      try {
        const adminsRes = await fetch(`/api/admin/admins?eligibleForEvent=${eventId}`, { cache: 'no-store' });
        if (!adminsRes.ok) return;
        const adminsData = (await adminsRes.json()) as {
          admins: Array<{
            id: number;
            adminId: string;
            username: string;
            fullName: string;
            role: 'SYSTEM_ADMIN' | 'STAFF';
            email: string | null;
          }>;
        };
        setAdmins(adminsData.admins || []);
      } catch {
        // ignore in skeleton
      }
    })();
  }, [showAddStaff, eventId]);

  // Mock skeleton data (static)
  const event = {
    eventId: params.eventId,
    name: 'Workshop 2025',
    status: 'PENDING' as EventStatus,
    startDate: '2025-12-01',
    endDate: '2025-12-02',
    createdAt: '2025-11-10T00:00:00Z',
    description: '',
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const statusBadge = (status: EventStatus) => {
    const map: Record<EventStatus, string> = {
      PENDING: 'bg-blue-50 text-blue-700 border-blue-200',
      ONGOING: 'bg-amber-50 text-amber-700 border-amber-200',
      COMPLETED: 'bg-green-50 text-green-700 border-green-200',
    };
    return map[status];
  };

  // Load event active state
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/events/${eventId}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error();
        if (!cancelled) setEventActive(Boolean(data?.event?.isActive));
      } catch {
        if (!cancelled) setEventActive(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  // Check hasApprover for activation gating (lightweight fetch)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/events/${eventId}/staff`, { cache: 'no-store' });
        if (!res.ok) return setHasApprover(false);
        const data = (await res.json()) as { staff: Array<{ eventRole: 'APPROVER' | 'VERIFIER' }> };
        setHasApprover((data.staff || []).some((s) => s.eventRole === 'APPROVER'));
      } catch {
        setHasApprover(false);
      }
    })();
  }, [eventId, showAddStaff, tab]);

  async function handleToggleEvent(nextActive: boolean) {
    setActivateMsg('');
    setActivating(true);
    try {
      const res = await fetch(`/api/admin/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActivateError(true);
        throw new Error(data?.error || (nextActive ? '활성화에 실패했습니다' : '비활성화에 실패했습니다'));
      }
      setActivateError(false);
      setActivateMsg(nextActive ? '이벤트가 활성화되었습니다.' : '이벤트가 비활성화되었습니다.');
      setEventActive(nextActive);
    } catch (e) {
      setActivateMsg(e instanceof Error ? e.message : '활성화에 실패했습니다');
    } finally {
      setActivating(false);
    }
  }

  // Load staff list when staff tab active
  useEffect(() => {
    if (tab !== 'staff') return;
    (async () => {
      setStaffError('');
      try {
        const [staffRes, adminsRes] = await Promise.all([
          fetch(`/api/admin/events/${eventId}/staff`, { cache: 'no-store' }),
          fetch('/api/admin/admins', { cache: 'no-store' }),
        ]);
        if (!staffRes.ok) {
          const data = await staffRes.json().catch(() => ({}));
          throw new Error(data?.error || '스태프 목록을 불러오지 못했습니다');
        }
        const staffData = (await staffRes.json()) as {
          staff: Array<{ adminId: string; eventRole: 'APPROVER' | 'VERIFIER'; assignedAt: string }>;
        };
        const adminsData = adminsRes.ok
          ? ((await adminsRes.json()) as {
              admins: Array<{ adminId: string; fullName: string; username: string; email: string | null }>;
            })
          : { admins: [] };
        const amap = new Map(adminsData.admins.map((a) => [a.adminId, a] as const));
        const merged = staffData.staff.map((s) => {
          const a = amap.get(s.adminId);
          return {
            adminId: s.adminId,
            fullName: a?.fullName || s.adminId,
            username: a?.username || '-',
            email: a?.email || null,
            eventRole: s.eventRole,
            assignedAt: s.assignedAt,
          };
        });
        setStaffRows(merged);
      } catch (e) {
        setStaffError(e instanceof Error ? e.message : '오류가 발생했습니다');
      }
    })();
  }, [tab, eventId]);

  // Update role helper
  async function updateStaffRole(eventId: string, adminId: string, role: 'APPROVER' | 'VERIFIER') {
    setStaffRows((list) => list.map((r) => (r.adminId === adminId ? { ...r, updating: true } : r)));
    try {
      const res = await fetch(`/api/admin/events/${eventId}/staff/${adminId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventRole: role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || '역할 변경에 실패했습니다');
      setStaffRows((list) => list.map((r) => (r.adminId === adminId ? { ...r, eventRole: role, updating: false } : r)));
    } catch (e) {
      setStaffError(e instanceof Error ? e.message : '오류가 발생했습니다');
      setStaffRows((list) => list.map((r) => (r.adminId === adminId ? { ...r, updating: false } : r)));
    }
  }

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
              ID: {event.eventId} · {formatDate(event.startDate)} ~ {formatDate(event.endDate)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/events">
              <Button variant="secondary">목록으로</Button>
            </Link>
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
                ['staff', '관리자'],
                ['participants', '참가자'],
                ['checkins', '체크인'],
                ['payments', '지급'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                className={`btn btn--sm ${tab === key ? 'btn--primary' : 'btn--secondary'}`}
                aria-pressed={tab === key}
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Basic details */}
          <div className="lg:col-span-2 grid grid-cols-1 gap-4">
            <div className="card">
              <div className="card__header">세부 정보</div>
              <div className="card__body">
                <div className="space-y-3 text-sm text-[var(--muted)]">
                  <div>이벤트 ID: {event.eventId}</div>
                  <div>
                    기간: {formatDate(event.startDate)} ~ {formatDate(event.endDate)}
                  </div>
                  <div>생성일: {formatDate(event.createdAt)}</div>
                  <div>
                    내용:{' '}
                    {event.description ? (
                      <span className="text-[var(--text)]">{event.description}</span>
                    ) : (
                      <span>-</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 역할/권한 표 */}
            <div className="card">
              <div className="card__header">역할/권한</div>
              <div className="card__body">
                <div className="overflow-x-auto">
                  <table className="table min-w-[680px]">
                    <thead>
                      <tr>
                        <th>기능</th>
                        <th>System Admin</th>
                        <th>Approver</th>
                        <th>Verifier</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>이벤트 생성/수정/활성화/비활성/배정/해제</td>
                        <td>✓ 허용</td>
                        <td>-</td>
                        <td>-</td>
                      </tr>
                      <tr>
                        <td>참가자 등록</td>
                        <td>✓ 허용</td>
                        <td>✓ 허용</td>
                        <td>✓ 허용</td>
                      </tr>
                      <tr>
                        <td>체크인 (1차 승인)</td>
                        <td>✓ 허용</td>
                        <td>✓ 허용</td>
                        <td>✓ 허용</td>
                      </tr>
                      <tr>
                        <td>지급 승인 (2차 승인)</td>
                        <td>✓ 허용</td>
                        <td>✓ 허용</td>
                        <td>-</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Admin registration & activation (Skeleton UI only) */}
          <div className="grid grid-cols-1 gap-4">
            <div className="card">
              <div className="card__header">관리자 등록</div>
              <div className="card__body">
                <p className="text-sm text-[var(--muted)] mb-3">
                  배정 가능한 관리자 목록에서 선택하고 역할을 지정해 이 이벤트에 배정할 수 있습니다.
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => setShowAddStaff(true)}>관리자 등록 시작</Button>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card__header">이벤트 활성화</div>
              <div className="card__body">
                <div className="text-sm text-[var(--muted)] mb-2">
                  현재 상태: <strong>{eventActive === null ? '-' : eventActive ? '활성' : '비활성'}</strong>
                </div>
                <div className="text-[12px] text-[var(--muted)] space-y-1">
                  <div>이 이벤트를 활성화하려면 최소 1명의 Approver가 배정되어 있어야 합니다.</div>
                </div>
                <div className="flex gap-2 mt-3 items-center">
                  {eventActive ? (
                    <Button disabled={activating} onClick={() => handleToggleEvent(false)}>
                      {activating ? '비활성화 중...' : '이벤트 비활성화'}
                    </Button>
                  ) : (
                    <Button disabled={!hasApprover || activating} onClick={() => handleToggleEvent(true)}>
                      {activating ? '활성화 중...' : '이벤트 활성화'}
                    </Button>
                  )}
                </div>
                {activateMsg && (
                  <div className={`text-[12px] mt-2 ${activateError ? 'text-red-600' : 'text-green-600'}`}>
                    {activateMsg}
                  </div>
                )}
                {!hasApprover && !eventActive && (
                  <div className="text-[12px] text-red-600 mt-2">
                    Approver가 1명 이상 배정되어야 활성화할 수 있습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'staff' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">관리자</h2>
          </div>
          {staffError && (
            <div className="text-[13px] p-3 rounded-lg border border-red-200 bg-red-50 text-red-700">{staffError}</div>
          )}
          <div className="hidden lg:block overflow-x-auto">
            <table className="table min-w-[720px]">
              <thead>
                <tr>
                  <th>관리자</th>
                  <th>역할</th>
                  <th>할당일</th>
                  <th>액션</th>
                </tr>
              </thead>
              <tbody>
                {staffRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center text-[var(--muted)]">
                      등록된 관리자가 없습니다.
                    </td>
                  </tr>
                ) : (
                  staffRows.map((r) => (
                    <tr key={r.adminId}>
                      <td>
                        <div>
                          <div style={{ fontWeight: 700, marginBottom: 2 }}>{r.fullName}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                            {r.username}
                            {r.email ? ` · ${r.email}` : ''}
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 13 }}>{r.eventRole}</td>
                      <td style={{ fontSize: 13, color: 'var(--muted)' }}>{new Date(r.assignedAt).toLocaleString()}</td>
                      <td>
                        <div style={{ minWidth: 180 }}>
                          <Select
                            label={undefined as unknown as string}
                            value={r.eventRole}
                            onChange={(e) =>
                              updateStaffRole(event.eventId, r.adminId, e.target.value as 'VERIFIER' | 'APPROVER')
                            }
                            disabled={r.updating}
                          >
                            <option value="VERIFIER">Verifier</option>
                            <option value="APPROVER">Approver</option>
                          </Select>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="lg:hidden space-y-3">
            {staffRows.length === 0 ? (
              <div className="card">
                <div className="card__body text-center text-[var(--muted)]">등록된 관리자가 없습니다.</div>
              </div>
            ) : (
              staffRows.map((r) => (
                <div key={r.adminId} className="card">
                  <div className="card__body space-y-3">
                    <div style={{ fontWeight: 700 }}>{r.fullName}</div>
                    <div className="text-[12px] text-[var(--muted)]">
                      {r.username}
                      {r.email ? ` · ${r.email}` : ''}
                    </div>
                    <div className="text-[12px]">역할: {r.eventRole}</div>
                    <div>
                      <Select
                        label={undefined as unknown as string}
                        value={r.eventRole}
                        onChange={(e) =>
                          updateStaffRole(event.eventId, r.adminId, e.target.value as 'VERIFIER' | 'APPROVER')
                        }
                        disabled={r.updating}
                      >
                        <option value="VERIFIER">Verifier</option>
                        <option value="APPROVER">Approver</option>
                      </Select>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'participants' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">참가자</h2>
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

      {tab === 'payments' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">지급</h2>
          </div>
          <div className="hidden lg:block overflow-x-auto">
            <table className="table min-w-[820px]">
              <thead>
                <tr>
                  <th>시간</th>
                  <th>참가자</th>
                  <th>승인자</th>
                  <th>금액</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4].map((i) => (
                  <tr key={i}>
                    <td>
                      <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
                    </td>
                    <td>
                      <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
                    </td>
                    <td>
                      <div className="h-4 w-36 bg-gray-100 rounded animate-pulse" />
                    </td>
                    <td>
                      <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
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
                  <div className="h-4 w-36 bg-gray-100 rounded animate-pulse" />
                  <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
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
              {assignError && (
                <div className="text-[13px] p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 mb-3">
                  {assignError}
                </div>
              )}
              {(() => {
                const baseAvailable = (admins || []).filter((a) => a.role === 'STAFF');
                if (baseAvailable.length === 0) {
                  return <div className="text-sm text-[var(--muted)]">등록할 관리자가 더 이상 없습니다.</div>;
                }
                const filtered = baseAvailable.filter((a) => {
                  const q = addStaffQuery.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    a.fullName.toLowerCase().includes(q) ||
                    a.username.toLowerCase().includes(q) ||
                    (a.email || '').toLowerCase().includes(q)
                  );
                });
                return (
                  <div className="grid gap-4">
                    <div>
                      <Input
                        type="text"
                        label="관리자 검색"
                        placeholder="이름, 아이디, 이메일"
                        value={addStaffQuery}
                        onChange={(e) => setAddStaffQuery(e.target.value)}
                      />
                      <div className="mt-3 space-y-2 max-h-72 overflow-auto">
                        {filtered.length === 0 ? (
                          <div className="text-[12px] text-[var(--muted)]">검색 결과가 없습니다.</div>
                        ) : (
                          filtered.map((a) => (
                            <label
                              key={a.adminId}
                              className="flex items-center justify-between gap-3 p-2 border rounded-lg cursor-pointer hover:bg-gray-50"
                            >
                              <div>
                                <div className="font-medium">{a.fullName}</div>
                                <div className="text-[12px] text-[var(--muted)]">
                                  {a.username}
                                  {a.email ? ` · ${a.email}` : ''}
                                </div>
                              </div>
                              <input
                                type="radio"
                                name="selectedAdmin"
                                checked={selectedAdminId === a.adminId}
                                onChange={() => {
                                  setSelectedAdminId(a.adminId);
                                  if (assignFieldErrors.admin) setAssignFieldErrors((s) => ({ ...s, admin: '' }));
                                }}
                              />
                            </label>
                          ))
                        )}
                      </div>
                      {assignFieldErrors.admin && (
                        <div className="text-red-600 text-[12px] mt-1">{assignFieldErrors.admin}</div>
                      )}
                    </div>
                    <div>
                      <Select
                        label="역할"
                        value={addStaffRole}
                        onChange={(e) => {
                          setAddStaffRole(e.target.value as 'APPROVER' | 'VERIFIER');
                          if (assignFieldErrors.role) setAssignFieldErrors((s) => ({ ...s, role: '' }));
                        }}
                      >
                        <option value="VERIFIER">Verifier</option>
                        <option value="APPROVER">Approver</option>
                      </Select>
                      {assignFieldErrors.role && (
                        <div className="text-red-600 text-[12px] mt-1">{assignFieldErrors.role}</div>
                      )}
                    </div>
                    <div className="text-sm text-[var(--muted)]">
                      💡 선택한 관리자는 이 이벤트에 지정한 역할로 할당됩니다.
                    </div>
                  </div>
                );
              })()}
            </div>
            {(() => {
              const baseAvailable = (admins || []).filter((a) => a.role === 'STAFF');
              if (baseAvailable.length === 0) {
                return (
                  <div className="card__footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <Button variant="secondary" onClick={() => setShowAddStaff(false)}>
                      닫기
                    </Button>
                  </div>
                );
              }
              return (
                <div className="card__footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <Button variant="secondary" onClick={() => setShowAddStaff(false)}>
                    취소
                  </Button>
                  <Button
                    disabled={assigning}
                    onClick={async () => {
                      // Reset errors
                      setAssignError('');
                      setAssignFieldErrors({});
                      // Client-side validation
                      const fe: Record<string, string> = {};
                      if (!selectedAdminId) fe.admin = '관리자를 선택해 주세요.';
                      if (!addStaffRole) fe.role = '역할을 선택해 주세요.';
                      if (Object.keys(fe).length > 0) {
                        setAssignFieldErrors(fe);
                        setAssignError('입력값을 확인해 주세요.');
                        return;
                      }

                      setAssigning(true);
                      try {
                        const res = await fetch(`/api/admin/events/${event.eventId}/staff`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ adminId: selectedAdminId, eventRole: addStaffRole }),
                        });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) {
                          const msg = data?.error || '할당에 실패했습니다.';
                          const feServer: Record<string, string> = {};
                          const lower = (msg as string).toLowerCase();
                          if (lower.includes('adminid')) feServer.admin = '관리자를 선택해 주세요.';
                          if (lower.includes('eventrole')) feServer.role = '역할을 선택해 주세요.';
                          if (res.status === 409) feServer.admin = '이미 이 이벤트에 배정된 관리자입니다.';
                          setAssignFieldErrors(feServer);
                          setAssignError(msg);
                        } else {
                          setShowAddStaff(false);
                          setSelectedAdminId('');
                        }
                      } finally {
                        setAssigning(false);
                      }
                    }}
                  >
                    {assigning ? '할당 중...' : '할당'}
                  </Button>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
