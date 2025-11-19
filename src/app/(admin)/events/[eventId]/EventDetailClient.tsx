'use client';
import { useState, useEffect, type ReactNode } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ProgressModal from '@/components/ui/ProgressModal';

// Simple Modal Component (participant registration modal wrapper)
interface SimpleModalProps {
  children: ReactNode;
  onClose: () => void;
  className?: string; // allow width/size override
}

function SimpleModal({ children, onClose, className }: SimpleModalProps) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/40" onClick={onClose}>
      <div className={`w-full max-h-[90vh] overflow-auto ${className || ''}`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

interface ParticipantData {
  id: number;
  userDid: string | null;
  adminDid: string | null;
  name: string;
  assignedAt: string;
  isActive: boolean;
  assignedByAdminId?: string | null;
}

interface EventDetailClientProps {
  eventId: string;
  onBack?: () => void;
}

export default function EventDetailClient({ eventId, onBack }: EventDetailClientProps) {
  // eventId will be used for API calls
  console.log('Event ID:', eventId);
  const [participants, setParticipants] = useState<ParticipantData[]>([]);
  const [activeTab, setActiveTab] = useState<'participants' | 'payment'>('participants');
  const [_filterStatus, _setFilterStatus] = useState<'all' | 'present' | 'absent'>('all');
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [addUserQuery, setAddUserQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // Fetch eligible users from API (server-side filtering)
  const [userList, setUserList] = useState<Array<{ userId: string; name: string; email: string | null }>>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState('');
  // Progress modal for long-running participant registration (on-chain + DB)
  const [progressOpen, setProgressOpen] = useState(false);
  const [progressMsg, setProgressMsg] = useState('Processing...');
  const [progressDone, setProgressDone] = useState(false);
  const [eventInfo, setEventInfo] = useState<{
    name: string;
    startDate: string;
    endDate: string;
    dailyDsa: number;
    currentDay: number;
  }>({
    name: '',
    startDate: '',
    endDate: '',
    dailyDsa: 0,
    currentDay: 1,
  });

  // Load eligible users when modal opens
  useEffect(() => {
    if (showRegisterModal) {
      setIsLoadingUsers(true);
      fetch(`/api/admin/users?eligibleForEvent=${eventId}`, { cache: 'no-store' })
        .then((res) => res.json())
        .then((data) => {
          console.log('[EventDetailClient] Loaded eligible users for event', {
            eventId,
            count: (data?.users || []).length,
          });
          setUserList(data?.users || []);
        })
        .catch((error) => {
          console.error('[EventDetailClient] Failed to fetch eligible users', error);
        })
        .finally(() => {
          setIsLoadingUsers(false);
        });
    }
  }, [showRegisterModal, eventId]);
  // Participant detail modal removed (simplified)

  // Load event info (name, dates, daily DSA, current day)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        // 1) Try admin-only event API (SYSTEM_ADMIN)
        let res = await fetch(`/api/admin/events/${eventId}`, { cache: 'no-store' });
        if (res.ok) {
          const data = (await res.json().catch(() => ({}))) as { event?: Record<string, unknown> };
          const e = data.event;
          if (e && !cancelled) {
            const start = new Date(String(e.startDate));
            const end = new Date(String(e.endDate));
            const today = new Date();
            const startDay = new Date(start);
            startDay.setHours(0, 0, 0, 0);
            const endDay = new Date(end);
            endDay.setHours(0, 0, 0, 0);
            const t = new Date(today);
            t.setHours(0, 0, 0, 0);
            const MS_PER_DAY = 24 * 60 * 60 * 1000;
            const totalDays = Math.max(1, Math.floor((endDay.getTime() - startDay.getTime()) / MS_PER_DAY) + 1);
            let idx = Math.floor((t.getTime() - startDay.getTime()) / MS_PER_DAY);
            if (idx < 0) idx = 0;
            if (idx > totalDays - 1) idx = totalDays - 1;
            const currentDay = idx + 1;
            setEventInfo({
              name: String(e.name ?? ''),
              startDate: start.toISOString().slice(0, 10),
              endDate: end.toISOString().slice(0, 10),
              dailyDsa: Number(e.amountPerDay ?? 0),
              currentDay,
            });
            return;
          }
        }

        // 2) Fallback for STAFF: use staff/me summary and pick this event
        res = await fetch('/api/admin/events/staff/me?role=APPROVER', { cache: 'no-store' });
        const data = (await res.json().catch(() => ({}))) as {
          events?: Array<Record<string, unknown>>;
        };
        if (!res.ok) {
          console.error('[EventDetailClient] Failed to fetch event info', data);
          return;
        }
        const match = (data.events ?? []).find((e) => String(e.eventId) === eventId);
        if (!match || cancelled) return;

        const start = new Date(String(match.startDate));
        const end = new Date(String(match.endDate));
        const today = new Date();
        const startDay = new Date(start);
        startDay.setHours(0, 0, 0, 0);
        const endDay = new Date(end);
        endDay.setHours(0, 0, 0, 0);
        const t = new Date(today);
        t.setHours(0, 0, 0, 0);
        const MS_PER_DAY = 24 * 60 * 60 * 1000;
        const totalDays = Math.max(1, Math.floor((endDay.getTime() - startDay.getTime()) / MS_PER_DAY) + 1);
        let idx = Math.floor((t.getTime() - startDay.getTime()) / MS_PER_DAY);
        if (idx < 0) idx = 0;
        if (idx > totalDays - 1) idx = totalDays - 1;
        const currentDay = idx + 1;

        setEventInfo({
          name: String(match.name ?? ''),
          startDate: start.toISOString().slice(0, 10),
          endDate: end.toISOString().slice(0, 10),
          dailyDsa: Number(match.amountPerDay ?? 0),
          currentDay,
        });
      } catch (error) {
        console.error('[EventDetailClient] Error fetching event info', error);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  // Load participants for this event
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/events/${eventId}/participants`, { cache: 'no-store' });
        const data = (await res.json().catch(() => ({}))) as { participants?: Array<Record<string, unknown>> };
        if (!res.ok) {
          console.error('[EventDetailClient] Failed to fetch participants', data);
          return;
        }
        const rows = data.participants ?? [];
        const mapped: ParticipantData[] = rows.map((row) => ({
          id: Number(row.id ?? 0),
          userDid: (row.userDid as string | null) ?? null,
          adminDid: (row.adminDid as string | null) ?? null,
          name: (row.name as string) || (row.userDid as string) || '',
          assignedAt: String(row.assignedAt ?? ''),
          isActive: Boolean(row.isActive ?? true),
          assignedByAdminId: (row.assignedByAdminId as string | null) ?? null,
        }));
        if (!cancelled) {
          setParticipants(mapped);
        }
      } catch (error) {
        console.error('[EventDetailClient] Error fetching participants', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  // Calculate statistics
  const stats = {
    total: participants.length,
    present: 0,
    absent: 0,
    awaiting: 0,
    paid: 0,
    totalDisbursed: 0,
  };

  // Participants list (no additional filtering for now)
  const filteredParticipants = participants;

  return (
    <div className="max-w-screen-2xl mx-auto">
      <ProgressModal
        open={progressOpen}
        title={progressDone ? 'Completed' : 'Registering participant'}
        message={progressMsg}
        done={progressDone}
        confirmText="OK"
        onConfirm={() => {
          setProgressOpen(false);
          setProgressDone(false);
          setProgressMsg('Processing...');
        }}
      />
      {/* Back Button */}
      {onBack && (
        <div className="mb-4">
          <Button variant="secondary" onClick={onBack}>
            ← Back to dashboard
          </Button>
        </div>
      )}

      {/* Event Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold mb-2">{eventInfo.name}</h1>
            <div className="flex flex-wrap gap-4 text-sm opacity-90">
              <span>
                {eventInfo.startDate} ~ {eventInfo.endDate}
              </span>
              <span>{stats.total} participants</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-white/20 backdrop-blur px-4 py-2 rounded-lg">
              <span className="text-sm">Day {eventInfo.currentDay}</span>
            </div>
          </div>
        </div>
      </div>

      {/* DSA Info */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5 mb-6 flex items-center gap-4">
        <div className="flex-1">
          <h3 className="font-semibold text-green-900">Daily Subsistence Allowance (DSA) System</h3>
          <p className="text-sm text-green-700 mt-1">
            Participants receive DSA after QR check-in verification. Payments require admin approval.
          </p>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-900">${eventInfo.dailyDsa} USDC</div>
          <div className="text-xs text-green-700">Daily amount</div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="card__body">
            <div className="text-sm text-[var(--muted)]">Total participants</div>
            <div className="text-2xl font-bold mt-1">{stats.total}</div>
          </div>
        </div>
        <div className="card">
          <div className="card__body">
            <div className="text-sm text-[var(--muted)]">Present today</div>
            <div className="text-2xl font-bold mt-1 text-green-600">{stats.present}</div>
          </div>
        </div>
        <div className="card border-yellow-200 bg-yellow-50">
          <div className="card__body">
            <div className="text-sm text-yellow-700">DSA awaiting approval</div>
            <div className="text-2xl font-bold mt-1 text-yellow-700">{stats.awaiting}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border mb-6">
        <div className="flex border-b overflow-x-auto">
          {[
            { key: 'participants', label: 'Participants' },
            { key: 'payment', label: 'DSA Payments' },
          ].map((tab) => (
            <button
              key={tab.key}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'participants' && (
            <div>
              {/* Header (title + action) */}
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
                <h3 className="text-lg font-semibold">Total participants: {participants.length}</h3>
                <div className="flex gap-2">
                  <Button onClick={() => setShowRegisterModal(true)}>Add participant</Button>
                </div>
              </div>

              {/* Search field removed */}

              {/* Participants Table (participant management: shows basic registration info) */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Participant</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">
                        Participant DID
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">
                        Registering admin DID
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">
                        Registration time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredParticipants.map((participant) => (
                      <tr key={participant.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div>
                            <div className="font-semibold text-gray-900">{participant.name}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span className="text-xs font-mono text-gray-700">{participant.userDid ?? '-'}</span>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span className="text-xs font-mono text-gray-700">{participant.adminDid ?? '-'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-600">
                            {participant.assignedAt ? new Date(participant.assignedAt).toLocaleString() : '-'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'payment' && (
            <div className="space-y-4">
              {/* Date Selection */}
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                  <h3 className="text-lg font-semibold">DSA Payments</h3>
                  <select className="border border-gray-300 rounded-md px-3 py-1 text-sm">
                    <option value="2025-01-25">Day 1 - 2025-01-25</option>
                    <option value="2025-01-26">Day 2 - 2025-01-26</option>
                    <option value="2025-01-27" selected>
                      Day 3 - 2025-01-27 (today)
                    </option>
                    <option value="2025-01-28">Day 4 - 2025-01-28</option>
                    <option value="2025-01-29">Day 5 - 2025-01-29</option>
                  </select>
                </div>
                {/* Daily amount display intentionally omitted */}
              </div>

              {/* Daily Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="card">
                  <div className="card__body">
                    <div className="text-xs text-gray-600">Checked in</div>
                    <div className="text-xl font-bold">{stats.present}</div>
                  </div>
                </div>
                <div className="card">
                  <div className="card__body">
                    <div className="text-xs text-gray-600">Awaiting approval</div>
                    <div className="text-xl font-bold text-yellow-600">{stats.awaiting}</div>
                  </div>
                </div>
                <div className="card">
                  <div className="card__body">
                    <div className="text-xs text-gray-600">Paid</div>
                    <div className="text-xl font-bold text-green-600">{stats.paid}</div>
                  </div>
                </div>
                <div className="card">
                  <div className="card__body">
                    <div className="text-xs text-gray-600">Total amount</div>
                    <div className="text-xl font-bold">${stats.totalDisbursed}</div>
                  </div>
                </div>
              </div>

              {/* Payment List */}
              <div className="card">
                <div className="card__header flex justify-between items-center">
                  <h4 className="font-medium">Payment candidates</h4>
                </div>
                <div className="card__body">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-3 py-2">Participant</th>
                          <th className="text-left px-3 py-2">Check-in time</th>
                          <th className="text-left px-3 py-2">User status</th>
                          <th className="text-left px-3 py-2">VC status</th>
                          <th className="text-left px-3 py-2">Payment status</th>
                          <th className="text-left px-3 py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {participants.map((participant) => (
                          <tr key={participant.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <div className="font-medium">{participant.name}</div>
                              <div className="text-xs text-gray-500 font-mono">{participant.userDid ?? '-'}</div>
                            </td>
                            <td className="px-3 py-2 text-xs">-</td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  participant.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {participant.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                -
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                -
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className="text-xs text-gray-400">-</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Register Modal (UI only) — same card layout as staff modal */}
      {showRegisterModal && (
        <SimpleModal
          onClose={() => {
            setShowRegisterModal(false);
            setSelectedUserId('');
            setAddUserQuery('');
            setRegisterError('');
          }}
          className="max-w-xl"
        >
          <div className="card w-full max-w-xl mx-auto">
            <div className="card__header">Register participant to event</div>
            <div className="card__body">
              <div className="grid gap-4">
                <div>
                  <Input
                    type="text"
                    label="Search users"
                    placeholder="Name, ID, email"
                    value={addUserQuery}
                    onChange={(e) => setAddUserQuery(e.target.value)}
                  />
                  <div className="mt-3 space-y-2 max-h-72 overflow-auto">
                    {isLoadingUsers ? (
                      <div className="text-center py-4 text-[var(--muted)]">Loading user list...</div>
                    ) : (
                      (() => {
                        const q = addUserQuery.trim().toLowerCase();
                        const filtered = userList.filter((u) => {
                          if (!q) return true;
                          return u.name.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
                        });
                        if (filtered.length === 0) {
                          return (
                            <div className="text-[12px] text-[var(--muted)]">
                              {userList.length === 0
                                ? 'No more users can be registered. (All are already registered or inactive)'
                                : 'No search results.'}
                            </div>
                          );
                        }
                        return filtered.map((u) => {
                          const selected = selectedUserId === u.userId;
                          return (
                            <label
                              key={u.userId}
                              role="radio"
                              aria-checked={selected}
                              className={
                                `flex items-center justify-between gap-3 p-2 border rounded-lg cursor-pointer transition-colors outline-none focus:outline-none focus-visible:outline-none ` +
                                `hover:bg-gray-50 ` +
                                (selected ? `border-[var(--brand)]` : `border-[var(--line)]`)
                              }
                            >
                              <div>
                                <div className="font-medium">{u.name}</div>
                                <div className="text-[12px] text-[var(--muted)]">{u.email || 'No email'}</div>
                              </div>
                              <input
                                type="radio"
                                className="sr-only focus:outline-none focus:ring-0"
                                name="selectedUser"
                                checked={selected}
                                onChange={() => setSelectedUserId(u.userId)}
                              />
                            </label>
                          );
                        });
                      })()
                    )}
                  </div>
                </div>
                {registerError && (
                  <div className="text-[13px] p-2 rounded border border-red-200 bg-red-50 text-red-700">
                    {registerError}
                  </div>
                )}
                <div className="text-sm text-[var(--muted)]">
                  💡 The selected user will be registered to this event.
                </div>
              </div>
            </div>
            <div className="card__footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowRegisterModal(false);
                  setSelectedUserId('');
                  setAddUserQuery('');
                  setRegisterError('');
                }}
                disabled={registering}
              >
                Cancel
              </Button>
              <Button
                disabled={!selectedUserId || registering}
                onClick={async () => {
                  if (!selectedUserId) return;
                  // Call API to register the selected user as an event participant
                  // - Performs on-chain registration + DB persistence in a single flow
                  setRegisterError('');
                  setRegistering(true);
                  // Close selection modal and show progress modal while interacting with the blockchain
                  setShowRegisterModal(false);
                  setProgressMsg('Registering participant to event. Please wait...');
                  setProgressDone(false);
                  setProgressOpen(true);
                  try {
                    console.log('[EventDetailClient] Submitting participant registration', {
                      eventId,
                      userId: selectedUserId,
                    });
                    const res = await fetch(`/api/admin/events/${eventId}/participants`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId: selectedUserId }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      const msg = (data as { error?: string })?.error || 'Failed to register participant.';
                      setRegisterError(msg);
                      console.error('[EventDetailClient] Participant registration failed', {
                        status: res.status,
                        error: msg,
                      });
                      // On error, close progress modal and reopen selection modal to show the error message
                      setProgressOpen(false);
                      setShowRegisterModal(true);
                      return;
                    }
                    console.log('[EventDetailClient] Participant registration success', {
                      eventId,
                      userId: selectedUserId,
                      participant: (data as { participant?: unknown }).participant,
                      onChainTxHash: (data as { onChainTxHash?: string }).onChainTxHash,
                    });
                    // On success, switch the progress modal to the completed state
                    setProgressMsg('Participant registration completed.');
                    setProgressDone(true);
                    setSelectedUserId('');
                    setAddUserQuery('');
                  } catch (e) {
                    setRegisterError(e instanceof Error ? e.message : 'Failed to register participant.');
                    console.error('[EventDetailClient] Participant registration error', e);
                  } finally {
                    setRegistering(false);
                  }
                }}
              >
                {registering ? 'Registering...' : 'Register'}
              </Button>
            </div>
          </div>
        </SimpleModal>
      )}

      {/* Participant Detail Modal (removed for simplified management) */}
    </div>
  );
}
