'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';

export default function ParticipantsRegisterClient() {
  const router = useRouter();
  const [walletType, setWalletType] = useState<string>('');
  const [showCameraModal, setShowCameraModal] = useState(false);

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

      // API 호출
      const useUSSD = walletType === 'ussd';
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          phoneNumber: phoneWithCountryCode,
          email: formData.email.trim() || undefined,
          gender: formData.gender || undefined,
          dateOfBirth: formData.dateOfBirth || undefined,
          nationality: formData.nationality.trim() || undefined,
          address: formData.address.trim() || undefined,
          useUSSD,
          kycType: formData.kycType || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409) {
          setFieldErrors({ phoneNumber: '이미 등록된 전화번호입니다.' });
        }
        throw new Error(data?.error || '등록에 실패했습니다.');
      }

      // 성공시 초기화 및 리다이렉트
      resetForm();
      alert('참가자가 성공적으로 등록되었습니다');
      router.push('/participants');
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
    </div>
  );
}
