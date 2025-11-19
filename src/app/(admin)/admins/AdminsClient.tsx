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
        return '활성화';
      case 'SUSPENDED':
        return '비활성화';
      case 'REVOKED':
        return '폐기됨';
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
        return '검토 대기';
      case 'APPROVED':
        return '승인됨';
      case 'ACTIVE':
        return '활성';
      case 'REJECTED':
        return '거부됨';
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
            <h1 className="text-2xl lg:text-3xl font-bold text-[var(--text)]">관리자</h1>
            <p className="text-sm lg:text-base text-[var(--muted)] mt-1">스태프 계정 관리 (역할은 이벤트별 할당)</p>
          </div>
          <div />
        </div>
      </div>

      <div className="card mb-4 lg:mb-6">
        <div className="card__body">
          <div className="grid grid-cols-1 gap-4">
            <Input
              type="text"
              placeholder="이름, DID, 이메일 검색..."
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
            <p className="text-[var(--muted)]">아직 관리자가 없습니다.</p>
          </div>
        </div>
      )}

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

      {!isLoading && admins.length > 0 && !hasError && (
        <>
          <div className="hidden lg:block">
            <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
              <table className="table min-w-[640px]">
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
                            {admin.did || '(DID 없음)'}
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
                            상세
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
                    <button className="btn btn--ghost btn--sm" aria-label="메뉴">
                      ⋯
                    </button>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      상태:
                      {admin.onboardingStatus && (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getOnboardingBadgeColor(admin.onboardingStatus)}`}
                        >
                          {getOnboardingLabel(admin.onboardingStatus)}
                        </span>
                      )}
                    </div>
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

      {/* Details Drawer/Modal */}
      {showDetails && selectedAdmin && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-details-title"
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowDetails(false)}
        >
          <div
            className="card w-full max-w-lg my-auto"
            style={{ maxHeight: 'calc(100vh - 2rem)' }}
            onClick={(e) => e.stopPropagation()}
          >
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
            <div className="card__body max-h-[calc(100vh-12rem)] overflow-y-auto">
              {/* 기본 정보 */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h3 className="font-semibold mb-3">기본 정보</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">이름:</span>
                    <span className="ml-2 font-medium">{selectedAdmin.fullName}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">사용자명:</span>
                    <span className="ml-2">@{selectedAdmin.username}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Admin ID:</span>
                    <span className="ml-2">{selectedAdmin.adminId}</span>
                  </div>
                  {selectedAdmin.email && (
                    <div>
                      <span className="text-gray-600">이메일:</span>
                      <span className="ml-2">{selectedAdmin.email}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-600">역할:</span>
                    <span className="ml-2">{selectedAdmin.role === 'SYSTEM_ADMIN' ? 'System Admin' : 'Staff'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">생성일:</span>
                    <span className="ml-2">{formatDate(selectedAdmin.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* DID 정보 */}
              {selectedAdmin.did && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold mb-3">DID 정보</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">DID:</span>
                      <div className="font-mono text-xs bg-white p-2 rounded mt-1 break-all">{selectedAdmin.did}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* 상태 정보 */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h3 className="font-semibold mb-3">상태 정보</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-sm text-gray-600">온보딩 상태:</span>
                    <div className="mt-1">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getOnboardingBadgeColor(selectedAdmin.onboardingStatus || 'ACTIVE')}`}
                      >
                        {getOnboardingLabel(selectedAdmin.onboardingStatus || 'ACTIVE')}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">VC 상태:</span>
                    <div className="mt-1">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadgeColor(getEffectiveStatus(selectedAdmin))}`}
                      >
                        {getStatusLabel(getEffectiveStatus(selectedAdmin))}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">활성 상태:</span>
                    <div className="mt-1">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                          selectedAdmin.isActive
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-gray-50 text-gray-700 border-gray-200'
                        }`}
                      >
                        {selectedAdmin.isActive ? '활성' : '비활성'}
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
                          setBusy(true);
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
                          setBusy(false);
                        }}
                        disabled={busy}
                      >
                        승인 (온보딩)
                      </Button>
                    </>
                  )}
                  {/* 승인은 되었지만 최초 로그인 전이면 VC 액션 숨김 */}
                  {selectedAdmin.onboardingStatus === 'APPROVED' && selectedAdmin.isActive === false && (
                    <div className="text-[var(--muted)]" style={{ fontSize: 12, width: '100%', marginBottom: 8 }}>
                      최초 로그인 시 자동 활성화(VC 발급) 대기 중
                    </div>
                  )}

                  {/* VC 액션 섹션: VC 존재/활성화 상태에서만 노출 */}
                  {/* TODO: API 엔드포인트 구현 후 활성화 (POST /api/vcs/suspend, /api/vcs/activate 필요) */}
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
                  )} */}
                  <Button variant="secondary" onClick={() => setShowDetails(false)}>
                    닫기
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
    </div>
  );
}
