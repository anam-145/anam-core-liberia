'use client';

import { useEffect, useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

type USSDStatus = 'NOT_APPLICABLE' | 'PENDING' | 'ACTIVE';
type VCStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

interface UserRow {
  id: number;
  userId: string;
  name: string;
  phoneNumber: string | null;
  email: string | null;
  nationality: string | null;
  gender: string | null;
  dateOfBirth: string | null; // ISO
  address: string | null;
  walletAddress: string | null;
  did?: string | null;
  vcStatus?: VCStatus | null;
  kycDocumentPath?: string | null;
  kycFacePath?: string | null;
  ussdStatus: USSDStatus;
  isActive: boolean;
  hasCustodyWallet: boolean;
  createdAt: string; // ISO
}

export default function UsersClient() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // USSD 필터 제거 (요청): DID는 검색으로 대체

  const [showDetails, setShowDetails] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      setHasError(false);
      try {
        const res = await fetch(`/api/admin/users`, { cache: 'no-store' });
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        setUsers((data?.users ?? []) as UserRow[]);
      } catch {
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (users || []).filter((u) => {
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        (u.phoneNumber || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.walletAddress || '').toLowerCase().includes(q)
      );
    });
  }, [users, searchQuery]);

  const formatDate = (iso?: string | null) => {
    if (!iso) return '-';
    try {
      return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return '-';
    }
  };

  // USSD 뱃지 제거

  const shorten = (v?: string | null) => {
    if (!v) return '-';
    return v.length > 16 ? `${v.slice(0, 8)}…${v.slice(-6)}` : v;
  };

  return (
    <div className="max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="mb-6 lg:mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-[var(--text)]">사용자</h1>
            <p className="text-sm lg:text-base text-[var(--muted)] mt-1">참가자 계정 관리(디자인만 적용)</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4 lg:mb-6">
        <div className="card__body">
          <div className="grid grid-cols-1 gap-4">
            <Input
              type="text"
              placeholder="이름, 전화, 이메일, 지갑 주소 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="card">
          <div className="card__body space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {hasError && !isLoading && (
        <div className="card">
          <div className="card__body text-center py-12">
            <p className="text-red-600 mb-4">사용자 목록을 불러오지 못했습니다.</p>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              다시 시도
            </Button>
          </div>
        </div>
      )}

      {/* Empty */}
      {!hasError && !isLoading && filtered.length === 0 && (
        <div className="card">
          <div className="card__body text-center py-12">
            <p className="text-[var(--muted)]">표시할 사용자가 없습니다.</p>
          </div>
        </div>
      )}

      {/* Table */}
      {!hasError && !isLoading && filtered.length > 0 && (
        <>
          <div className="hidden lg:block">
            <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
              <table className="table min-w-[760px]">
                <thead>
                  <tr>
                    <th>사용자</th>
                    <th>DID</th>
                    <th>지갑</th>
                    <th>생성일</th>
                    <th>액션</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.userId}>
                      <td>
                        <div style={{ maxWidth: 260 }}>
                          <div style={{ fontWeight: 700, marginBottom: 2 }}>{u.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                            {(u.phoneNumber || '-') + (u.email ? ` · ${u.email}` : '')}
                          </div>
                        </div>
                      </td>
                      <td>
                        <code style={{ fontSize: 12 }}>{shorten(u.did || '') || '-'}</code>
                      </td>
                      <td>
                        <code style={{ fontSize: 12 }}>{shorten(u.walletAddress)}</code>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--muted)' }}>{formatDate(u.createdAt)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            className="btn btn--secondary btn--sm"
                            onClick={() => {
                              setSelectedUser(u);
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

          {/* Mobile cards */}
          <div className="lg:hidden space-y-4">
            {filtered.map((u) => (
              <div key={u.userId} className="card">
                <div className="card__body">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1" style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>{u.name}</div>
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
                        {(u.phoneNumber || '-') + (u.email ? ` · ${u.email}` : '')}
                      </div>
                      <div style={{ fontSize: 12 }}>
                        DID: <code style={{ fontSize: 12 }}>{shorten(u.did || '') || '-'}</code>
                      </div>
                    </div>
                    <button className="btn btn--ghost btn--sm" aria-label="메뉴">
                      ⋯
                    </button>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
                    <div>
                      지갑: <code style={{ fontSize: 12 }}>{shorten(u.walletAddress)}</code>
                    </div>
                    <div>생성일: {formatDate(u.createdAt)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSelectedUser(u);
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

      {/* Details Modal — 이벤트 상세의 참가자 상세 디자인을 반영 */}
      {showDetails && selectedUser && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-details-title"
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowDetails(false)}
        >
          <div className="card w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
            <div className="card__header" id="user-details-title">
              참가자 상세 정보
            </div>
            <div className="card__body max-h-[calc(100vh-12rem)] overflow-y-auto">
              {/* 기본 정보 */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h3 className="font-semibold mb-3">기본 정보</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">이름:</span>
                    <span className="ml-2 font-medium">{selectedUser.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">ID:</span>
                    <span className="ml-2">{selectedUser.userId}</span>
                  </div>
                  {selectedUser.phoneNumber && (
                    <div>
                      <span className="text-gray-600">전화번호:</span>
                      <span className="ml-2">{selectedUser.phoneNumber}</span>
                    </div>
                  )}
                  {selectedUser.email && (
                    <div>
                      <span className="text-gray-600">이메일:</span>
                      <span className="ml-2">{selectedUser.email}</span>
                    </div>
                  )}
                  {selectedUser.gender && (
                    <div>
                      <span className="text-gray-600">성별:</span>
                      <span className="ml-2">{selectedUser.gender}</span>
                    </div>
                  )}
                  {selectedUser.dateOfBirth && (
                    <div>
                      <span className="text-gray-600">생년월일:</span>
                      <span className="ml-2">{formatDate(selectedUser.dateOfBirth)}</span>
                    </div>
                  )}
                  {selectedUser.nationality && (
                    <div>
                      <span className="text-gray-600">국적:</span>
                      <span className="ml-2">{selectedUser.nationality}</span>
                    </div>
                  )}
                  {selectedUser.address && (
                    <div className="md:col-span-2">
                      <span className="text-gray-600">주소:</span>
                      <p className="mt-1">{selectedUser.address}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* DID/지갑 정보 */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h3 className="font-semibold mb-3">DID/지갑 정보</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">DID:</span>
                    <div className="font-mono text-xs bg-white p-2 rounded mt-1 break-all">
                      {selectedUser.did || '-'}
                    </div>
                  </div>
                  {selectedUser.walletAddress && (
                    <div>
                      <span className="text-gray-600">지갑 주소:</span>
                      <div className="font-mono text-xs bg-white p-2 rounded mt-1 break-all">
                        {selectedUser.walletAddress}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 상태 정보 */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h3 className="font-semibold mb-3">상태 정보</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-sm text-gray-600">사용자 상태:</span>
                    <div className="mt-1">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                          selectedUser.isActive
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-gray-50 text-gray-700 border-gray-200'
                        }`}
                      >
                        {selectedUser.isActive ? '활성' : '비활성'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">VC 상태:</span>
                    <div className="mt-1">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                          selectedUser.vcStatus === 'ACTIVE'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : selectedUser.vcStatus === 'SUSPENDED'
                              ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                              : 'bg-gray-50 text-gray-700 border-gray-200'
                        }`}
                      >
                        {selectedUser.vcStatus === 'ACTIVE'
                          ? '활성'
                          : selectedUser.vcStatus === 'SUSPENDED'
                            ? '일시정지'
                            : '없음'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* KYC 문서 */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h3 className="font-semibold mb-3">KYC 문서</h3>
                <div className="flex gap-2">
                  {selectedUser.kycDocumentPath ? (
                    <>
                      <button
                        className="px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700"
                        onClick={() => console.log('KYC 문서 다운로드:', selectedUser.kycDocumentPath)}
                      >
                        신분증 다운로드
                      </button>
                      {selectedUser.kycFacePath && (
                        <button
                          className="px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700"
                          onClick={() => console.log('얼굴 사진 다운로드:', selectedUser.kycFacePath)}
                        >
                          얼굴 사진 다운로드
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-gray-500">KYC 문서가 없습니다</span>
                  )}
                </div>
              </div>
            </div>
            <div className="card__footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setShowDetails(false)}>
                닫기
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
