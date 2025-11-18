'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import ProgressModal from '@/components/ui/ProgressModal';

export default function ParticipantsRegisterClient() {
  const router = useRouter();
  const [registrationType, setRegistrationType] = useState<string>('ANAMWALLET'); // 기본값: AnamWallet
  const [showCameraModal, setShowCameraModal] = useState(false);

  // 참가자 등록 폼 상태 (개발용 샘플 데이터 포함)
  const [formData, setFormData] = useState({
    name: 'John Doe', // 샘플 이름
    phoneNumber: '886123456', // 샘플 전화번호 (9자리)
    email: 'john.doe@example.com', // 샘플 이메일
    nationality: 'Liberia',
    gender: 'MALE', // 샘플 성별
    dateOfBirth: '1990-01-15', // 샘플 생년월일
    address: 'Monrovia, Montserrado County', // 샘플 주소
    kycType: 'NIR', // 샘플 KYC 타입 (National ID Registry)
    walletAddress: '0x089b5956c702Fc6654040f46666bFE383f9a7dF0', // 샘플 지갑 주소
    password: '', // Paper Voucher 비밀번호
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Progress Modal states
  const [showProgress, setShowProgress] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [progressDone, setProgressDone] = useState(false);

  // 폼 유효성 검사
  const validateForm = () => {
    const errors: Record<string, string> = {};

    // 필수 필드 검사
    if (!formData.name.trim()) {
      errors.name = '이름을 입력해주세요';
    }

    // 전화번호는 USSD 선택시에만 필수
    if (registrationType === 'USSD' && !formData.phoneNumber.trim()) {
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

    if (!registrationType) {
      errors.registrationType = '지갑 유형을 선택해주세요';
    }

    // AnamWallet 선택시 지갑 주소 필수
    if (registrationType === 'ANAMWALLET' && !formData.walletAddress.trim()) {
      errors.walletAddress = '지갑 주소를 입력해주세요';
    }

    // 지갑 주소 형식 검사 (0x로 시작하는 40자리 hex)
    if (formData.walletAddress && !/^0x[a-fA-F0-9]{40}$/.test(formData.walletAddress)) {
      errors.walletAddress = '올바른 이더리움 주소 형식이 아닙니다';
    }

    // Paper Voucher 선택시 비밀번호 필수
    if (registrationType === 'PAPERVOUCHER' && !formData.password.trim()) {
      errors.password = '종이 바우처 생성을 위해 비밀번호가 필요합니다';
    }

    // 비밀번호 최소 길이 검사 (입력된 경우)
    if (registrationType === 'PAPERVOUCHER' && formData.password && formData.password.length < 4) {
      errors.password = '비밀번호는 최소 4자 이상이어야 합니다';
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

    // 등록 유형에 따른 Progress Modal 설정
    setShowProgress(true);
    setProgressDone(false);

    if (registrationType === 'PAPERVOUCHER') {
      setProgressMsg('사용자 지갑을 생성 중입니다. 잠시만 기다려 주세요...');
    } else if (registrationType === 'USSD') {
      setProgressMsg('USSD 사용자를 등록하고 있습니다...');
    } else {
      setProgressMsg('AnamWallet 사용자를 등록하고 있습니다...');
    }

    try {
      // 전화번호가 있으면 +231 추가
      const phoneWithCountryCode = formData.phoneNumber ? `+231${formData.phoneNumber}` : '';

      // API 호출
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          phoneNumber: phoneWithCountryCode || undefined,
          email: formData.email.trim() || undefined,
          gender: formData.gender || undefined,
          dateOfBirth: formData.dateOfBirth || undefined,
          nationality: formData.nationality.trim() || undefined,
          address: formData.address.trim() || undefined,
          registrationType,
          walletAddress: formData.walletAddress || undefined,
          password: formData.password || undefined,
          kycType: formData.kycType || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409) {
          // 중복 에러 처리 - details.field로 구분
          if (data?.details?.field === 'phoneNumber') {
            setFieldErrors({ phoneNumber: data.error || '이미 등록된 전화번호입니다.' });
            setError(data.error || '이미 등록된 전화번호입니다. 다른 번호를 사용해주세요.');
          } else if (data?.details?.field === 'walletAddress') {
            setFieldErrors({ walletAddress: data.error || '이미 등록된 지갑 주소입니다.' });
            setError(data.error || '이미 등록된 지갑 주소입니다. 다른 주소를 사용해주세요.');
          } else {
            // field 정보가 없으면 메시지로 구분
            if (data?.error?.includes('전화번호')) {
              setFieldErrors({ phoneNumber: data.error });
            } else if (data?.error?.includes('지갑 주소')) {
              setFieldErrors({ walletAddress: data.error });
            }
            setError(data?.error || '중복된 정보가 있습니다. 입력 정보를 확인해주세요.');
          }
          // 409 에러시 Modal 닫고 return
          setShowProgress(false);
          setProgressDone(false);
          setLoading(false);
          return;
        }
        throw new Error(data?.error || '등록에 실패했습니다.');
      }

      // 성공 시 모든 경우에 대해 Modal로 처리
      if (registrationType === 'PAPERVOUCHER' && data?.qrData) {
        // Paper Voucher: 상세 정보 표시
        setProgressMsg(
          `사용자 지갑이 성공적으로 생성되었습니다!\n\n지갑 주소: ${data.qrData.address}\n\n 사용자 탭에서 바우처 발급이 가능합니다.`,
        );
      } else if (data?.message) {
        // 서버에서 제공한 메시지 사용
        setProgressMsg(data.message);
      } else {
        // 기본 성공 메시지
        setProgressMsg('참가자가 성공적으로 등록되었습니다');
      }

      setProgressDone(true);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록에 실패했습니다');
      // 에러 발생 시 Modal 닫기
      setShowProgress(false);
      setProgressDone(false);
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
      walletAddress: '',
      password: '',
    });
    setRegistrationType('ANAMWALLET');
    setFieldErrors({});
    setError('');
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">사용자 등록</h1>

      <form onSubmit={handleRegisterSubmit} className="bg-white rounded-lg shadow p-6">
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">{error}</div>}

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
              <label className="block text-sm font-medium mb-1">
                전화번호 {registrationType === 'USSD' ? '*' : ''}
              </label>
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
                  required={registrationType === 'USSD'}
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
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="input flex-1 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                      required
                    />
                    <button
                      type="button"
                      className="icon-btn h-11 w-11"
                      aria-label="카메라 열기"
                      onClick={() => setShowCameraModal(true)}
                    >
                      <img src="/icons/camera.svg" alt="" width={24} height={24} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">얼굴 사진 *</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      className="input flex-1 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                      required
                    />
                    <button
                      type="button"
                      className="icon-btn h-11 w-11"
                      aria-label="카메라 열기"
                      onClick={() => setShowCameraModal(true)}
                    >
                      <img src="/icons/camera.svg" alt="" width={24} height={24} />
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
              value={registrationType}
              onChange={(e) => {
                setRegistrationType(e.target.value);
                if (fieldErrors.registrationType) setFieldErrors({ ...fieldErrors, registrationType: '' });
              }}
            >
              <option value="">선택하세요</option>
              <option value="ANAMWALLET">AnamWallet</option>
              <option value="USSD">USSD</option>
              <option value="PAPERVOUCHER">종이 바우처</option>
            </select>
            {fieldErrors.registrationType && (
              <p className="text-red-500 text-xs mt-1">{fieldErrors.registrationType}</p>
            )}
          </div>

          {/* 지갑 주소 등록 - AnamWallet 선택시에만 표시 */}
          {registrationType === 'ANAMWALLET' && (
            <div className="pt-4">
              <label className="block text-sm font-medium mb-1">
                지갑 주소 등록 <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="0x로 시작하는 이더리움 주소를 입력하세요"
                  className="input flex-1"
                  value={formData.walletAddress}
                  onChange={(e) => {
                    setFormData({ ...formData, walletAddress: e.target.value });
                    if (fieldErrors.walletAddress) setFieldErrors({ ...fieldErrors, walletAddress: '' });
                  }}
                  required
                />
                <button
                  type="button"
                  className="icon-btn h-11 w-11"
                  aria-label="QR 스캔"
                  onClick={() => setShowCameraModal(true)}
                >
                  <img src="/icons/camera.svg" alt="" width={24} height={24} />
                </button>
              </div>
              {fieldErrors.walletAddress && <p className="text-red-500 text-xs mt-1">{fieldErrors.walletAddress}</p>}
              <p className="text-xs text-gray-500 mt-1">AnamWallet 사용자는 지갑 주소를 등록해야합니다</p>
            </div>
          )}

          {/* 비밀번호 입력 - Paper Voucher 선택시에만 표시 */}
          {registrationType === 'PAPERVOUCHER' && (
            <div className="pt-4">
              <label className="block text-sm font-medium mb-1">
                바우처 비밀번호 <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                placeholder="최소 4자 이상의 비밀번호를 입력하세요"
                className="input w-full"
                value={formData.password}
                onChange={(e) => {
                  setFormData({ ...formData, password: e.target.value });
                  if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: '' });
                }}
                required
              />
              {fieldErrors.password && <p className="text-red-500 text-xs mt-1">{fieldErrors.password}</p>}
              <p className="text-xs text-gray-500 mt-1">
                종이 바우처 사용자를 위한 비밀번호입니다. 사용자에게 안전하게 전달해주세요.
              </p>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                resetForm();
                router.push('/participants');
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

      {/* Camera Modal */}
      {showCameraModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h3 className="text-lg font-semibold mb-4">카메라</h3>
            <div className="h-64 bg-gray-100 rounded flex items-center justify-center mb-4">
              <p className="text-gray-500">카메라 기능 (추후 구현)</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowCameraModal(false)}>
                닫기
              </Button>
              <Button onClick={() => setShowCameraModal(false)}>촬영</Button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Modal for Registration */}
      <ProgressModal
        open={showProgress}
        title={progressDone ? '등록 완료' : '등록 처리 중'}
        message={progressMsg}
        done={progressDone}
        confirmText="확인"
        onConfirm={() => {
          setShowProgress(false);
          setProgressDone(false);
          resetForm();
          router.push('/participants');
        }}
      />
    </div>
  );
}
