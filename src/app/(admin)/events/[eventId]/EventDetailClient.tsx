'use client';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
// Simple Modal Component
interface SimpleModalProps {
  children: React.ReactNode;
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

// Check-in modal with three methods and per-method forms
function CheckInModal({ onClose }: { onClose: () => void }) {
  const [method, setMethod] = useState<'ANAMWALLET' | 'USSD' | 'PAPER' | null>(null);
  const [ussdPin, setUssdPin] = useState('');
  const [paperPin, setPaperPin] = useState('');

  function resetAndClose() {
    setMethod(null);
    setUssdPin('');
    setPaperPin('');
    onClose();
  }

  return (
    <SimpleModal onClose={resetAndClose} className="max-w-xl">
      <div className="card w-full max-w-xl mx-auto">
        <div className="card__header">체크인</div>
        <div className="card__body">
          {!method && (
            <div className="py-2">
              <p className="text-sm text-gray-600 mb-4">체크인 방법을 선택하세요.</p>
              <div className="flex flex-col gap-3">
                {/* AnamWallet */}
                <button
                  type="button"
                  className="w-full flex items-center gap-3 p-4 border rounded-lg bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                  onClick={() => {
                    // TODO: 휴대폰 api 연결 예정 (AnamWallet)
                    console.log('AnamWallet 체크인 (휴대폰 API 연결 예정)');
                  }}
                  aria-label="AnamWallet 체크인"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icons/camera.svg" alt="" className="w-6 h-6" />
                  <div className="flex-1 text-left">
                    <div className="text-base font-semibold">AnamWallet</div>
                    <div className="text-xs text-gray-500">앱으로 체크인</div>
                  </div>
                </button>

                {/* USSD */}
                <button
                  type="button"
                  className="w-full flex items-center gap-3 p-4 border rounded-lg bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                  onClick={() => setMethod('USSD')}
                  aria-label="USSD 체크인"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icons/camera.svg" alt="" className="w-6 h-6" />
                  <div className="flex-1 text-left">
                    <div className="text-base font-semibold">USSD</div>
                    <div className="text-xs text-gray-500">피처폰 사용자 체크인</div>
                  </div>
                </button>

                {/* Paper Voucher */}
                <button
                  type="button"
                  className="w-full flex items-center gap-3 p-4 border rounded-lg bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                  onClick={() => setMethod('PAPER')}
                  aria-label="Paper 바우처 체크인"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icons/camera.svg" alt="" className="w-6 h-6" />
                  <div className="flex-1 text-left">
                    <div className="text-base font-semibold">Paper 바우처</div>
                    <div className="text-xs text-gray-500">QR 바우처로 체크인</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {method === 'USSD' && (
            <div className="py-2">
              <div className="mb-3">
                <button
                  type="button"
                  className="text-sm text-[var(--brand)] hover:underline"
                  onClick={() => setMethod(null)}
                >
                  ← 방법 선택으로 돌아가기
                </button>
              </div>
              <h3 className="text-base font-semibold mb-3">USSD 체크인</h3>
              <div className="grid gap-3">
                <Input
                  label="비밀번호(PIN)"
                  type="number"
                  placeholder="숫자만 입력"
                  value={ussdPin}
                  onChange={(e) => setUssdPin(e.target.value)}
                  inputMode="numeric"
                />
              </div>
            </div>
          )}

          {method === 'PAPER' && (
            <div className="py-2">
              <div className="mb-3">
                <button
                  type="button"
                  className="text-sm text-[var(--brand)] hover:underline"
                  onClick={() => setMethod(null)}
                >
                  ← 방법 선택으로 돌아가기
                </button>
              </div>
              <h3 className="text-base font-semibold mb-3">Paper 바우처 체크인</h3>
              <div className="grid gap-3">
                <Input
                  label="바우처 비밀번호"
                  type="number"
                  placeholder="숫자만 입력"
                  value={paperPin}
                  onChange={(e) => setPaperPin(e.target.value)}
                  inputMode="numeric"
                />
              </div>
            </div>
          )}
        </div>
        <div className="card__footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={resetAndClose}>
            닫기
          </Button>
        </div>
      </div>
    </SimpleModal>
  );
}

interface ParticipantData {
  id: number;
  participantId: string;
  name: string;
  did: string;
  phoneNumber?: string;
  email?: string;
  gender?: string;
  dateOfBirth?: string;
  nationality?: string;
  address?: string;
  ussdStatus: 'NOT_APPLICABLE' | 'PENDING' | 'ACTIVE';
  hasCustodyWallet: boolean;
  vcStatus?: 'ACTIVE' | 'SUSPENDED' | 'REVOKED'; // From join with VC table
  kycDocumentPath?: string;
  kycFacePath?: string;
  isActive: boolean;
  attendance: 'PRESENT' | 'ABSENT';
  checkInTime?: string;
  paymentStatus: 'AWAITING' | 'CONFIRMING' | 'PAID' | 'NOT_ELIGIBLE';
  createdAt?: string;
  walletAddress?: string;
}

// Mock data
const MOCK_PARTICIPANTS: ParticipantData[] = [
  {
    id: 1,
    participantId: 'p_001',
    name: 'Comfort Wleh',
    did: 'did:anam:user:3Wv2H5MK8YGtDds8V',
    phoneNumber: '+231886123456',
    email: 'comfort.wleh@example.com',
    gender: '여성',
    dateOfBirth: '1990-05-15',
    nationality: 'Liberian',
    address: 'Monrovia, Montserrado County',
    ussdStatus: 'ACTIVE',
    hasCustodyWallet: true,
    vcStatus: 'ACTIVE',
    kycDocumentPath: '/docs/kyc_001.pdf',
    kycFacePath: '/docs/face_001.jpg',
    isActive: true,
    attendance: 'PRESENT',
    checkInTime: '8:55 AM',
    paymentStatus: 'AWAITING',
    createdAt: '2025-01-20T10:00:00Z',
    walletAddress: '0x1234567890123456789012345678901234567890',
  },
  {
    id: 2,
    participantId: 'p_002',
    name: 'Joseph Kpoto',
    did: 'did:anam:user:4KpN3RHmLBxjdNfL9',
    phoneNumber: '+231775234567',
    ussdStatus: 'NOT_APPLICABLE',
    hasCustodyWallet: false,
    vcStatus: 'ACTIVE',
    isActive: true,
    attendance: 'PRESENT',
    checkInTime: '8:54 AM',
    paymentStatus: 'AWAITING',
  },
  {
    id: 3,
    participantId: 'p_003',
    name: 'Grace Toe',
    did: 'did:anam:user:9TmG8ZbWdKuQnPy4K',
    phoneNumber: '+231880345678',
    ussdStatus: 'PENDING',
    hasCustodyWallet: true,
    vcStatus: 'ACTIVE',
    isActive: true,
    attendance: 'PRESENT',
    checkInTime: '8:53 AM',
    paymentStatus: 'AWAITING',
  },
  {
    id: 4,
    participantId: 'p_004',
    name: 'Martha Kollie',
    did: 'did:anam:user:AFnH9PcXeLtRoPz5L',
    phoneNumber: '+231777456789',
    ussdStatus: 'NOT_APPLICABLE',
    hasCustodyWallet: false,
    vcStatus: 'ACTIVE',
    isActive: true,
    attendance: 'PRESENT',
    checkInTime: '8:25 AM',
    paymentStatus: 'PAID',
  },
  {
    id: 5,
    participantId: 'p_005',
    name: 'Patrick Nyemah',
    did: 'did:anam:user:BGpJ2QdYfMuSqQa6M',
    phoneNumber: '+231886567890',
    ussdStatus: 'ACTIVE',
    hasCustodyWallet: true,
    vcStatus: 'SUSPENDED',
    isActive: false,
    attendance: 'PRESENT',
    checkInTime: '8:20 AM',
    paymentStatus: 'PAID',
  },
  {
    id: 6,
    participantId: 'p_006',
    name: 'James Kollie',
    did: 'did:anam:user:2NEpo7TZRRrLZSi2U',
    phoneNumber: '+231775678901',
    ussdStatus: 'NOT_APPLICABLE',
    hasCustodyWallet: false,
    vcStatus: 'ACTIVE',
    isActive: true,
    attendance: 'ABSENT',
    paymentStatus: 'NOT_ELIGIBLE',
  },
];

interface EventDetailClientProps {
  eventId: string;
  onBack?: () => void;
}

export default function EventDetailClient({ eventId, onBack }: EventDetailClientProps) {
  // eventId will be used for API calls
  console.log('Event ID:', eventId);
  const [participants, _setParticipants] = useState<ParticipantData[]>(MOCK_PARTICIPANTS);
  const [activeTab, setActiveTab] = useState<'participants' | 'payment'>('participants');
  const [_filterStatus, _setFilterStatus] = useState<'all' | 'present' | 'absent'>('all');
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [addUserQuery, setAddUserQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [userList] = useState([
    { userId: 'u_001', fullName: 'user', username: 'user', email: null as string | null },
    { userId: 'u_002', fullName: 'user', username: 'user', email: null as string | null },
  ]);
  const [showQrScanModal, setShowQrScanModal] = useState(false);
  // 참가자 상세 모달 제거 (간소화)

  // Event info (mock)
  const eventInfo = {
    name: 'Youth Digital Skills Training Workshop',
    startDate: '2025-01-25',
    endDate: '2025-01-29',
    dailyDsa: 15,
    maxParticipants: 50,
    status: 'ONGOING',
    currentDay: 3,
  };

  // Calculate statistics
  const stats = {
    total: participants.length,
    present: participants.filter((p) => p.attendance === 'PRESENT').length,
    absent: participants.filter((p) => p.attendance === 'ABSENT').length,
    awaiting: participants.filter((p) => p.paymentStatus === 'AWAITING').length,
    paid: participants.filter((p) => p.paymentStatus === 'PAID').length,
    totalDisbursed: participants.filter((p) => p.paymentStatus === 'PAID').length * eventInfo.dailyDsa,
  };

  // Attendance visualization demo states

  // Dates between start and end (inclusive)
  const getDateRange = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const list: string[] = [];
    const d = new Date(s);
    while (d <= e) {
      list.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
    return list;
  };
  const eventDates = getDateRange(eventInfo.startDate, eventInfo.endDate);
  const todayIdx = Math.max(0, Math.min(eventDates.length - 1, eventInfo.currentDay - 1));

  // Build demo attendance pattern up to todayIdx
  function computeAttendance(participant: ParticipantData, dates: string[], todayIndex: number): Array<boolean | null> {
    return dates.map((_, idx) => {
      if (idx > todayIndex) return null; // future 날짜는 null
      // 현재 스켈레톤 데이터 기준: 오늘 출석 여부만 반영
      return idx === todayIndex ? participant.attendance === 'PRESENT' : false;
    });
  }

  // Participants list (no search filter)
  const filteredParticipants = participants;

  // Placeholder functions - API 연결 예정
  const approveDSA = (participantId: string) => {
    // API 연결 예정
    console.log('DSA 승인 API 연결 예정:', participantId);
  };

  const _approveAllPending = () => {
    // API 연결 예정
    console.log('전체 DSA 승인 API 연결 예정');
  };

  // Get status badge color
  const _getPaymentBadgeColor = (status: string) => {
    const map: Record<string, string> = {
      AWAITING: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      CONFIRMING: 'bg-blue-50 text-blue-700 border-blue-200',
      PAID: 'bg-green-50 text-green-700 border-green-200',
      NOT_ELIGIBLE: 'bg-gray-50 text-gray-700 border-gray-200',
    };
    return map[status];
  };

  const _getPaymentLabel = (status: string) => {
    const map: Record<string, string> = {
      AWAITING: '승인 대기',
      CONFIRMING: '확인 중',
      PAID: '지급 완료',
      NOT_ELIGIBLE: '대상 아님',
    };
    return map[status];
  };

  return (
    <div className="max-w-screen-2xl mx-auto">
      {/* Back Button */}
      {onBack && (
        <div className="mb-4">
          <Button variant="secondary" onClick={onBack}>
            ← 대시보드로 돌아가기
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
              <span>{stats.total} 참가자</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-white/20 backdrop-blur px-4 py-2 rounded-lg">
              <span className="text-sm">Day {eventInfo.currentDay}</span>
            </div>
            {/* 헤더 우측의 QR 스캔 버튼 제거 (하단 툴바에 이미 존재) */}
          </div>
        </div>
      </div>

      {/* DSA Info */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5 mb-6 flex items-center gap-4">
        <div className="flex-1">
          <h3 className="font-semibold text-green-900">일일 체재비(DSA) 시스템 활성화</h3>
          <p className="text-sm text-green-700 mt-1">
            참가자는 QR 체크인 확인 후 DSA를 받습니다. 지급은 관리자 승인이 필요합니다.
          </p>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-900">${eventInfo.dailyDsa} USDC</div>
          <div className="text-xs text-green-700">일일 지급액</div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="card__body">
            <div className="text-sm text-[var(--muted)]">전체 참가자</div>
            <div className="text-2xl font-bold mt-1">{stats.total}</div>
          </div>
        </div>
        <div className="card">
          <div className="card__body">
            <div className="text-sm text-[var(--muted)]">오늘 출석</div>
            <div className="text-2xl font-bold mt-1 text-green-600">{stats.present}</div>
          </div>
        </div>
        <div className="card border-yellow-200 bg-yellow-50">
          <div className="card__body">
            <div className="text-sm text-yellow-700">DSA 승인 대기</div>
            <div className="text-2xl font-bold mt-1 text-yellow-700">{stats.awaiting}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border mb-6">
        <div className="flex border-b overflow-x-auto">
          {[
            { key: 'participants', label: '참가자 관리' },
            { key: 'payment', label: 'DSA 지급' },
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
                <h3 className="text-lg font-semibold">총 {participants.length}명 참가자</h3>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setShowQrScanModal(true)}>
                    체크인
                  </Button>
                  <Button onClick={() => setShowRegisterModal(true)}>사용자 등록</Button>
                </div>
              </div>

              {/* 검색창 제거됨 */}

              {/* Participants Table (참가자 관리: 출석 날짜/총 DSA만 표시) */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">참가자</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">출석</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">총 DSA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredParticipants.map((participant) => (
                      <tr key={participant.participantId} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div>
                            <div className="font-semibold text-gray-900">{participant.name}</div>
                            <div
                              className="text-xs text-gray-500 font-mono truncate max-w-[200px]"
                              title={participant.did}
                            >
                              {participant.did}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          {(() => {
                            const att = computeAttendance(participant, eventDates, todayIdx);
                            const daysDone = todayIdx + 1;
                            const presentCount = att.filter((v) => v === true).length;
                            const pct = daysDone > 0 ? Math.round((presentCount / daysDone) * 100) : 0;
                            return (
                              <div className="min-w-[200px]">
                                {/* 도트 */}
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {att.map((v, idx) => {
                                    const isToday = idx === todayIdx;
                                    const cls =
                                      v === true ? 'bg-green-500' : v === false ? 'bg-gray-300' : 'bg-gray-100';
                                    return (
                                      <span
                                        key={idx}
                                        className={`inline-block w-2.5 h-2.5 rounded-full ${cls} ${isToday ? 'ring-1 ring-gray-400' : ''}`}
                                        title={`${eventDates[idx]}`}
                                      />
                                    );
                                  })}
                                </div>
                                {/* 막대 */}
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-[var(--brand)] h-2 rounded-full transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <div className="text-[11px] text-gray-500 mt-1">
                                  {presentCount}/{daysDone}일 ({pct}%)
                                </div>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          {(() => {
                            const paid = participant.paymentStatus === 'PAID' ? eventInfo.dailyDsa : 0;
                            return <div className="font-medium">${paid}</div>;
                          })()}
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
                  <h3 className="text-lg font-semibold">DSA 지급 관리</h3>
                  <select className="border border-gray-300 rounded-md px-3 py-1 text-sm">
                    <option value="2025-01-25">Day 1 - 2025-01-25</option>
                    <option value="2025-01-26">Day 2 - 2025-01-26</option>
                    <option value="2025-01-27" selected>
                      Day 3 - 2025-01-27 (오늘)
                    </option>
                    <option value="2025-01-28">Day 4 - 2025-01-28</option>
                    <option value="2025-01-29">Day 5 - 2025-01-29</option>
                  </select>
                </div>
                {/* 일일 지급액 표시 제거 */}
              </div>

              {/* Daily Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="card">
                  <div className="card__body">
                    <div className="text-xs text-gray-600">체크인 완료</div>
                    <div className="text-xl font-bold">{stats.present}명</div>
                  </div>
                </div>
                <div className="card">
                  <div className="card__body">
                    <div className="text-xs text-gray-600">승인 대기</div>
                    <div className="text-xl font-bold text-yellow-600">{stats.awaiting}명</div>
                  </div>
                </div>
                <div className="card">
                  <div className="card__body">
                    <div className="text-xs text-gray-600">지급 완료</div>
                    <div className="text-xl font-bold text-green-600">{stats.paid}명</div>
                  </div>
                </div>
                <div className="card">
                  <div className="card__body">
                    <div className="text-xs text-gray-600">총 지급액</div>
                    <div className="text-xl font-bold">${stats.totalDisbursed}</div>
                  </div>
                </div>
              </div>

              {/* Payment List */}
              <div className="card">
                <div className="card__header flex justify-between items-center">
                  <h4 className="font-medium">지급 대상자 목록</h4>
                </div>
                <div className="card__body">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-3 py-2">참가자</th>
                          <th className="text-left px-3 py-2">체크인 시간</th>
                          <th className="text-left px-3 py-2">사용자 상태</th>
                          <th className="text-left px-3 py-2">VC 상태</th>
                          <th className="text-left px-3 py-2">지급 상태</th>
                          <th className="text-left px-3 py-2">액션</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {participants
                          .filter((p) => p.attendance === 'PRESENT')
                          .map((participant) => (
                            <tr key={participant.participantId} className="hover:bg-gray-50">
                              <td className="px-3 py-2">
                                <div className="font-medium">{participant.name}</div>
                                <div className="text-xs text-gray-500">{participant.phoneNumber}</div>
                              </td>
                              <td className="px-3 py-2 text-xs">{participant.checkInTime}</td>
                              <td className="px-3 py-2">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                    participant.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                  }`}
                                >
                                  {participant.isActive ? '활성' : '비활성'}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                    participant.vcStatus === 'ACTIVE'
                                      ? 'bg-green-100 text-green-700'
                                      : participant.vcStatus === 'SUSPENDED'
                                        ? 'bg-yellow-100 text-yellow-700'
                                        : 'bg-red-100 text-red-700'
                                  }`}
                                >
                                  {participant.vcStatus === 'ACTIVE'
                                    ? '활성'
                                    : participant.vcStatus === 'SUSPENDED'
                                      ? '정지'
                                      : '폐기'}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                    participant.paymentStatus === 'AWAITING'
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : participant.paymentStatus === 'PAID'
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-gray-100 text-gray-700'
                                  }`}
                                >
                                  {participant.paymentStatus === 'AWAITING'
                                    ? '대기'
                                    : participant.paymentStatus === 'PAID'
                                      ? '완료'
                                      : '-'}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                {participant.paymentStatus === 'AWAITING' ? (
                                  <button
                                    className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                                    onClick={() => approveDSA(participant.participantId)}
                                  >
                                    승인
                                  </button>
                                ) : (
                                  <span className="text-xs text-gray-400">-</span>
                                )}
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

      {/* Register Modal (UI only) — 스태프 모달과 동일 카드 레이아웃 */}
      {showRegisterModal && (
        <SimpleModal onClose={() => setShowRegisterModal(false)} className="max-w-xl">
          <div className="card w-full max-w-xl mx-auto">
            <div className="card__header">유저 이벤트 등록</div>
            <div className="card__body">
              <div className="grid gap-4">
                <div>
                  <Input
                    type="text"
                    label="사용자 검색"
                    placeholder="이름, 아이디, 이메일"
                    value={addUserQuery}
                    onChange={(e) => setAddUserQuery(e.target.value)}
                  />
                  <div className="mt-3 space-y-2 max-h-72 overflow-auto">
                    {(() => {
                      const q = addUserQuery.trim().toLowerCase();
                      const filtered = userList.filter((u) => {
                        if (!q) return true;
                        return (
                          u.fullName.toLowerCase().includes(q) ||
                          u.username.toLowerCase().includes(q) ||
                          (u.email || '').toLowerCase().includes(q)
                        );
                      });
                      if (filtered.length === 0) {
                        return <div className="text-[12px] text-[var(--muted)]">검색 결과가 없습니다.</div>;
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
                              <div className="font-medium">{u.fullName}</div>
                              <div className="text-[12px] text-[var(--muted)]">
                                {u.username}
                                {u.email ? ` · ${u.email}` : ''}
                              </div>
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
                    })()}
                  </div>
                </div>
                <div className="text-sm text-[var(--muted)]">💡 선택한 사용자는 이 이벤트에 등록됩니다.</div>
              </div>
            </div>
            <div className="card__footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setShowRegisterModal(false)}>
                취소
              </Button>
              <Button
                disabled={!selectedUserId}
                onClick={() => {
                  // UI only: close modal, clear selection
                  setShowRegisterModal(false);
                  setSelectedUserId('');
                }}
              >
                등록
              </Button>
            </div>
          </div>
        </SimpleModal>
      )}

      {/* Check-in Modal */}
      {showQrScanModal && <CheckInModal onClose={() => setShowQrScanModal(false)} />}

      {/* Participant Detail Modal (removed for simplified management) */}
    </div>
  );
}
