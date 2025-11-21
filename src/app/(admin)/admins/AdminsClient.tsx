'use client';
import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
// import Select from '@/components/ui/Select';

type AdminRole = 'SYSTEM_ADMIN' | 'STAFF';
type VCStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
type OnboardingStatus = 'PENDING_REVIEW' | 'APPROVED' | 'ACTIVE' | 'REJECTED';
// Status filter removed
// type AdminStatus = 'ALL' | VCStatus;

interface AdminData {
  id: number;
  adminId: string;
  username: string;
  fullName: string;
  email: string | null;
  role: AdminRole;
  isActive: boolean;
  onboardingStatus?: OnboardingStatus;
  vcId?: string;
  vcStatus?: VCStatus;
  did: string | null;
  createdAt: string;
}

export default function AdminsClient() {
  const [admins, setAdmins] = useState<AdminData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  // const [statusFilter, setStatusFilter] = useState<AdminStatus>('ALL');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminData | null>(null);
  const [busy, setBusy] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      setHasError(false);
      try {
        const res = await fetch('/api/admin/admins');
        if (!res.ok) {
          setHasError(true);
        } else {
          const data = (await res.json()) as { admins: AdminData[] };
          setAdmins(data.admins || []);
        }
      } catch {
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const getEffectiveStatus = (a: AdminData): VCStatus => {
    if (a.vcStatus === 'REVOKED') return 'REVOKED';
    if (a.vcStatus === 'SUSPENDED') return 'SUSPENDED';
    if (a.vcStatus === 'ACTIVE') return 'ACTIVE';
    return a.isActive ? 'ACTIVE' : 'SUSPENDED';
  };

  const filteredAdmins = admins.filter((admin) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !query ||
      admin.fullName.toLowerCase().includes(query) ||
      admin.username.toLowerCase().includes(query) ||
      admin.email?.toLowerCase().includes(query) ||
      admin.did?.toLowerCase().includes(query);
    return matchesSearch;
  });

  const getStatusBadgeColor = (status: VCStatus) => {
    const map: Record<VCStatus, string> = {
      ACTIVE: 'bg-green-50 text-green-700 border-green-200',
      SUSPENDED: 'bg-amber-50 text-amber-700 border-amber-200',
      REVOKED: 'bg-gray-50 text-gray-700 border-gray-200',
    };
    return map[status];
  };

  const getStatusLabel = (status: VCStatus) => {
    switch (status) {
      case 'ACTIVE':
        return 'Active';
      case 'SUSPENDED':
        return 'Suspended';
      case 'REVOKED':
        return 'Revoked';
      default:
        return status;
    }
  };

  const getOnboardingBadgeColor = (status: OnboardingStatus) => {
    const map: Record<OnboardingStatus, string> = {
      PENDING_REVIEW: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      APPROVED: 'bg-blue-50 text-blue-700 border-blue-200',
      ACTIVE: 'bg-green-50 text-green-700 border-green-200',
      REJECTED: 'bg-red-50 text-red-700 border-red-200',
    };
    return map[status];
  };

  const getOnboardingLabel = (status: OnboardingStatus) => {
    switch (status) {
      case 'PENDING_REVIEW':
        return 'Pending Review';
      case 'APPROVED':
        return 'Approved';
      case 'ACTIVE':
        return 'Active';
      case 'REJECTED':
        return 'Rejected';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toISOString().slice(0, 10) + ' UTC';
    } catch {
      return '-';
    }
  };

  const [pendingAction, setPendingAction] = useState<'suspend' | 'activate' | 'revoke' | null>(null);
  const applyAction = async () => {
    if (!selectedAdmin || !pendingAction) return;
    setBusy(true);
    try {
      setAdmins((list) =>
        list.map((a) => {
          if (a.id !== selectedAdmin.id) return a;
          if (pendingAction === 'suspend') return { ...a, vcStatus: 'SUSPENDED', isActive: false };
          if (pendingAction === 'activate') return { ...a, vcStatus: 'ACTIVE' };
          if (pendingAction === 'revoke') return { ...a, vcStatus: 'REVOKED', isActive: false };
          return a;
        }),
      );
      setSelectedAdmin((cur) => {
        if (!cur) return cur;
        if (cur.id !== selectedAdmin.id) return cur;
        if (pendingAction === 'suspend') return { ...cur, vcStatus: 'SUSPENDED', isActive: false } as AdminData;
        if (pendingAction === 'activate') return { ...cur, vcStatus: 'ACTIVE' } as AdminData;
        if (pendingAction === 'revoke') return { ...cur, vcStatus: 'REVOKED', isActive: false } as AdminData;
        return cur;
      });
    } finally {
      setBusy(false);
      setShowConfirmDialog(false);
      setPendingAction(null);
    }
  };

  return (
    <div className="max-w-screen-2xl mx-auto">
      <div className="mb-6 lg:mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-[var(--text)]">Admins</h1>
            <p className="text-sm lg:text-base text-[var(--muted)] mt-1">
              Manage staff accounts (roles assigned per event)
            </p>
          </div>
          <div />
        </div>
      </div>

      <div className="card mb-4 lg:mb-6">
        <div className="card__body">
          <div className="grid grid-cols-1 gap-4">
            <Input
              type="text"
              placeholder="Search by name, DID, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

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

      {admins.length === 0 && !isLoading && !hasError && (
        <div className="card">
          <div className="card__body text-center py-12">
            <p className="text-[var(--muted)]">No admins yet.</p>
          </div>
        </div>
      )}

      {hasError && !isLoading && (
        <div className="card">
          <div className="card__body text-center py-12">
            <p className="text-red-600 mb-4">An error occurred.</p>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        </div>
      )}

      {!isLoading && admins.length > 0 && !hasError && (
        <>
          <div className="hidden lg:block">
            <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
              <table className="table min-w-[640px]">
                <thead>
                  <tr>
                    <th>Name / DID</th>
                    <th>Status</th>
                    <th>VC Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAdmins.map((admin) => (
                    <tr key={admin.adminId}>
                      <td>
                        <div style={{ maxWidth: '200px' }}>
                          <div style={{ fontWeight: 700, marginBottom: 2 }}>{admin.fullName}</div>
                          <div
                            style={{
                              fontSize: 12,
                              color: 'var(--muted)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {admin.did || '(No DID)'}
                          </div>
                        </div>
                      </td>
                      <td>
                        {admin.onboardingStatus && (
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getOnboardingBadgeColor(admin.onboardingStatus)}`}
                          >
                            {getOnboardingLabel(admin.onboardingStatus)}
                          </span>
                        )}
                      </td>
                      <td>
                        {(() => {
                          const s = getEffectiveStatus(admin);
                          return (
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadgeColor(s)}`}
                            >
                              {getStatusLabel(s)}
                            </span>
                          );
                        })()}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--muted)' }}>{formatDate(admin.createdAt)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            className="btn btn--secondary btn--sm"
                            onClick={() => {
                              setSelectedAdmin(admin);
                              setShowDetails(true);
                            }}
                          >
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-4">
            {filteredAdmins.map((admin) => (
              <div key={admin.adminId} className="card">
                <div className="card__body">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1" style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>{admin.fullName}</div>
                      <div
                        style={{
                          fontSize: 13,
                          color: 'var(--muted)',
                          marginBottom: 8,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {admin.did || '(No DID)'}
                      </div>
                      {(() => {
                        const s = getEffectiveStatus(admin);
                        return (
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadgeColor(s)}`}
                          >
                            {getStatusLabel(s)}
                          </span>
                        );
                      })()}
                    </div>
                    <button className="btn btn--ghost btn--sm" aria-label="Menu">
                      ⋯
                    </button>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      Status:
                      {admin.onboardingStatus && (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getOnboardingBadgeColor(admin.onboardingStatus)}`}
                        >
                          {getOnboardingLabel(admin.onboardingStatus)}
                        </span>
                      )}
                    </div>
                    <div>Created: {formatDate(admin.createdAt)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSelectedAdmin(admin);
                        setShowDetails(true);
                      }}
                    >
                      Details
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Details Drawer/Modal */}
      {showDetails && selectedAdmin && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-details-title"
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setShowDetails(false)}
        >
          <div
            className="card w-full max-w-lg flex flex-col"
            style={{ maxHeight: 'calc(100dvh - 2rem)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="card__header flex-shrink-0"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <h2 id="admin-details-title" style={{ fontWeight: 800 }}>
                Admin Details
              </h2>
              <button className="btn btn--ghost btn--sm" onClick={() => setShowDetails(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="card__body flex-1 overflow-y-auto min-h-0">
              {/* Basic Information */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h3 className="font-semibold mb-3">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">Name:</span>
                    <span className="ml-2 font-medium">{selectedAdmin.fullName}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Username:</span>
                    <span className="ml-2">@{selectedAdmin.username}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Admin ID:</span>
                    <span className="ml-2">{selectedAdmin.adminId}</span>
                  </div>
                  {selectedAdmin.email && (
                    <div>
                      <span className="text-gray-600">Email:</span>
                      <span className="ml-2">{selectedAdmin.email}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-600">Role:</span>
                    <span className="ml-2">{selectedAdmin.role === 'SYSTEM_ADMIN' ? 'System Admin' : 'Staff'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Created:</span>
                    <span className="ml-2">{formatDate(selectedAdmin.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* DID Information */}
              {selectedAdmin.did && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold mb-3">DID Information</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">DID:</span>
                      <div className="font-mono text-xs bg-white p-2 rounded mt-1 break-all">{selectedAdmin.did}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Status Information */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h3 className="font-semibold mb-3">Status Information</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-sm text-gray-600">Onboarding Status:</span>
                    <div className="mt-1">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getOnboardingBadgeColor(selectedAdmin.onboardingStatus || 'ACTIVE')}`}
                      >
                        {getOnboardingLabel(selectedAdmin.onboardingStatus || 'ACTIVE')}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">VC Status:</span>
                    <div className="mt-1">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadgeColor(getEffectiveStatus(selectedAdmin))}`}
                      >
                        {getStatusLabel(getEffectiveStatus(selectedAdmin))}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Active Status:</span>
                    <div className="mt-1">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                          selectedAdmin.isActive
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-gray-50 text-gray-700 border-gray-200'
                        }`}
                      >
                        {selectedAdmin.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  {selectedAdmin.vcId && (
                    <div>
                      <span className="text-sm text-gray-600">VC ID:</span>
                      <div className="mt-1 font-mono text-xs truncate" title={selectedAdmin.vcId}>
                        {selectedAdmin.vcId}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div
              className="card__footer flex-shrink-0"
              style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}
            >
              {/* System Admin has no destructive actions */}
              {selectedAdmin.role === 'SYSTEM_ADMIN' ? (
                <Button variant="secondary" onClick={() => setShowDetails(false)}>
                  Close
                </Button>
              ) : (
                <>
                  {/* Onboarding section: only shown for PENDING_REVIEW (one-time) */}
                  {selectedAdmin.onboardingStatus === 'PENDING_REVIEW' && (
                    <>
                      <div className="text-[var(--muted)]" style={{ fontSize: 12, marginRight: 'auto' }}>
                        Once approved, initial setup will proceed automatically on next login.
                        <br />
                        (Wallet creation → DID on-chain registration → ADMIN VC issuance → Encrypted vault storage)
                      </div>
                      <Button
                        onClick={async () => {
                          setBusy(true);
                          const res = await fetch(`/api/admin/admins/${selectedAdmin.id}/approve`, { method: 'POST' });
                          if (res.ok) {
                            setAdmins((list) =>
                              list.map((a) => (a.id === selectedAdmin.id ? { ...a, onboardingStatus: 'APPROVED' } : a)),
                            );
                            // immediately reflect in modal
                            setSelectedAdmin((cur) =>
                              cur ? ({ ...cur, onboardingStatus: 'APPROVED' } as AdminData) : cur,
                            );
                          }
                          setBusy(false);
                        }}
                        disabled={busy}
                      >
                        Approve (Onboarding)
                      </Button>
                    </>
                  )}
                  {/* Approved but not yet logged in - hide VC actions */}
                  {selectedAdmin.onboardingStatus === 'APPROVED' && selectedAdmin.isActive === false && (
                    <div className="text-[var(--muted)]" style={{ fontSize: 12, width: '100%', marginBottom: 8 }}>
                      Waiting for first login (auto-activation and VC issuance)
                    </div>
                  )}

                  {/* VC action section: only shown when VC exists and is active */}
                  {/* TODO: Enable after API endpoints are implemented (POST /api/vcs/suspend, /api/vcs/activate required) */}
                  {/* {selectedAdmin.onboardingStatus === 'ACTIVE' && getEffectiveStatus(selectedAdmin) === 'ACTIVE' && (
                    <>
                      <Button
                        variant="danger"
                        onClick={() => {
                          setPendingAction('suspend');
                          setShowConfirmDialog(true);
                        }}
                        disabled={busy}
                      >
                        Suspend VC
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setPendingAction('revoke');
                          setShowConfirmDialog(true);
                        }}
                        disabled={busy}
                      >
                        Revoke VC (Permanent)
                      </Button>
                    </>
                  )}
                  {selectedAdmin.onboardingStatus === 'ACTIVE' && getEffectiveStatus(selectedAdmin) === 'SUSPENDED' && (
                    <>
                      <Button
                        onClick={() => {
                          setPendingAction('activate');
                          setShowConfirmDialog(true);
                        }}
                        disabled={busy}
                      >
                        Reactivate VC
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setPendingAction('revoke');
                          setShowConfirmDialog(true);
                        }}
                        disabled={busy}
                      >
                        Revoke VC (Permanent)
                      </Button>
                    </>
                  )}
                  {getEffectiveStatus(selectedAdmin) === 'REVOKED' && (
                    <Button variant="secondary" disabled>
                      Revoked
                    </Button>
                  )} */}
                  <Button variant="secondary" onClick={() => setShowDetails(false)}>
                    Close
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {showConfirmDialog && selectedAdmin && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setShowConfirmDialog(false)}
        >
          <div
            className="card w-full max-w-sm"
            style={{ maxWidth: 'min(24rem, calc(100vw - 2rem))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card__header">
              <h2 id="confirm-dialog-title" style={{ fontWeight: 700 }}>
                {pendingAction === 'suspend' && 'Confirm VC Suspension'}
                {pendingAction === 'activate' && 'Confirm VC Reactivation'}
                {pendingAction === 'revoke' && 'Confirm VC Revocation (Permanent)'}
              </h2>
            </div>
            <div className="card__body">
              <p style={{ fontSize: 14, lineHeight: 1.6 }}>
                {pendingAction === 'suspend' &&
                  `Are you sure you want to suspend the ADMIN VC for ${selectedAdmin.fullName} (@${selectedAdmin.username})? (Can be reactivated later)`}
                {pendingAction === 'activate' &&
                  `Are you sure you want to reactivate the ADMIN VC for ${selectedAdmin.fullName} (@${selectedAdmin.username})?`}
                {pendingAction === 'revoke' &&
                  `Warning: Are you sure you want to permanently revoke the ADMIN VC for ${selectedAdmin.fullName} (@${selectedAdmin.username})? (This cannot be undone)`}
              </p>
            </div>
            <div className="card__footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setShowConfirmDialog(false)}>
                Cancel
              </Button>
              <Button
                variant={pendingAction === 'revoke' ? 'danger' : pendingAction === 'suspend' ? 'danger' : 'primary'}
                disabled={busy}
                onClick={applyAction}
              >
                {busy
                  ? 'Processing…'
                  : pendingAction === 'suspend'
                    ? 'Suspend'
                    : pendingAction === 'activate'
                      ? 'Reactivate'
                      : 'Revoke (Permanent)'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
