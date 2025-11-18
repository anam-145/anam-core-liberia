'use client';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
// Simple Modal Component
interface SimpleModalProps {
  children: React.ReactNode;
  onClose: () => void;
}

function SimpleModal({ children, onClose }: SimpleModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
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
  const [searchQuery, setSearchQuery] = useState('');
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showQrScanModal, setShowQrScanModal] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showParticipantModal, setShowParticipantModal] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantData | null>(null);
  const [_kycEnabled, _setKycEnabled] = useState(false);
  const [walletType, setWalletType] = useState<string>('');

  // 참가자 등록 폼 상태
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    email: '',
    nationality: 'Liberia',
    gender: '',
    dateOfBirth: '',
    address: '',
    kycType: '',
    publicKey: '',
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  // Filter participants
  const filteredParticipants = participants.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.did.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  // 폼 유효성 검사
  const validateForm = () => {
    const errors: Record<string, string> = {};

    // 필수 필드 검사
    if (!formData.name.trim()) {
      errors.name = '이름을 입력해주세요';
    }

    // 전화번호는 USSD 선택시에만 필수
    if (walletType === 'ussd' && !formData.phoneNumber.trim()) {
      errors.phoneNumber = 'USSD 서비스를 위해 전화번호가 필요합니다';
    }

    // 전화번호 형식 검사 (입력된 경우) - 9자리 숫자만 허용
    if (formData.phoneNumber && !/^\d{9}$/.test(formData.phoneNumber)) {
      errors.phoneNumber = '전화번호는 9자리 숫자로 입력해주세요 (예: 886123456)';
    }

    // 이메일 형식 검사 (입력된 경우)
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = '올바른 이메일 형식이 아닙니다';
    }

    if (!formData.nationality.trim()) {
      errors.nationality = '국적을 입력해주세요';
    }

    if (!formData.gender) {
      errors.gender = '성별을 선택해주세요';
    }

    if (!formData.dateOfBirth) {
      errors.dateOfBirth = '생년월일을 입력해주세요';
    }

    if (!formData.kycType) {
      errors.kycType = '신분증 유형을 선택해주세요';
    }

    if (!walletType) {
      errors.walletType = '지갑 유형을 선택해주세요';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 폼 제출 처리
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      setError('필수 항목을 모두 입력해주세요');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 전화번호가 있으면 +231 추가
      const phoneWithCountryCode = formData.phoneNumber ? `+231${formData.phoneNumber}` : '';

      // API 호출 예정
      console.log('참가자 등록 데이터:', {
        ...formData,
        phoneNumber: phoneWithCountryCode,
        walletType,
        eventId,
      });

      // 성공시 모달 닫기 및 초기화
      setShowRegisterModal(false);
      resetForm();

      // 성공 메시지 (추후 toast 또는 알림으로 변경)
      console.log('참가자가 성공적으로 등록되었습니다');
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  // 폼 초기화
  const resetForm = () => {
    setFormData({
      name: '',
      phoneNumber: '',
      email: '',
      nationality: 'Liberia',
      gender: '',
      dateOfBirth: '',
      address: '',
      kycType: '',
      publicKey: '',
    });
    setWalletType('');
    setFieldErrors({});
    setError('');
  };

  // Placeholder functions - API 연결 예정
  const approveDSA = (participantId: string) => {
    // API 연결 예정
    console.log('DSA 승인 API 연결 예정:', participantId);
  };

  const approveAllPending = () => {
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
              {/* Toolbar */}
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
                <h3 className="text-lg font-semibold">총 {participants.length}명 참가자</h3>
                <div className="flex gap-2 w-full lg:w-auto">
                  <Input
                    type="text"
                    placeholder="이름, DID 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 lg:w-64"
                  />
                  <Button variant="secondary" onClick={() => setShowQrScanModal(true)}>
                    QR 스캔
                  </Button>
                  <Button onClick={() => setShowRegisterModal(true)}>+ 참가자 등록</Button>
                </div>
              </div>

              {/* Participants Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">참가자</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">사용자 상태</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">VC 상태</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">USSD 상태</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">액션</th>
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
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                              participant.isActive
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : 'bg-gray-50 text-gray-700 border-gray-200'
                            }`}
                          >
                            {participant.isActive ? '활성' : '비활성'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                              participant.vcStatus === 'ACTIVE'
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : participant.vcStatus === 'SUSPENDED'
                                  ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                  : 'bg-red-50 text-red-700 border-red-200'
                            }`}
                          >
                            {participant.vcStatus === 'ACTIVE'
                              ? '활성'
                              : participant.vcStatus === 'SUSPENDED'
                                ? '일시정지'
                                : '폐기'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {participant.ussdStatus !== 'NOT_APPLICABLE' ? (
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                                participant.ussdStatus === 'ACTIVE'
                                  ? 'bg-green-50 text-green-700 border-green-200'
                                  : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                              }`}
                            >
                              {participant.ussdStatus === 'ACTIVE' ? '활성화' : '대기중'}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 flex-wrap">
                            <button
                              className="px-3 py-1 bg-gray-600 text-white text-xs rounded-md hover:bg-gray-700"
                              onClick={() => {
                                setSelectedParticipant(participant);
                                setShowParticipantModal(true);
                              }}
                            >
                              상세
                            </button>
                            <button
                              className="px-3 py-1 bg-gray-600 text-white text-xs rounded-md hover:bg-gray-700"
                              onClick={() => console.log('바우처 QR 발급 API 연결 예정:', participant.participantId)}
                            >
                              바우처 QR 발급
                            </button>
                            {participant.isActive ? (
                              <button
                                className="px-3 py-1 bg-gray-600 text-white text-xs rounded-md hover:bg-gray-700"
                                onClick={() => console.log('사용자 비활성화 API 연결 예정:', participant.participantId)}
                              >
                                비활성화
                              </button>
                            ) : (
                              <button
                                className="px-3 py-1 bg-gray-600 text-white text-xs rounded-md hover:bg-gray-700"
                                onClick={() => console.log('사용자 활성화 API 연결 예정:', participant.participantId)}
                              >
                                활성화
                              </button>
                            )}
                            {participant.vcStatus === 'ACTIVE' && (
                              <button
                                className="px-3 py-1 bg-gray-600 text-white text-xs rounded-md hover:bg-gray-700"
                                onClick={() => console.log('VC 일시정지 API 연결 예정:', participant.participantId)}
                              >
                                VC 일시정지
                              </button>
                            )}
                            {participant.vcStatus === 'SUSPENDED' && (
                              <button
                                className="px-3 py-1 bg-gray-600 text-white text-xs rounded-md hover:bg-gray-700"
                                onClick={() => console.log('VC 재활성화 API 연결 예정:', participant.participantId)}
                              >
                                VC 재활성화
                              </button>
                            )}
                            {participant.vcStatus !== 'REVOKED' && (
                              <button
                                className="px-3 py-1 bg-gray-600 text-white text-xs rounded-md hover:bg-gray-700"
                                onClick={() => console.log('VC 폐기 API 연결 예정:', participant.participantId)}
                              >
                                VC 폐기
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
                <div className="text-sm text-gray-600">
                  일일 지급액: <span className="font-semibold">${eventInfo.dailyDsa} USDC</span>
                </div>
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
                  {stats.awaiting > 0 && (
                    <Button className="btn-sm bg-green-600 hover:bg-green-700 text-white" onClick={approveAllPending}>
                      전체 승인 ({stats.awaiting}명)
                    </Button>
                  )}
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

      {/* Register Modal */}
      {showRegisterModal && (
        <SimpleModal
          onClose={() => {
            setShowRegisterModal(false);
            resetForm();
          }}
        >
          <form onSubmit={handleRegisterSubmit} className="p-6 max-h-[calc(100vh-8rem)] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6">참가자 등록</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">{error}</div>
            )}

            <div className="space-y-4">
              {/* 필수 정보 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">이름 *</label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="예: Comfort Wleh"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: '' });
                    }}
                    required
                  />
                  {fieldErrors.name && <p className="text-red-500 text-xs mt-1">{fieldErrors.name}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">전화번호 {walletType === 'ussd' ? '*' : ''}</label>
                  <div className="flex gap-2">
                    <select
                      className="input"
                      style={{
                        width: '60px',
                        backgroundColor: '#f9fafb',
                        color: '#6b7280',
                        cursor: 'not-allowed',
                        opacity: 0.7,
                      }}
                      disabled
                    >
                      <option value="+231">🇱🇷</option>
                    </select>
                    <input
                      type="text"
                      className="input flex-1"
                      placeholder="886123456"
                      value={formData.phoneNumber}
                      onChange={(e) => {
                        setFormData({ ...formData, phoneNumber: e.target.value });
                        if (fieldErrors.phoneNumber) setFieldErrors({ ...fieldErrors, phoneNumber: '' });
                      }}
                      required={walletType === 'ussd'}
                    />
                  </div>
                  {fieldErrors.phoneNumber && <p className="text-red-500 text-xs mt-1">{fieldErrors.phoneNumber}</p>}
                </div>
              </div>

              {/* 선택 정보 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">이메일</label>
                  <input
                    type="email"
                    className="input w-full"
                    placeholder="email@example.com"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: '' });
                    }}
                  />
                  {fieldErrors.email && <p className="text-red-500 text-xs mt-1">{fieldErrors.email}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">국적 *</label>
                  <input
                    type="text"
                    className="input w-full"
                    value={formData.nationality}
                    onChange={(e) => {
                      setFormData({ ...formData, nationality: e.target.value });
                      if (fieldErrors.nationality) setFieldErrors({ ...fieldErrors, nationality: '' });
                    }}
                    required
                  />
                  {fieldErrors.nationality && <p className="text-red-500 text-xs mt-1">{fieldErrors.nationality}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">성별 *</label>
                  <select
                    className="input w-full"
                    value={formData.gender}
                    onChange={(e) => {
                      setFormData({ ...formData, gender: e.target.value });
                      if (fieldErrors.gender) setFieldErrors({ ...fieldErrors, gender: '' });
                    }}
                    required
                  >
                    <option value="">선택하세요</option>
                    <option value="MALE">남성</option>
                    <option value="FEMALE">여성</option>
                    <option value="OTHER">기타</option>
                  </select>
                  {fieldErrors.gender && <p className="text-red-500 text-xs mt-1">{fieldErrors.gender}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">생년월일 *</label>
                  <input
                    type="date"
                    className="input w-full"
                    value={formData.dateOfBirth}
                    onChange={(e) => {
                      setFormData({ ...formData, dateOfBirth: e.target.value });
                      if (fieldErrors.dateOfBirth) setFieldErrors({ ...fieldErrors, dateOfBirth: '' });
                    }}
                    required
                  />
                  {fieldErrors.dateOfBirth && <p className="text-red-500 text-xs mt-1">{fieldErrors.dateOfBirth}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">주소</label>
                <textarea
                  className="input w-full"
                  rows={2}
                  placeholder="예: Monrovia, Montserrado County"
                  value={formData.address}
                  onChange={(e) => {
                    setFormData({ ...formData, address: e.target.value });
                  }}
                ></textarea>
              </div>

              {/* KYC 정보 */}
              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">KYC 정보 *</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">신분증 유형 *</label>
                    <select
                      className="input w-full"
                      value={formData.kycType}
                      onChange={(e) => {
                        setFormData({ ...formData, kycType: e.target.value });
                        if (fieldErrors.kycType) setFieldErrors({ ...fieldErrors, kycType: '' });
                      }}
                      required
                    >
                      <option value="">선택하세요</option>
                      <option value="NIR">National ID Registry</option>
                      <option value="PASSPORT">Passport</option>
                      <option value="BIRTH_CERT">Birth Certificate</option>
                      <option value="NATURALIZATION">Naturalization Document</option>
                      <option value="SWORN_STATEMENT">Sworn Statement</option>
                      <option value="CHIEF_CERT">Chief Certificate</option>
                    </select>
                    {fieldErrors.kycType && <p className="text-red-500 text-xs mt-1">{fieldErrors.kycType}</p>}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">신분증 사본 *</label>
                      <div className="flex gap-2">
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          className="input flex-1 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                          required
                        />
                        <button
                          type="button"
                          className="px-3 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700"
                          onClick={() => setShowCameraModal(true)}
                        >
                          카메라
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">얼굴 사진 *</label>
                      <div className="flex gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          className="input flex-1 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                          required
                        />
                        <button
                          type="button"
                          className="px-3 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700"
                          onClick={() => setShowCameraModal(true)}
                        >
                          카메라
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 지갑 유형 선택 */}
              <div className="border-t pt-4">
                <label className="block text-sm font-medium mb-1">최초 지갑 유형 *</label>
                <select
                  className="input w-full"
                  required
                  value={walletType}
                  onChange={(e) => {
                    setWalletType(e.target.value);
                    if (fieldErrors.walletType) setFieldErrors({ ...fieldErrors, walletType: '' });
                  }}
                >
                  <option value="">선택하세요</option>
                  <option value="anamwallet">AnamWallet</option>
                  <option value="ussd">USSD</option>
                  <option value="papervoucher">종이 바우처</option>
                </select>
                {fieldErrors.walletType && <p className="text-red-500 text-xs mt-1">{fieldErrors.walletType}</p>}
              </div>

              {/* 공개키 등록 - AnamWallet 선택시에만 표시 */}
              {walletType === 'anamwallet' && (
                <div className="pt-4">
                  <label className="block text-sm font-medium mb-1">
                    공개키 등록 <span className="text-gray-500 text-xs">(optional)</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="공개키를 입력하거나 QR 코드를 스캔하세요"
                      className="input flex-1"
                      value={formData.publicKey}
                      onChange={(e) => {
                        setFormData({ ...formData, publicKey: e.target.value });
                      }}
                    />
                    <button
                      type="button"
                      className="px-3 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 flex items-center gap-1"
                      onClick={() => setShowCameraModal(true)}
                    >
                      카메라
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">안암월렛으로 최초 사용자는 공개키를 등록해야합니다</p>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4 border-t">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowRegisterModal(false);
                    resetForm();
                  }}
                >
                  취소
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? '등록 중...' : '등록하기'}
                </Button>
              </div>
            </div>
          </form>
        </SimpleModal>
      )}

      {/* QR Scan Modal */}
      {showQrScanModal && (
        <SimpleModal onClose={() => setShowQrScanModal(false)}>
          <div className="p-6 text-center">
            <h2 className="text-xl font-bold mb-6">QR 체크인 스캐너</h2>

            <div className="py-12">
              <p className="text-lg text-gray-700 mb-2">QR 스캔 기능</p>
              <p className="text-sm text-gray-500">모바일 앱 API 연결 예정</p>
            </div>

            <Button variant="secondary" onClick={() => setShowQrScanModal(false)}>
              닫기
            </Button>
          </div>
        </SimpleModal>
      )}

      {/* Camera Modal */}
      {showCameraModal && (
        <SimpleModal onClose={() => setShowCameraModal(false)}>
          <div className="p-6 text-center">
            <h2 className="text-xl font-bold mb-6">카메라 촬영</h2>

            <div className="py-12">
              <p className="text-lg text-gray-700 mb-2">카메라 촬영 기능</p>
              <p className="text-sm text-gray-500">모바일 카메라 API 연결 예정</p>
            </div>

            <Button variant="secondary" onClick={() => setShowCameraModal(false)}>
              닫기
            </Button>
          </div>
        </SimpleModal>
      )}

      {/* Participant Detail Modal */}
      {showParticipantModal && selectedParticipant && (
        <SimpleModal onClose={() => setShowParticipantModal(false)}>
          <div className="p-6 max-h-[calc(100vh-8rem)] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">참가자 상세 정보</h2>

            {/* Basic Info */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h3 className="font-semibold mb-3">기본 정보</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600">이름:</span>
                  <span className="ml-2 font-medium">{selectedParticipant.name}</span>
                </div>
                <div>
                  <span className="text-gray-600">ID:</span>
                  <span className="ml-2">{selectedParticipant.participantId}</span>
                </div>
                {selectedParticipant.phoneNumber && (
                  <div>
                    <span className="text-gray-600">전화번호:</span>
                    <span className="ml-2">{selectedParticipant.phoneNumber}</span>
                  </div>
                )}
                {selectedParticipant.email && (
                  <div>
                    <span className="text-gray-600">이메일:</span>
                    <span className="ml-2">{selectedParticipant.email}</span>
                  </div>
                )}
                {selectedParticipant.gender && (
                  <div>
                    <span className="text-gray-600">성별:</span>
                    <span className="ml-2">{selectedParticipant.gender}</span>
                  </div>
                )}
                {selectedParticipant.dateOfBirth && (
                  <div>
                    <span className="text-gray-600">생년월일:</span>
                    <span className="ml-2">{selectedParticipant.dateOfBirth}</span>
                  </div>
                )}
                {selectedParticipant.nationality && (
                  <div>
                    <span className="text-gray-600">국적:</span>
                    <span className="ml-2">{selectedParticipant.nationality}</span>
                  </div>
                )}
                {selectedParticipant.createdAt && (
                  <div>
                    <span className="text-gray-600">등록일:</span>
                    <span className="ml-2">{new Date(selectedParticipant.createdAt).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
              {selectedParticipant.address && (
                <div className="mt-3">
                  <span className="text-gray-600 text-sm">주소:</span>
                  <p className="text-sm mt-1">{selectedParticipant.address}</p>
                </div>
              )}
            </div>

            {/* DID/Wallet Info */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h3 className="font-semibold mb-3">DID/지갑 정보</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600">DID:</span>
                  <div className="font-mono text-xs bg-white p-2 rounded mt-1 break-all">{selectedParticipant.did}</div>
                </div>
                {selectedParticipant.walletAddress && (
                  <div>
                    <span className="text-gray-600">지갑 주소:</span>
                    <div className="font-mono text-xs bg-white p-2 rounded mt-1 break-all">
                      {selectedParticipant.walletAddress}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Status Info */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h3 className="font-semibold mb-3">상태 정보</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-sm text-gray-600">사용자 상태:</span>
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                        selectedParticipant.isActive
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-gray-50 text-gray-700 border-gray-200'
                      }`}
                    >
                      {selectedParticipant.isActive ? '활성' : '비활성'}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-sm text-gray-600">VC 상태:</span>
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                        selectedParticipant.vcStatus === 'ACTIVE'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : selectedParticipant.vcStatus === 'SUSPENDED'
                            ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                      }`}
                    >
                      {selectedParticipant.vcStatus === 'ACTIVE'
                        ? '활성'
                        : selectedParticipant.vcStatus === 'SUSPENDED'
                          ? '일시정지'
                          : '폐기'}
                    </span>
                  </div>
                </div>
                {selectedParticipant.ussdStatus !== 'NOT_APPLICABLE' && (
                  <div>
                    <span className="text-sm text-gray-600">USSD 상태:</span>
                    <div className="mt-1">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                          selectedParticipant.ussdStatus === 'ACTIVE'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                        }`}
                      >
                        {selectedParticipant.ussdStatus === 'ACTIVE' ? '활성화' : '대기중'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* KYC Documents */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h3 className="font-semibold mb-3">KYC 문서</h3>
              <div className="flex gap-2">
                {selectedParticipant.kycDocumentPath ? (
                  <>
                    <button
                      className="px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700"
                      onClick={() => console.log('KYC 문서 다운로드:', selectedParticipant.kycDocumentPath)}
                    >
                      신분증 다운로드
                    </button>
                    {selectedParticipant.kycFacePath && (
                      <button
                        className="px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700"
                        onClick={() => console.log('얼굴 사진 다운로드:', selectedParticipant.kycFacePath)}
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

            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setShowParticipantModal(false)}>
                닫기
              </Button>
            </div>
          </div>
        </SimpleModal>
      )}
    </div>
  );
}
