'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

type USSDStatus = 'NOT_APPLICABLE' | 'PENDING' | 'ACTIVE';
type VCStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
type RegistrationType = 'ANAMWALLET' | 'USSD' | 'PAPERVOUCHER';

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
  registrationType?: RegistrationType | null;
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
  const [downloadError, setDownloadError] = useState('');

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
      return new Date(iso).toISOString().slice(0, 10) + ' UTC';
    } catch {
      return '-';
    }
  };

  // USSD 뱃지 제거

  const shorten = (v?: string | null) => {
    if (!v) return '-';
    return v.length > 16 ? `${v.slice(0, 8)}…${v.slice(-6)}` : v;
  };

  // 파일 다운로드 함수
  const handleDownload = async (filePath: string, fileName: string) => {
    setDownloadError(''); // 이전 에러 초기화

    try {
      const response = await fetch(`/api/admin/files?path=${encodeURIComponent(filePath)}`);

      if (!response.ok) {
        setDownloadError('Failed to download file.');
        return;
      }

      // Blob으로 변환
      const blob = await response.blob();

      // 다운로드 링크 생성
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();

      // 정리
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      setDownloadError('An error occurred while downloading the file.');
    }
  };

  // 종이바우처 발급 함수
  const handleIssuePaperVoucher = (userId: number) => {
    window.open(`/print/users/${userId}/paper-voucher`, '_blank');
  };

  return (
    <div className="max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="mb-6 lg:mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-[var(--text)]">Users</h1>
            <p className="text-sm lg:text-base text-[var(--muted)] mt-1">Manage participant accounts</p>
          </div>
          <Link href="/users/new">
            <Button>+ New User</Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4 lg:mb-6">
        <div className="card__body">
          <div className="grid grid-cols-1 gap-4">
            <Input
              type="text"
              placeholder="Search by name, phone, email, wallet address..."
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
            <p className="text-red-600 mb-4">Failed to load user list.</p>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Empty */}
      {!hasError && !isLoading && filtered.length === 0 && (
        <div className="card">
          <div className="card__body text-center py-12">
            <p className="text-[var(--muted)]">No users to display.</p>
          </div>
        </div>
      )}

      {/* Table */}
      {!hasError && !isLoading && filtered.length > 0 && (
        <>
          <div className="hidden lg:block">
            <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
              <table className="table min-w-[900px]">
                <thead>
                  <tr>
                    <th>User / DID</th>
                    <th>Registration Type</th>
                    <th>Active</th>
                    <th>USSD</th>
                    <th>VC Status</th>
                    <th>Registered</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.userId}>
                      <td>
                        <div style={{ maxWidth: '200px' }}>
                          <div style={{ fontWeight: 700, marginBottom: 2 }}>{u.name}</div>
                          <div
                            style={{
                              fontSize: 12,
                              color: 'var(--muted)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {u.did || '(No DID)'}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                            u.registrationType === 'ANAMWALLET'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : u.registrationType === 'USSD'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : u.registrationType === 'PAPERVOUCHER'
                                  ? 'bg-orange-50 text-orange-700 border-orange-200'
                                  : 'bg-gray-50 text-gray-700 border-gray-200'
                          }`}
                        >
                          {u.registrationType === 'ANAMWALLET'
                            ? 'AnamWallet'
                            : u.registrationType === 'USSD'
                              ? 'USSD'
                              : u.registrationType === 'PAPERVOUCHER'
                                ? 'Paper Voucher'
                                : '-'}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                            u.isActive
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-gray-50 text-gray-700 border-gray-200'
                          }`}
                        >
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                            u.ussdStatus === 'ACTIVE'
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : u.ussdStatus === 'PENDING'
                                ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                : 'bg-gray-50 text-gray-700 border-gray-200'
                          }`}
                        >
                          {u.ussdStatus === 'ACTIVE' ? 'Active' : u.ussdStatus === 'PENDING' ? 'Pending' : 'N/A'}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                            u.vcStatus === 'ACTIVE'
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : u.vcStatus === 'SUSPENDED'
                                ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                : u.vcStatus === 'REVOKED'
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-gray-50 text-gray-700 border-gray-200'
                          }`}
                        >
                          {u.vcStatus === 'ACTIVE'
                            ? 'Active'
                            : u.vcStatus === 'SUSPENDED'
                              ? 'Suspended'
                              : u.vcStatus === 'REVOKED'
                                ? 'Revoked'
                                : 'N/A'}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--muted)' }}>{formatDate(u.createdAt)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            className="btn btn--secondary btn--sm"
                            onClick={() => {
                              setSelectedUser(u);
                              setShowDetails(true);
                              setDownloadError(''); // 에러 초기화
                            }}
                          >
                            Details
                          </button>
                          {u.hasCustodyWallet && (
                            <button
                              className="btn btn--primary btn--sm"
                              onClick={() => handleIssuePaperVoucher(u.id)}
                              title="Issue Paper Voucher"
                            >
                              Issue Paper Voucher
                            </button>
                          )}
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
                    <button className="btn btn--ghost btn--sm" aria-label="Menu">
                      ⋯
                    </button>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
                    <div>
                      Wallet: <code style={{ fontSize: 12 }}>{shorten(u.walletAddress)}</code>
                    </div>
                    <div>Created: {formatDate(u.createdAt)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSelectedUser(u);
                        setShowDetails(true);
                      }}
                    >
                      Details
                    </Button>
                    {u.hasCustodyWallet && (
                      <Button variant="primary" onClick={() => handleIssuePaperVoucher(u.id)}>
                        Issue Paper Voucher
                      </Button>
                    )}
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
              Participant Details
            </div>
            <div className="card__body max-h-[calc(100vh-12rem)] overflow-y-auto">
              {/* Basic Information */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h3 className="font-semibold mb-3">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">Name:</span>
                    <span className="ml-2 font-medium">{selectedUser.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">ID:</span>
                    <span className="ml-2">{selectedUser.userId}</span>
                  </div>
                  {selectedUser.phoneNumber && (
                    <div>
                      <span className="text-gray-600">Phone:</span>
                      <span className="ml-2">{selectedUser.phoneNumber}</span>
                    </div>
                  )}
                  {selectedUser.email && (
                    <div>
                      <span className="text-gray-600">Email:</span>
                      <span className="ml-2">{selectedUser.email}</span>
                    </div>
                  )}
                  {selectedUser.gender && (
                    <div>
                      <span className="text-gray-600">Gender:</span>
                      <span className="ml-2">{selectedUser.gender}</span>
                    </div>
                  )}
                  {selectedUser.dateOfBirth && (
                    <div>
                      <span className="text-gray-600">Date of Birth:</span>
                      <span className="ml-2">{formatDate(selectedUser.dateOfBirth)}</span>
                    </div>
                  )}
                  {selectedUser.nationality && (
                    <div>
                      <span className="text-gray-600">Nationality:</span>
                      <span className="ml-2">{selectedUser.nationality}</span>
                    </div>
                  )}
                  {selectedUser.address && (
                    <div className="md:col-span-2">
                      <span className="text-gray-600">Address:</span>
                      <p className="mt-1">{selectedUser.address}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* DID/Wallet Information */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h3 className="font-semibold mb-3">DID/Wallet Information</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">DID:</span>
                    <div className="font-mono text-xs bg-white p-2 rounded mt-1 break-all">
                      {selectedUser.did || '-'}
                    </div>
                  </div>
                  {selectedUser.walletAddress && (
                    <div>
                      <span className="text-gray-600">Wallet Address:</span>
                      <div className="font-mono text-xs bg-white p-2 rounded mt-1 break-all">
                        {selectedUser.walletAddress}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Information */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h3 className="font-semibold mb-3">Status Information</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-sm text-gray-600">User Status:</span>
                    <div className="mt-1">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                          selectedUser.isActive
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-gray-50 text-gray-700 border-gray-200'
                        }`}
                      >
                        {selectedUser.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">VC Status:</span>
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
                          ? 'Active'
                          : selectedUser.vcStatus === 'SUSPENDED'
                            ? 'Suspended'
                            : 'None'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* KYC Documents */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h3 className="font-semibold mb-3">KYC Documents</h3>
                <div className="flex gap-2">
                  {selectedUser.kycDocumentPath ? (
                    <>
                      <button
                        className="px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700"
                        onClick={() =>
                          handleDownload(
                            selectedUser.kycDocumentPath!,
                            `${selectedUser.name}_ID.${selectedUser.kycDocumentPath!.split('.').pop()}`,
                          )
                        }
                      >
                        Download ID
                      </button>
                      {selectedUser.kycFacePath && (
                        <button
                          className="px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700"
                          onClick={() =>
                            handleDownload(
                              selectedUser.kycFacePath!,
                              `${selectedUser.name}_Photo.${selectedUser.kycFacePath!.split('.').pop()}`,
                            )
                          }
                        >
                          Download Photo
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-gray-500">No KYC documents</span>
                  )}
                </div>
                {downloadError && <div style={{ color: '#c33', fontSize: 12, marginTop: 8 }}>{downloadError}</div>}
              </div>
            </div>
            <div className="card__footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setShowDetails(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
