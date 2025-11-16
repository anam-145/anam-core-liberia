'use client';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

type AdminRole = 'SYSTEM_ADMIN' | 'STAFF';
type VCStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
type AdminStatus = 'ALL' | VCStatus;

interface AdminData {
  id: number;
  adminId: string;
  username: string;
  fullName: string;
  email: string | null;
  role: AdminRole;
  // DB 필드 (계정 상태)
  isActive: boolean;
  // VC 기반 권한 상태 (옵션: 백엔드 DTO에서 포함)
  vcId?: string;
  vcStatus?: VCStatus;
  did: string | null;
  lastLogin: string | null;
  createdAt: string;
}

// Mock data for UI skeleton
const MOCK_ADMINS: AdminData[] = [
  {
    id: 1,
    adminId: '1',
    username: 'john.doe',
    fullName: 'John Doe',
    email: 'john@undp.org',
    role: 'STAFF',
    isActive: true,
    vcStatus: 'ACTIVE',
    did: 'did:anam:issuer:0x1234...5678',
    lastLogin: '2025-01-13T10:30:00Z',
    createdAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 2,
    adminId: '2',
    username: 'jane.smith',
    fullName: 'Jane Smith',
    email: 'jane@undp.org',
    role: 'STAFF',
    isActive: true,
    vcStatus: 'SUSPENDED',
    did: 'did:anam:issuer:0xabcd...ef01',
    lastLogin: '2025-01-12T14:20:00Z',
    createdAt: '2025-01-02T00:00:00Z',
  },
  {
    id: 3,
    adminId: '3',
    username: 'bob.wilson',
    fullName: 'Bob Wilson',
    email: 'bob@undp.org',
    role: 'STAFF',
    isActive: false,
    vcStatus: 'REVOKED',
    did: null,
    lastLogin: '2025-01-10T09:15:00Z',
    createdAt: '2025-01-03T00:00:00Z',
  },
];

export default function AdminsPage() {
  const [admins, setAdmins] = useState<AdminData[]>(MOCK_ADMINS);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AdminStatus>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminData | null>(null);
  const [busy, setBusy] = useState(false);

  // Mock loading/empty/error states
  const isLoading = false;
  const isEmpty = false;
  const hasError = false;

  // Filter admins (simple client-side filtering)
  const getEffectiveStatus = (a: AdminData): VCStatus => {
    if (a.vcStatus === 'REVOKED') return 'REVOKED';
    if (a.vcStatus === 'SUSPENDED') return 'SUSPENDED';
    if (a.vcStatus === 'ACTIVE') return 'ACTIVE';
    return a.isActive ? 'ACTIVE' : 'SUSPENDED';
  };

  const filteredAdmins = admins.filter((admin) => {
    // Search filter
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !query ||
      admin.fullName.toLowerCase().includes(query) ||
      admin.username.toLowerCase().includes(query) ||
      admin.email?.toLowerCase().includes(query) ||
      admin.did?.toLowerCase().includes(query);

    // Status filter
    const matchesStatus = statusFilter === 'ALL' || getEffectiveStatus(admin) === statusFilter;

    return matchesSearch && matchesStatus;
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
        return '활성화';
      case 'SUSPENDED':
        return '비활성화';
      case 'REVOKED':
        return '폐기됨';
      default:
        return status;
    }
  };

  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // UI-only confirmation action handler (no API yet)
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
    } finally {
      setBusy(false);
      setShowConfirmDialog(false);
      setPendingAction(null);
    }
  };

  return (
    <div className="max-w-screen-2xl mx-auto">
      {/* Page Header */}
      <div className="mb-6 lg:mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-[var(--text)]">관리자</h1>
            <p className="text-sm lg:text-base text-[var(--muted)] mt-1">스태프 계정 관리 (역할은 이벤트별 할당)</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>+ 새 관리자</Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card mb-4 lg:mb-6">
        <div className="card__body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <Input
              type="text"
              placeholder="이름, DID, 이메일 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {/* Status Filter */}
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as AdminStatus)}>
              <option value="ALL">모든 상태</option>
              <option value="ACTIVE">활성화</option>
              <option value="SUSPENDED">비활성화</option>
              <option value="REVOKED">폐기됨</option>
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
            <p className="text-[var(--muted)] mb-4">아직 관리자가 없습니다.</p>
            <Button onClick={() => setShowCreateModal(true)}>+ 새 관리자 만들기</Button>
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
            <table className="table min-w-[720px]">
              <thead>
                <tr>
                  <th>이름 / DID</th>
                  <th>VC 상태</th>
                  <th>마지막 로그인</th>
                  <th>생성일</th>
                  <th>액션</th>
                </tr>
              </thead>
              <tbody>
                {filteredAdmins.map((admin) => (
                  <tr key={admin.adminId}>
                    <td>
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: 2 }}>{admin.fullName}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{admin.did || '(DID 없음)'}</div>
                      </div>
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
                    <td style={{ fontSize: 13, color: 'var(--muted)' }}>{formatRelativeTime(admin.lastLogin)}</td>
                    <td style={{ fontSize: 13, color: 'var(--muted)' }}>{formatDate(admin.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {getEffectiveStatus(admin) === 'ACTIVE' && (
                          <>
                            <button
                              className="btn btn--danger btn--sm"
                              onClick={() => {
                                setSelectedAdmin(admin);
                                setPendingAction('suspend');
                                setShowConfirmDialog(true);
                              }}
                              disabled={busy && selectedAdmin?.id === admin.id}
                            >
                              비활성화
                            </button>
                            <button
                              className="btn btn--secondary btn--sm"
                              onClick={() => {
                                setSelectedAdmin(admin);
                                setPendingAction('revoke');
                                setShowConfirmDialog(true);
                              }}
                              disabled={busy && selectedAdmin?.id === admin.id}
                            >
                              폐기
                            </button>
                          </>
                        )}
                        {getEffectiveStatus(admin) === 'SUSPENDED' && (
                          <>
                            <button
                              className="btn btn--primary btn--sm"
                              onClick={() => {
                                setSelectedAdmin(admin);
                                setPendingAction('activate');
                                setShowConfirmDialog(true);
                              }}
                              disabled={busy && selectedAdmin?.id === admin.id}
                            >
                              활성화
                            </button>
                            <button
                              className="btn btn--secondary btn--sm"
                              onClick={() => {
                                setSelectedAdmin(admin);
                                setPendingAction('revoke');
                                setShowConfirmDialog(true);
                              }}
                              disabled={busy && selectedAdmin?.id === admin.id}
                            >
                              폐기
                            </button>
                          </>
                        )}
                        {getEffectiveStatus(admin) === 'REVOKED' && (
                          <button className="btn btn--ghost btn--sm" disabled>
                            폐기됨
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-4">
            {filteredAdmins.map((admin) => (
              <div key={admin.adminId} className="card">
                <div className="card__body">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>{admin.fullName}</div>
                      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
                        {admin.did || '(DID 없음)'}
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
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => {
                        /* Menu */
                      }}
                      aria-label="메뉴"
                    >
                      ⋯
                    </button>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
                    <div>마지막 로그인: {formatRelativeTime(admin.lastLogin)}</div>
                    <div>생성일: {formatDate(admin.createdAt)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {getEffectiveStatus(admin) === 'ACTIVE' && (
                      <>
                        <Button
                          variant="danger"
                          onClick={() => {
                            setSelectedAdmin(admin);
                            setPendingAction('suspend');
                            setShowConfirmDialog(true);
                          }}
                          disabled={busy && selectedAdmin?.id === admin.id}
                        >
                          비활성화
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setSelectedAdmin(admin);
                            setPendingAction('revoke');
                            setShowConfirmDialog(true);
                          }}
                          disabled={busy && selectedAdmin?.id === admin.id}
                        >
                          폐기
                        </Button>
                      </>
                    )}
                    {getEffectiveStatus(admin) === 'SUSPENDED' && (
                      <>
                        <Button
                          onClick={() => {
                            setSelectedAdmin(admin);
                            setPendingAction('activate');
                            setShowConfirmDialog(true);
                          }}
                          disabled={busy && selectedAdmin?.id === admin.id}
                        >
                          활성화
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setSelectedAdmin(admin);
                            setPendingAction('revoke');
                            setShowConfirmDialog(true);
                          }}
                          disabled={busy && selectedAdmin?.id === admin.id}
                        >
                          폐기
                        </Button>
                      </>
                    )}
                    {getEffectiveStatus(admin) === 'REVOKED' && (
                      <Button variant="secondary" disabled>
                        폐기됨
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Create Admin Modal */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-modal-title"
          className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="card__header">
              <h2 id="create-modal-title" style={{ fontWeight: 700 }}>
                새 관리자 만들기
              </h2>
            </div>
            <div className="card__body">
              <div className="space-y-4">
                <Input label="이름" type="text" placeholder="John Doe" required />
                <Input label="아이디 (username)" type="text" placeholder="john.doe" required />
                <Input label="이메일" type="email" placeholder="john@undp.org" />
                {/** 활성화 토글 제거 (VC 기반 상태로 관리) **/}
                <div
                  style={{
                    padding: '12px',
                    background: '#f6f7f9',
                    borderRadius: '8px',
                    fontSize: '13px',
                    color: 'var(--muted)',
                  }}
                >
                  💡 역할(APPROVER/VERIFIER)은 이벤트별로 할당됩니다.
                </div>
              </div>
            </div>
            <div className="card__footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
                취소
              </Button>
              <Button onClick={() => setShowCreateModal(false)}>생성</Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal removed: only suspend/reactivate supported */}

      {/* Confirm Dialog (Activate/Deactivate/Revoke) */}
      {showConfirmDialog && selectedAdmin && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4"
          onClick={() => setShowConfirmDialog(false)}
        >
          <div className="card w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="card__header">
              <h2 id="confirm-dialog-title" style={{ fontWeight: 700 }}>
                {pendingAction === 'suspend' && '비활성화 확인'}
                {pendingAction === 'activate' && '재활성화 확인'}
                {pendingAction === 'revoke' && '폐기 확인'}
              </h2>
            </div>
            <div className="card__body">
              <p style={{ fontSize: 14, lineHeight: 1.6 }}>
                {pendingAction === 'suspend' &&
                  `${selectedAdmin.fullName} (@${selectedAdmin.username})의 ADMIN VC를 비활성화하시겠습니까? (복구 가능)`}
                {pendingAction === 'activate' &&
                  `${selectedAdmin.fullName} (@${selectedAdmin.username})의 ADMIN VC를 활성화하시겠습니까?`}
                {pendingAction === 'revoke' &&
                  `주의: ${selectedAdmin.fullName} (@${selectedAdmin.username})의 ADMIN VC를 폐기하시겠습니까? (되돌릴 수 없음)`}
              </p>
            </div>
            <div className="card__footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setShowConfirmDialog(false)}>
                취소
              </Button>
              <Button
                variant={pendingAction === 'revoke' ? 'danger' : pendingAction === 'suspend' ? 'danger' : 'primary'}
                disabled={busy}
                onClick={applyAction}
              >
                {busy
                  ? '처리 중…'
                  : pendingAction === 'suspend'
                    ? '비활성화'
                    : pendingAction === 'activate'
                      ? '재활성화'
                      : '폐기'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
