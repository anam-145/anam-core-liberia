'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ProgressModal from '@/components/ui/ProgressModal';

interface EventSummary {
  eventId: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  derivedStatus?: 'PENDING' | 'ONGOING' | 'COMPLETED';
}

export default function CheckinsClient() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<EventSummary | null>(null);
  const [method, setMethod] = useState<'ANAMWALLET' | 'USSD' | 'PAPER' | null>(null);
  const [ussdPin, setUssdPin] = useState('');
  const [paperPin, setPaperPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [verifiedUser, setVerifiedUser] = useState<{
    id: number;
    userId: string;
    name: string;
    walletAddress: string | null;
    did?: string | null;
    kycFacePath?: string | null;
  } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalDone, setModalDone] = useState(false);
  const [modalMsg, setModalMsg] = useState('');
  const [modalMode, setModalMode] = useState<'idle' | 'success' | 'error'>('idle');

  // 이벤트 목록 로드 (VERIFIER 권한이 있는 이벤트만)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // APPROVER와 VERIFIER로 배정된 모든 이벤트를 불러온 뒤, 활성화된 이벤트만 필터링
        const res = await fetch('/api/admin/events/staff/me', { cache: 'no-store' });
        const data = await res.json();
        if (!cancelled && res.ok) {
          const raw = (data.events as Array<Record<string, unknown>>) || [];
          const list: EventSummary[] = raw
            .map((e) => ({
              eventId: String(e.eventId),
              name: String(e.name),
              startDate: String(e.startDate),
              endDate: String(e.endDate),
              isActive: Boolean(e.isActive),
              derivedStatus: e.derivedStatus as EventSummary['derivedStatus'],
            }))
            .filter((e) => e.isActive); // 활성화된 이벤트만 표시
          setEvents(list);
        }
      } catch (error) {
        console.error('>>> [CHECKINS] ❌ Error loading events:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function resetToEventSelection() {
    setSelectedEvent(null);
    setMethod(null);
    setUssdPin('');
    setPaperPin('');
    setVerifiedUser(null);
  }

  function resetToMethodSelection() {
    setMethod(null);
    setUssdPin('');
    setPaperPin('');
    setVerifiedUser(null);
  }

  async function scanQRCode(): Promise<string | null> {
    if (typeof window === 'undefined') {
      return null;
    }

    // NOTE: WebView Java bridge 메서드는 주입된 객체의 프로퍼티로
    // 직접 호출해야 합니다. (예: window.anam.scanQRCode(...))
    const w = window as unknown as { anam?: { scanQRCode?: (optionsJson: string) => void } };
    const anam = w.anam;
    if (!anam || typeof anam.scanQRCode !== 'function') {
      // 스마트폰이 아닌 환경 / 브릿지 미연결
      // eslint-disable-next-line no-alert
      alert('연결된 기기가 없습니다');
      return null;
    }

    return new Promise<string | null>((resolve) => {
      const handler = (event: Event) => {
        window.removeEventListener('qrScanned', handler as EventListener);
        const custom = event as CustomEvent<{ success: boolean; data?: string; error?: string }>;
        if (custom.detail?.success && custom.detail.data) {
          resolve(custom.detail.data);
        } else {
          const msg = custom.detail?.error || 'QR 스캔에 실패했습니다';
          // eslint-disable-next-line no-alert
          alert(`QR 스캔 실패: ${msg}`);
          resolve(null);
        }
      };

      window.addEventListener('qrScanned', handler as EventListener);

      try {
        // 브릿지 메서드를 다른 변수에 담지 않고
        // 직접 anam.scanQRCode(...) 형태로 호출해야
        // "Java bridge method can't be invoked on a non-injected object"
        // 오류를 피할 수 있습니다.
        anam.scanQRCode(
          JSON.stringify({
            title: 'Paper Voucher 스캔',
            description: '참가자의 Paper 바우처 QR 코드를 스캔하세요',
          }),
        );
      } catch (error) {
        window.removeEventListener('qrScanned', handler as EventListener);
        console.error('scanQRCode 호출 중 오류:', error);
        // eslint-disable-next-line no-alert
        alert('QR 스캐너를 실행할 수 없습니다');
        resolve(null);
      }
    });
  }

  async function handlePaperVerify() {
    if (!selectedEvent) {
      // eslint-disable-next-line no-alert
      alert('이벤트를 먼저 선택해 주세요');
      return;
    }

    if (!paperPin) {
      // eslint-disable-next-line no-alert
      alert('바우처 비밀번호를 입력해 주세요');
      return;
    }

    if (submitting) return;

    console.log('[CHECKINS] handlePaperVerify:start', {
      eventId: selectedEvent.eventId,
      paperPinLength: paperPin.length,
    });

    setSubmitting(true);
    try {
      const qrData = await scanQRCode();
      console.log('[CHECKINS] handlePaperVerify:qrData', qrData);
      if (!qrData) return;

      let payload: unknown;
      try {
        payload = JSON.parse(qrData);
      } catch (error) {
        console.error('QR payload JSON 파싱 실패:', error);
        // eslint-disable-next-line no-alert
        alert('올바르지 않은 QR 데이터입니다');
        return;
      }
      console.log('[CHECKINS] handlePaperVerify:parsedPayload', payload);

      // 1단계: Paper Voucher 검증 API 호출
      const verifyRes = await fetch(
        `/api/admin/events/${encodeURIComponent(selectedEvent.eventId)}/checkins/paper-voucher/verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payload,
            password: paperPin,
          }),
        },
      );

      const verifyData = await verifyRes.json().catch(() => ({}));
      console.log('[CHECKINS] handlePaperVerify:verifyResponse', {
        status: verifyRes.status,
        ok: verifyRes.ok,
        data: verifyData,
      });

      if (!verifyRes.ok) {
        console.error('[CHECKINS] handlePaperVerify:verifyError', {
          status: verifyRes.status,
          data: verifyData,
        });
        // eslint-disable-next-line no-alert
        alert(verifyData?.error || '바우처 검증 중 오류가 발생했습니다');
        return;
      }

      if (!verifyData?.valid) {
        console.warn('[CHECKINS] handlePaperVerify:verifyInvalid', verifyData);
        // eslint-disable-next-line no-alert
        alert(verifyData?.reason || '바우처 검증에 실패했습니다');
        return;
      }

      const userId: string | undefined = verifyData.userId;
      if (!userId) {
        // eslint-disable-next-line no-alert
        alert('검증 결과에 userId가 없습니다');
        return;
      }

      const userInfo = verifyData.user as {
        id: number;
        userId: string;
        name: string;
        walletAddress: string | null;
        did?: string | null;
        kycFacePath?: string | null;
      };
      console.log('[CHECKINS] handlePaperVerify:verifiedUser', userInfo);
      setVerifiedUser(userInfo);
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePaperApprove() {
    if (!selectedEvent || !verifiedUser) {
      // eslint-disable-next-line no-alert
      alert('먼저 바우처 검증을 완료해 주세요');
      return;
    }

    if (submitting) return;

    setSubmitting(true);
    setModalMode('idle');
    setModalMsg('체크인을 처리하고 있습니다. 잠시만 기다려 주세요...');
    setModalDone(false);
    setModalOpen(true);

    try {
      const approveRes = await fetch(
        `/api/admin/events/${encodeURIComponent(selectedEvent.eventId)}/checkins/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: verifiedUser.userId }),
        },
      );

      const approveData = await approveRes.json().catch(() => ({}));
      if (!approveRes.ok) {
        const msg: string = approveData?.error || '체크인 승인 중 오류가 발생했습니다';
        setModalMode('error');
        setModalMsg(`체크인 승인 실패: ${msg}`);
        setModalDone(true);
        return;
      }

      setModalMode('success');
      setModalMsg('체크인이 완료되었습니다');
      setModalDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  // 헤더 타이틀 결정
  const getHeaderTitle = () => {
    if (method === 'USSD') return 'USSD 체크인';
    if (method === 'PAPER') return 'Paper 바우처 체크인';
    if (selectedEvent) return selectedEvent.name;
    return '체크인';
  };

  // 날짜 포맷팅
  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.getFullYear()}.${String(startDate.getMonth() + 1).padStart(2, '0')}.${String(startDate.getDate()).padStart(2, '0')} - ${endDate.getFullYear()}.${String(endDate.getMonth() + 1).padStart(2, '0')}.${String(endDate.getDate()).padStart(2, '0')}`;
  };

  // 상태 배지 색상
  const getStatusColor = (status?: string) => {
    if (status === 'ONGOING') return 'bg-green-50 text-green-700 border-green-200';
    if (status === 'PENDING') return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    if (status === 'COMPLETED') return 'bg-gray-50 text-gray-700 border-gray-200';
    return 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const getStatusLabel = (status?: string) => {
    if (status === 'ONGOING') return '진행중';
    if (status === 'PENDING') return '예정';
    if (status === 'COMPLETED') return '완료';
    return '';
  };

  const showBackButton = !!selectedEvent && !!method && !verifiedUser;

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        <div className="card">
          <div className="card__header">
            <ProgressModal
              open={modalOpen}
              title={modalDone ? '완료' : '처리 중입니다'}
              message={modalMsg}
              done={modalDone}
              confirmText="확인"
              onConfirm={() => {
                setModalOpen(false);
                setModalDone(false);
                if (modalMode === 'success') {
                  resetToMethodSelection();
                }
              }}
            />
            {showBackButton ? (
              <button
                type="button"
                className="inline-flex items-center gap-2 text-inherit hover:opacity-70 transition-opacity"
                onClick={method ? resetToMethodSelection : resetToEventSelection}
                aria-label="뒤로 가기"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {getHeaderTitle()}
              </button>
            ) : (
              getHeaderTitle()
            )}
          </div>
          <div className="card__body">
            {/* 1단계: 이벤트 선택 */}
            {!selectedEvent && !method && (
              <div className="py-2">
                {isLoading ? (
                  <div className="text-center py-8 text-gray-500">이벤트 목록을 불러오는 중...</div>
                ) : events.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-gray-500 mb-2">배정된 이벤트가 없습니다</div>
                    <p className="text-sm text-gray-400">관리자가 이벤트에 배정하면 여기에 표시됩니다</p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-600 mb-4">체크인할 이벤트를 선택하세요.</p>
                    <div className="flex flex-col gap-3">
                      {events.map((event) => (
                        <button
                          key={event.eventId}
                          type="button"
                          className="w-full p-4 border rounded-lg bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand)] text-left transition-colors"
                          onClick={() => setSelectedEvent(event)}
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="font-semibold text-base">{event.name}</div>
                            {event.derivedStatus && (
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(event.derivedStatus)}`}
                              >
                                {getStatusLabel(event.derivedStatus)}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">{formatDateRange(event.startDate, event.endDate)}</div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 2단계: 체크인 방법 선택 */}
            {selectedEvent && !method && (
              <div className="py-2">
                <p className="text-sm text-gray-600 mb-4">체크인 방법을 선택하세요.</p>
                <div className="flex flex-col gap-3">
                  {/* AnamWallet */}
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 p-4 border rounded-lg bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                    onClick={() => {
                      // TODO: 휴대폰 api 연결 예정 (AnamWallet)
                    }}
                    aria-label="AnamWallet 체크인"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/icons/smartphone.svg" alt="" className="w-6 h-6" />
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
                    <img src="/icons/ussd.svg" alt="" className="w-6 h-6" />
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
                    <img src="/icons/paper.svg" alt="" className="w-6 h-6" />
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
                {!verifiedUser && (
                  <div className="grid gap-3">
                    <Input
                      label="바우처 비밀번호"
                      type="password"
                      placeholder="숫자만 입력"
                      value={paperPin}
                      onChange={(e) => setPaperPin(e.target.value)}
                      inputMode="numeric"
                    />
                    <p className="text-xs text-gray-500">
                      비밀번호를 입력한 뒤, 종이 바우처의 QR 코드를 스캔하여 참가자를 확인합니다.
                    </p>
                  </div>
                )}

                {verifiedUser && (
                  <div className="grid gap-4">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                      {verifiedUser.kycFacePath ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/admin/files?path=${encodeURIComponent(verifiedUser.kycFacePath)}`}
                          alt="Participant"
                          className="w-20 h-20 sm:w-16 sm:h-16 rounded-full object-cover border border-[var(--line)]"
                        />
                      ) : (
                        <div className="w-20 h-20 sm:w-16 sm:h-16 rounded-full bg-gray-100 border border-[var(--line)] grid place-items-center text-xs text-gray-400">
                          NO PHOTO
                        </div>
                      )}
                      <div className="flex-1 min-w-0 w-full">
                        <div className="font-semibold text-base text-center sm:text-left mb-2">{verifiedUser.name}</div>
                        <div className="space-y-2 text-xs text-gray-600">
                          {verifiedUser.did && (
                            <div>
                              <div className="font-semibold mb-1">참가자 DID</div>
                              <div className="mt-0.5 p-2 bg-gray-50 border border-[var(--line)] rounded break-all text-[11px] leading-snug">
                                {verifiedUser.did}
                              </div>
                            </div>
                          )}
                          {verifiedUser.walletAddress && (
                            <div>
                              <div className="font-semibold mb-1">지갑 주소</div>
                              <div className="mt-0.5 p-2 bg-gray-50 border border-[var(--line)] rounded break-all text-[11px] leading-snug">
                                {verifiedUser.walletAddress}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 text-center sm:text-left">
                      위 참가자 정보가 바우처와 일치하는지 확인한 뒤, 아래 버튼으로 체크인을 승인하세요.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          {method && (
            <div className="card__footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={resetToMethodSelection}>
                취소
              </Button>
              <Button
                onClick={() => {
                  if (method === 'PAPER') {
                    if (verifiedUser) {
                      void handlePaperApprove();
                    } else {
                      void handlePaperVerify();
                    }
                    return;
                  }
                  // TODO: USSD/AnamWallet 체크인 API 연동
                }}
                disabled={submitting}
              >
                {submitting ? '처리 중...' : '체크인'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
