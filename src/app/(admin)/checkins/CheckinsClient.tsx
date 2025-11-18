'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface Event {
  eventId: string;
  name: string;
  startDate: string;
  endDate: string;
  derivedStatus?: 'PENDING' | 'ONGOING' | 'COMPLETED';
}

export default function CheckinsClient() {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [method, setMethod] = useState<'ANAMWALLET' | 'USSD' | 'PAPER' | null>(null);
  const [ussdPin, setUssdPin] = useState('');
  const [paperPin, setPaperPin] = useState('');

  // 이벤트 목록 로드 (VERIFIER 권한이 있는 이벤트만)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/events/staff/me?role=VERIFIER', { cache: 'no-store' });
        const data = await res.json();
        if (!cancelled && res.ok) {
          setEvents((data.events as Event[]) || []);
        }
      } catch (error) {
        console.error('Failed to load events:', error);
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
  }

  function resetToMethodSelection() {
    setMethod(null);
    setUssdPin('');
    setPaperPin('');
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

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        <div className="card">
          <div className="card__header">
            {selectedEvent || method ? (
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
                      console.log('AnamWallet 체크인 (휴대폰 API 연결 예정)');
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
          {method && (
            <div className="card__footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={resetToMethodSelection}>
                취소
              </Button>
              <Button
                onClick={() => {
                  // TODO: API 연결 예정
                  console.log('체크인 처리:', {
                    eventId: selectedEvent?.eventId,
                    eventName: selectedEvent?.name,
                    method,
                    ussdPin,
                    paperPin,
                  });
                }}
              >
                체크인
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
