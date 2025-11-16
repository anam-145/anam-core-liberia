'use client';
import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

type AdminRole = 'SYSTEM_ADMIN' | 'STAFF';
type VCStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
type OnboardingStatus = 'PENDING_REVIEW' | 'APPROVED' | 'ACTIVE' | 'REJECTED';
type AdminStatus = 'ALL' | VCStatus;

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

export default function AdminsPage() {
  const [admins, setAdmins] = useState<AdminData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AdminStatus>('ALL');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminData | null>(null);
  const [busy, setBusy] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Loading/empty/error states
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      setHasError(false);
      try {
        const res = await fetch('/api/admin/admins');
        if (!res.ok) {
          setHasError(true);
          setErrorStatus(res.status);
        } else {
          const data = (await res.json()) as { admins: AdminData[] };
          setAdmins(data.admins || []);
        }
      } catch {
        setHasError(true);
        setErrorStatus(500);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

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
      // Also reflect in details modal immediately
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
      {/* Page Header */}
      <div className="mb-6 lg:mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-[var(--text)]">관리자</h1>
            <p className="text-sm lg:text-base text-[var(--muted)] mt-1">스태프 계정 관리 (역할은 이벤트별 할당)</p>
          </div>
          <div />
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
      {admins.length === 0 && !isLoading && !hasError && (
        <div className="card">
          <div className="card__body text-center py-12">
            <p className="text-[var(--muted)]">아직 관리자가 없습니다.</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {hasError && !isLoading && (
        <div className="card">
          <div className="card__body text-center py-12">
            <p className="text-red-600 mb-4">
              {errorStatus === 401 || errorStatus === 403 ? '접근 권한이 없습니다.' : '문제가 발생했어요.'}
            </p>
            {errorStatus === 401 || errorStatus === 403 ? (
              <Button variant="secondary" onClick={() => (window.location.href = '/dashboard')}>
                대시보드로 이동
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => window.location.reload()}>
                다시 시도
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Desktop Table */}
      {!isLoading && admins.length > 0 && !hasError && (
        <>
          <div className="hidden lg:block overflow-x-auto">
            <table className="table min-w-[720px]">
              <thead>
                <tr>
                  <th>이름 / DID</th>
                  <th>상태</th>
                  <th>VC 상태</th>
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
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border">
                        {admin.onboardingStatus || 'ACTIVE'}
                      </span>
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
                          상세
                        </button>
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
                    <div>상태: {admin.onboardingStatus || 'ACTIVE'}</div>
                    <div>생성일: {formatDate(admin.createdAt)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSelectedAdmin(admin);
                        setShowDetails(true);
                      }}
                    >
                      상세
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Create Admin Modal removed */}

      {/* Edit modal removed: only suspend/reactivate supported */}

      {/* Confirm Dialog (VC suspend/activate/revoke) */}
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
                {pendingAction === 'suspend' && 'VC 일시정지 확인'}
                {pendingAction === 'activate' && 'VC 재활성화 확인'}
                {pendingAction === 'revoke' && 'VC 폐기(영구) 확인'}
              </h2>
            </div>
            <div className="card__body">
              <p style={{ fontSize: 14, lineHeight: 1.6 }}>
                {pendingAction === 'suspend' &&
                  `${selectedAdmin.fullName} (@${selectedAdmin.username})의 ADMIN VC를 일시정지하시겠습니까? (나중에 재활성화 가능)`}
                {pendingAction === 'activate' &&
                  `${selectedAdmin.fullName} (@${selectedAdmin.username})의 ADMIN VC를 재활성화하시겠습니까?`}
                {pendingAction === 'revoke' &&
                  `주의: ${selectedAdmin.fullName} (@${selectedAdmin.username})의 ADMIN VC를 영구 폐기하시겠습니까? (되돌릴 수 없음)`}
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
                    ? '일시정지'
                    : pendingAction === 'activate'
                      ? '재활성화'
                      : '폐기(영구)'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Details Drawer/Modal */}
      {showDetails && selectedAdmin && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-details-title"
          className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4"
          onClick={() => setShowDetails(false)}
        >
          <div className="card w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div
              className="card__header"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <h2 id="admin-details-title" style={{ fontWeight: 800 }}>
                관리자 상세
              </h2>
              <button className="btn btn--ghost btn--sm" onClick={() => setShowDetails(false)} aria-label="닫기">
                ✕
              </button>
            </div>
            <div className="card__body">
              <div className="space-y-2 text-sm">
                <div>
                  <strong>이름</strong>: {selectedAdmin.fullName} (@{selectedAdmin.username})
                </div>
                <div>
                  <strong>역할</strong>: {selectedAdmin.role}
                </div>
                <div>
                  <strong>온보딩</strong>: {selectedAdmin.onboardingStatus || 'ACTIVE'}
                </div>
                <div>
                  <strong>상태</strong>: {getStatusLabel(getEffectiveStatus(selectedAdmin))}
                </div>
                <div>
                  <strong>DID</strong>: {selectedAdmin.did || '(없음)'}
                </div>
                <div>
                  <strong>생성일</strong>: {formatDate(selectedAdmin.createdAt)}
                </div>
              </div>
            </div>
            <div
              className="card__footer"
              style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}
            >
              {/* System Admin은 파괴적 액션 숨김 */}
              {selectedAdmin.role === 'SYSTEM_ADMIN' ? (
                <Button variant="secondary" onClick={() => setShowDetails(false)}>
                  닫기
                </Button>
              ) : (
                <>
                  {/* 온보딩 섹션: PENDING_REVIEW에서만 노출 (일회성) */}
                  {selectedAdmin.onboardingStatus === 'PENDING_REVIEW' && (
                    <>
                      <div className="text-[var(--muted)]" style={{ fontSize: 12, marginRight: 'auto' }}>
                        승인 시, 해당 사용자는 다음 로그인에서 자동으로 초기 설정이 진행됩니다.
                        <br />
                        (지갑 생성 → DID 온체인 등록 → ADMIN VC 발급/등록 → Vault 암호화 후 Custody 저장)
                      </div>
                      <Button
                        onClick={async () => {
                          const res = await fetch(`/api/admin/admins/${selectedAdmin.id}/approve`, { method: 'POST' });
                          if (res.ok) {
                            setAdmins((list) =>
                              list.map((a) => (a.id === selectedAdmin.id ? { ...a, onboardingStatus: 'APPROVED' } : a)),
                            );
                            // modal 내 즉시 반영
                            setSelectedAdmin((cur) =>
                              cur ? ({ ...cur, onboardingStatus: 'APPROVED' } as AdminData) : cur,
                            );
                          }
                        }}
                      >
                        승인 (온보딩)
                      </Button>
                    </>
                  )}
                  {/* 승인은 되었지만 최초 로그인 전이면 VC 액션 숨김 */}
                  {selectedAdmin.onboardingStatus === 'APPROVED' && selectedAdmin.isActive === false && (
                    <span className="text-[var(--muted)]" style={{ fontSize: 12 }}>
                      최초 로그인 시 자동 활성화(VC 발급) 대기 중
                    </span>
                  )}

                  {/* VC 액션 섹션: VC 존재/활성화 상태에서만 노출 */}
                  {selectedAdmin.onboardingStatus === 'ACTIVE' && getEffectiveStatus(selectedAdmin) === 'ACTIVE' && (
                    <>
                      <Button
                        variant="danger"
                        onClick={() => {
                          setPendingAction('suspend');
                          setShowConfirmDialog(true);
                        }}
                        disabled={busy}
                      >
                        VC 일시정지
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setPendingAction('revoke');
                          setShowConfirmDialog(true);
                        }}
                        disabled={busy}
                      >
                        VC 폐기(영구)
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
                        VC 재활성화
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setPendingAction('revoke');
                          setShowConfirmDialog(true);
                        }}
                        disabled={busy}
                      >
                        VC 폐기(영구)
                      </Button>
                    </>
                  )}
                  {getEffectiveStatus(selectedAdmin) === 'REVOKED' && (
                    <Button variant="secondary" disabled>
                      폐기됨
                    </Button>
                  )}
                  <Button variant="secondary" onClick={() => setShowDetails(false)}>
                    닫기
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
