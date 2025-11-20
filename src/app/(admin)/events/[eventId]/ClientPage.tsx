'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import ProgressModal from '@/components/ui/ProgressModal';

type EventStatus = 'PENDING' | 'ONGOING' | 'COMPLETED';

interface Props {
  params: { eventId: string };
}

export default function ClientPage({ params }: Props) {
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
  // Progress modal for long-running assign/revoke actions
  const [progressOpen, setProgressOpen] = useState(false);
  const [progressMsg, setProgressMsg] = useState('Processing...');
  const [progressDone, setProgressDone] = useState(false);

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

  const formatDate = (iso: string) => new Date(iso).toISOString().slice(0, 10) + ' UTC';

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
        throw new Error(data?.error || (nextActive ? 'Failed to activate event' : 'Failed to deactivate event'));
      }
      setActivateError(false);
      setActivateMsg(nextActive ? 'Event has been activated.' : 'Event has been deactivated.');
      setEventActive(nextActive);
    } catch (e) {
      setActivateMsg(e instanceof Error ? e.message : 'Failed to update event status');
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
          throw new Error(data?.error || 'Failed to load staff list');
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
        setStaffError(e instanceof Error ? e.message : 'An error occurred while loading staff');
      }
    })();
  }, [tab, eventId]);

  // (Role change UI removed)

  return (
    <div className="max-w-screen-2xl mx-auto">
      <ProgressModal
        open={progressOpen}
        title={progressDone ? 'Completed' : 'Processing'}
        message={progressMsg}
        done={progressDone}
        confirmText="OK"
        onConfirm={() => {
          setProgressOpen(false);
          setProgressDone(false);
        }}
      />
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
              <Button variant="secondary">Back to list</Button>
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
                ['overview', 'Overview'],
                ['staff', 'Staff'],
                ['participants', 'Participants'],
                ['checkins', 'Check-ins'],
                ['payments', 'Payments'],
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
              <div className="card__header">Details</div>
              <div className="card__body">
                <div className="space-y-3 text-sm text-[var(--muted)]">
                  <div>Event ID: {event.eventId}</div>
                  <div>
                    Period: {formatDate(event.startDate)} ~ {formatDate(event.endDate)}
                  </div>
                  <div>Created At: {formatDate(event.createdAt)}</div>
                  <div>
                    Description:{' '}
                    {event.description ? (
                      <span className="text-[var(--text)]">{event.description}</span>
                    ) : (
                      <span>-</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Roles/permissions table */}
            <div className="card">
              <div className="card__header">Roles & Permissions</div>
              <div className="card__body">
                <div className="overflow-x-auto">
                  <table className="table min-w-[680px]">
                    <thead>
                      <tr>
                        <th>Function</th>
                        <th>System Admin</th>
                        <th>Approver</th>
                        <th>Verifier</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Create/modify/activate/deactivate/assign/unassign event</td>
                        <td>✓ Allowed</td>
                        <td>-</td>
                        <td>-</td>
                      </tr>
                      <tr>
                        <td>Register participants</td>
                        <td>✓ Allowed</td>
                        <td>✓ Allowed</td>
                        <td>✓ Allowed</td>
                      </tr>
                      <tr>
                        <td>Check-ins (1st approval)</td>
                        <td>✓ Allowed</td>
                        <td>✓ Allowed</td>
                        <td>✓ Allowed</td>
                      </tr>
                      <tr>
                        <td>Payment approval (2nd approval)</td>
                        <td>✓ Allowed</td>
                        <td>✓ Allowed</td>
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
              <div className="card__header">Assign staff</div>
              <div className="card__body">
                <p className="text-sm text-[var(--muted)] mb-3">
                  Select admins who can be assigned to this event and configure their roles.
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => setShowAddStaff(true)}>Add staff</Button>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card__header">Event activation</div>
              <div className="card__body">
                <div className="text-sm text-[var(--muted)] mb-2">
                  Current status: <strong>{eventActive === null ? '-' : eventActive ? 'Active' : 'Inactive'}</strong>
                </div>
                <div className="text-[12px] text-[var(--muted)] space-y-1">
                  <div>At least one Approver must be assigned before this event can be activated.</div>
                </div>
                <div className="flex gap-2 mt-3 items-center">
                  {eventActive ? (
                    <Button disabled={activating} onClick={() => handleToggleEvent(false)}>
                      {activating ? 'Deactivating...' : 'Deactivate event'}
                    </Button>
                  ) : (
                    <Button disabled={!hasApprover || activating} onClick={() => handleToggleEvent(true)}>
                      {activating ? 'Activating...' : 'Activate event'}
                    </Button>
                  )}
                </div>
                {activateMsg && (
                  <div className={`text-[12px] mt-2 ${activateError ? 'text-red-600' : 'text-green-600'}`}>
                    {activateMsg}
                  </div>
                )}
                {!hasApprover && !eventActive && (
                  <div className="text-[12px] text-red-600 mt-2">At least one Approver is required to activate.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'staff' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Staff</h2>
          </div>
          {staffError && (
            <div className="text-[13px] p-3 rounded-lg border border-red-200 bg-red-50 text-red-700">{staffError}</div>
          )}
          <div className="hidden lg:block overflow-x-auto">
            <table className="table min-w-[720px]">
              <thead>
                <tr>
                  <th>Admin</th>
                  <th>Role</th>
                  <th>Assigned At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staffRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center text-[var(--muted)]">
                      No staff assigned yet.
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
                      <td style={{ fontSize: 13, color: 'var(--muted)' }}>
                        {new Date(r.assignedAt).toISOString().replace('T', ' ').replace('Z', ' UTC')}
                      </td>
                      <td>
                        <div style={{ minWidth: 180 }}>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={async () => {
                              // Progress modal during on-chain revoke
                              setProgressMsg('Removing staff assignment. Please wait...');
                              setProgressDone(false);
                              setProgressOpen(true);
                              setStaffRows((list) =>
                                list.map((x) => (x.adminId === r.adminId ? { ...x, updating: true } : x)),
                              );
                              try {
                                const res = await fetch(`/api/admin/events/${event.eventId}/staff/${r.adminId}`, {
                                  method: 'DELETE',
                                });
                                const data = await res.json().catch(() => ({}));
                                if (!res.ok) throw new Error(data?.error || 'Failed to remove assignment.');
                                setStaffRows((list) => list.filter((x) => x.adminId !== r.adminId));
                                setProgressMsg('Staff assignment removal completed.');
                                setProgressDone(true);
                              } catch (e) {
                                setStaffError(
                                  e instanceof Error ? e.message : 'An error occurred while updating staff',
                                );
                                setStaffRows((list) =>
                                  list.map((x) => (x.adminId === r.adminId ? { ...x, updating: false } : x)),
                                );
                                setProgressOpen(false);
                              }
                            }}
                            disabled={r.updating}
                          >
                            Remove assignment
                          </Button>
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
                <div className="card__body text-center text-[var(--muted)]">No staff assigned yet.</div>
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
                    <div className="text-[12px]">Role: {r.eventRole}</div>
                    <div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={async () => {
                          setProgressMsg('Removing staff assignment. Please wait...');
                          setProgressDone(false);
                          setProgressOpen(true);
                          setStaffRows((list) =>
                            list.map((x) => (x.adminId === r.adminId ? { ...x, updating: true } : x)),
                          );
                          try {
                            const res = await fetch(`/api/admin/events/${event.eventId}/staff/${r.adminId}`, {
                              method: 'DELETE',
                            });
                            const data = await res.json().catch(() => ({}));
                            if (!res.ok) throw new Error(data?.error || 'Failed to remove assignment.');
                            setStaffRows((list) => list.filter((x) => x.adminId !== r.adminId));
                            setProgressMsg('Staff assignment removal completed.');
                            setProgressDone(true);
                          } catch (e) {
                            setStaffError(e instanceof Error ? e.message : 'An error occurred while updating staff');
                            setStaffRows((list) =>
                              list.map((x) => (x.adminId === r.adminId ? { ...x, updating: false } : x)),
                            );
                            setProgressOpen(false);
                          }
                        }}
                        disabled={r.updating}
                      >
                        Remove assignment
                      </Button>
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
            <h2 className="text-lg font-semibold">Participants</h2>
          </div>
          <div className="hidden lg:block overflow-x-auto">
            <table className="table min-w-[820px]">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Wallet/DID</th>
                  <th>KYC</th>
                  <th>Status</th>
                  <th>Actions</th>
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
            <h2 className="text-lg font-semibold">Check-ins</h2>
          </div>
          <div className="hidden lg:block overflow-x-auto">
            <table className="table min-w-[820px]">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Participant</th>
                  <th>Verifier</th>
                  <th>Method</th>
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
            <h2 className="text-lg font-semibold">Payments</h2>
          </div>
          <div className="hidden lg:block overflow-x-auto">
            <table className="table min-w-[820px]">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Participant</th>
                  <th>Approver</th>
                  <th>Amount</th>
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
              Add event staff
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
                  return <div className="text-sm text-[var(--muted)]">There are no more staff to assign.</div>;
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
                        label="Search staff"
                        placeholder="Name, username, email"
                        value={addStaffQuery}
                        onChange={(e) => setAddStaffQuery(e.target.value)}
                      />
                      <div className="mt-3 space-y-2 max-h-72 overflow-auto">
                        {filtered.length === 0 ? (
                          <div className="text-[12px] text-[var(--muted)]">No search results.</div>
                        ) : (
                          filtered.map((a) => {
                            const selected = selectedAdminId === a.adminId;
                            return (
                              <label
                                key={a.adminId}
                                role="radio"
                                aria-checked={selected}
                                className={
                                  `flex items-center justify-between gap-3 p-2 border rounded-lg cursor-pointer transition-colors outline-none focus:outline-none focus-visible:outline-none ` +
                                  `hover:bg-gray-50 ` +
                                  (selected ? `border-[var(--brand)]` : `border-[var(--line)]`)
                                }
                              >
                                <div>
                                  <div className="font-medium">{a.fullName}</div>
                                  <div className="text-[12px] text-[var(--muted)]">
                                    {a.username}
                                    {a.email ? ` · ${a.email}` : ''}
                                  </div>
                                </div>
                                {/* Visually hide the native radio, keep it accessible */}
                                <input
                                  type="radio"
                                  className="sr-only focus:outline-none focus:ring-0"
                                  name="selectedAdmin"
                                  checked={selected}
                                  onChange={() => {
                                    setSelectedAdminId(a.adminId);
                                    if (assignFieldErrors.admin) setAssignFieldErrors((s) => ({ ...s, admin: '' }));
                                  }}
                                />
                              </label>
                            );
                          })
                        )}
                      </div>
                      {assignFieldErrors.admin && (
                        <div className="text-red-600 text-[12px] mt-1">{assignFieldErrors.admin}</div>
                      )}
                    </div>
                    <div>
                      <Select
                        label="Role"
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
                      💡 The selected staff will be assigned to this event with the chosen role.
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
                      Close
                    </Button>
                  </div>
                );
              }
              return (
                <div className="card__footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <Button variant="secondary" onClick={() => setShowAddStaff(false)}>
                    Cancel
                  </Button>
                  <Button
                    disabled={assigning}
                    onClick={async () => {
                      // Reset errors
                      setAssignError('');
                      setAssignFieldErrors({});
                      // Client-side validation
                      const fe: Record<string, string> = {};
                      if (!selectedAdminId) fe.admin = 'Please select a staff member.';
                      if (!addStaffRole) fe.role = 'Please select a role.';
                      if (Object.keys(fe).length > 0) {
                        setAssignFieldErrors(fe);
                        setAssignError('Please check the input values.');
                        return;
                      }

                      setAssigning(true);
                      try {
                        // Close selection modal and show progress modal during on-chain grant
                        setShowAddStaff(false);
                        setProgressMsg('Assigning staff to event. Please wait...');
                        setProgressDone(false);
                        setProgressOpen(true);

                        const res = await fetch(`/api/admin/events/${event.eventId}/staff`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ adminId: selectedAdminId, eventRole: addStaffRole }),
                        });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) {
                          const msg = data?.error || 'Failed to assign staff.';
                          const feServer: Record<string, string> = {};
                          const lower = (msg as string).toLowerCase();
                          if (lower.includes('adminid')) feServer.admin = 'Please select a staff member.';
                          if (lower.includes('eventrole')) feServer.role = 'Please select a role.';
                          if (res.status === 409)
                            feServer.admin = 'This staff member is already assigned to the event.';
                          setAssignFieldErrors(feServer);
                          setAssignError(msg);
                          setProgressOpen(false);
                        } else {
                          // optimistic update to staff list
                          const added = admins.find((a) => a.adminId === selectedAdminId);
                          if (added) {
                            setStaffRows((list) => [
                              ...list,
                              {
                                adminId: added.adminId,
                                fullName: added.fullName,
                                username: added.username,
                                email: added.email,
                                eventRole: addStaffRole,
                                assignedAt: (data?.staff?.assignedAt as string) || new Date().toISOString(),
                              },
                            ]);
                          }
                          setSelectedAdminId('');
                          setProgressMsg('Staff assignment completed.');
                          setProgressDone(true);
                        }
                      } finally {
                        setAssigning(false);
                      }
                    }}
                  >
                    {assigning ? 'Assigning...' : 'Assign'}
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
