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
  const [ussdPhone, setUssdPhone] = useState('');
  const [ussdPin, setUssdPin] = useState('');
  const [paperPin, setPaperPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [paperPayload, setPaperPayload] = useState<unknown | null>(null);
  const [anamSessionId, setAnamSessionId] = useState<string>('');
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

  // Load event list (only events with VERIFIER permission)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Load all events assigned to APPROVER and VERIFIER, then filter only active events
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
            .filter((e) => e.isActive); // Show only active events
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
    setUssdPhone('');
    setUssdPin('');
    setPaperPin('');
    setPaperPayload(null);
    setAnamSessionId('');
    setVerifiedUser(null);
  }

  function resetToMethodSelection() {
    setMethod(null);
    setUssdPhone('');
    setUssdPin('');
    setPaperPin('');
    setPaperPayload(null);
    setAnamSessionId('');
    setVerifiedUser(null);
  }

  async function scanQRCode(): Promise<string | null> {
    if (typeof window === 'undefined') {
      return null;
    }

    // NOTE: WebView Java bridge method must be called directly
    // as a property of the injected object. (e.g., window.anam.scanQRCode(...))
    const w = window as unknown as { anam?: { scanQRCode?: (optionsJson: string) => void } };
    const anam = w.anam;
    if (!anam || typeof anam.scanQRCode !== 'function') {
      // Not a smartphone environment / bridge not connected
      // eslint-disable-next-line no-alert
      alert('No connected device');
      return null;
    }

    return new Promise<string | null>((resolve) => {
      const handler = (event: Event) => {
        window.removeEventListener('qrScanned', handler as EventListener);
        const custom = event as CustomEvent<{ success: boolean; data?: string; error?: string }>;
        if (custom.detail?.success && custom.detail.data) {
          resolve(custom.detail.data);
        } else {
          const msg = custom.detail?.error || 'QR scan failed';
          // eslint-disable-next-line no-alert
          alert(`QR scan failed: ${msg}`);
          resolve(null);
        }
      };

      window.addEventListener('qrScanned', handler as EventListener);

      try {
        // Call anam.scanQRCode(...) directly without storing in another variable
        // to avoid "Java bridge method can't be invoked on a non-injected object" error
        anam.scanQRCode!(
          JSON.stringify({
            title: 'Scan Paper Voucher',
            description: "Scan the participant's Paper Voucher QR code",
          }),
        );
      } catch (error) {
        window.removeEventListener('qrScanned', handler as EventListener);
        console.error('Error calling scanQRCode:', error);
        // eslint-disable-next-line no-alert
        alert('Cannot run QR scanner');
        resolve(null);
      }
    });
  }

  async function handlePaperVerify() {
    if (!selectedEvent) {
      // eslint-disable-next-line no-alert
      alert('Please select an event first');
      return;
    }

    if (submitting) return;

    setSubmitting(true);
    try {
      // Step 0: If QR has not been scanned yet, scan first and store payload
      if (!paperPayload) {
        console.log('[CHECKINS] handlePaperVerify:scan-start', {
          eventId: selectedEvent.eventId,
        });
        const qrData = await scanQRCode();
        console.log('[CHECKINS] handlePaperVerify:qrData', qrData);
        if (!qrData) return;

        let payload: unknown;
        try {
          payload = JSON.parse(qrData);
        } catch (error) {
          console.error('QR payload JSON parsing failed:', error);
          // eslint-disable-next-line no-alert
          alert('Invalid QR data');
          return;
        }
        console.log('[CHECKINS] handlePaperVerify:parsedPayload', payload);
        setPaperPayload(payload);
        // 안내만 하고 여기서 종료 → 사용자가 비밀번호를 입력한 뒤 다시 Check-in 버튼을 눌러 검증 진행
        // eslint-disable-next-line no-alert
        alert('QR scanned successfully. Please enter voucher password and press Check-in again.');
        return;
      }

      // Step 1: Require password after QR is scanned
      if (!paperPin) {
        // eslint-disable-next-line no-alert
        alert('Please enter voucher password');
        return;
      }

      console.log('[CHECKINS] handlePaperVerify:verify-start', {
        eventId: selectedEvent.eventId,
        hasPayload: !!paperPayload,
        paperPinLength: paperPin.length,
      });

      // Step 2: Call Paper Voucher verification API
      const verifyRes = await fetch(
        `/api/admin/events/${encodeURIComponent(selectedEvent.eventId)}/checkins/paper-voucher/verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payload: paperPayload,
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
        alert(verifyData?.error || 'Error occurred during voucher verification');
        return;
      }

      if (!verifyData?.valid) {
        console.warn('[CHECKINS] handlePaperVerify:verifyInvalid', verifyData);
        // eslint-disable-next-line no-alert
        alert(verifyData?.reason || 'Voucher verification failed');
        return;
      }

      const userId: string | undefined = verifyData.userId;
      if (!userId) {
        // eslint-disable-next-line no-alert
        alert('No userId in verification result');
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
      alert('Please complete voucher verification first');
      return;
    }

    if (submitting) return;

    setSubmitting(true);
    setModalMode('idle');
    setModalMsg('Processing check-in. Please wait...');
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
        const msg: string = approveData?.error || 'Error occurred during check-in approval';
        setModalMode('error');
        setModalMsg(`Check-in approval failed: ${msg}`);
        setModalDone(true);
        return;
      }

      setModalMode('success');
      setModalMsg('Check-in completed');
      setModalDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAnamWalletVerify() {
    if (!selectedEvent) {
      // eslint-disable-next-line no-alert
      alert('Please select an event first');
      return;
    }

    if (submitting) return;

    setSubmitting(true);
    try {
      console.log('[CHECKINS] handleAnamWalletVerify:scan-start', {
        eventId: selectedEvent.eventId,
      });

      // Scan QR code to get sessionId
      const qrData = await scanQRCode();
      console.log('[CHECKINS] handleAnamWalletVerify:qrData', qrData);
      if (!qrData) return;

      // Parse sessionId from QR
      let sessionId: string;
      try {
        // Try parsing as JSON first (in case it's wrapped)
        const parsed = JSON.parse(qrData);
        sessionId = typeof parsed === 'string' ? parsed : parsed.sessionId || qrData;
      } catch {
        // If not JSON, treat as plain sessionId
        sessionId = qrData.trim();
      }

      if (!sessionId || sessionId.length < 10) {
        // eslint-disable-next-line no-alert
        alert('Invalid QR code: sessionId too short');
        return;
      }

      console.log('[CHECKINS] handleAnamWalletVerify:verify-start', {
        eventId: selectedEvent.eventId,
        sessionId,
      });

      // Call AnamWallet verification API
      const verifyRes = await fetch(
        `/api/admin/events/${encodeURIComponent(selectedEvent.eventId)}/checkins/anamwallet/verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        },
      );

      const verifyData = await verifyRes.json().catch(() => ({}));
      console.log('[CHECKINS] handleAnamWalletVerify:verifyResponse', {
        status: verifyRes.status,
        ok: verifyRes.ok,
        data: verifyData,
      });

      if (!verifyRes.ok) {
        console.error('[CHECKINS] handleAnamWalletVerify:verifyError', {
          status: verifyRes.status,
          data: verifyData,
        });
        // eslint-disable-next-line no-alert
        alert(verifyData?.error || 'Error occurred during verification');
        return;
      }

      if (!verifyData?.valid) {
        console.warn('[CHECKINS] handleAnamWalletVerify:verifyInvalid', verifyData);
        // eslint-disable-next-line no-alert
        alert(verifyData?.reason || 'Verification failed');
        return;
      }

      const userId: string | undefined = verifyData.userId;
      if (!userId) {
        // eslint-disable-next-line no-alert
        alert('No userId in verification result');
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
      console.log('[CHECKINS] handleAnamWalletVerify:verifiedUser', userInfo);
      setAnamSessionId(sessionId);
      setVerifiedUser(userInfo);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAnamWalletApprove() {
    if (!selectedEvent || !verifiedUser) {
      // eslint-disable-next-line no-alert
      alert('Please complete verification first');
      return;
    }

    if (submitting) return;

    setSubmitting(true);
    setModalMode('idle');
    setModalMsg('Processing check-in. Please wait...');
    setModalDone(false);
    setModalOpen(true);

    try {
      const approveRes = await fetch(
        `/api/admin/events/${encodeURIComponent(selectedEvent.eventId)}/checkins/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: verifiedUser.userId,
            sessionId: anamSessionId, // For polling - updates VP session status
          }),
        },
      );

      const approveData = await approveRes.json().catch(() => ({}));
      if (!approveRes.ok) {
        const msg: string = approveData?.error || 'Error occurred during check-in approval';
        setModalMode('error');
        setModalMsg(`Check-in approval failed: ${msg}`);
        setModalDone(true);
        return;
      }

      setModalMode('success');
      setModalMsg('Check-in completed');
      setModalDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUssdVerify() {
    if (!selectedEvent) {
      // eslint-disable-next-line no-alert
      alert('Please select an event first');
      return;
    }

    if (!ussdPhone) {
      // eslint-disable-next-line no-alert
      alert('Please enter phone number');
      return;
    }

    if (!ussdPin) {
      // eslint-disable-next-line no-alert
      alert('Please enter PIN');
      return;
    }

    if (submitting) return;

    setSubmitting(true);
    try {
      console.log('[CHECKINS] handleUssdVerify:verify-start', {
        eventId: selectedEvent.eventId,
        phoneNumber: ussdPhone,
      });

      // Add +231 country code
      const phoneWithCountryCode = `+231${ussdPhone}`;

      const verifyRes = await fetch(
        `/api/admin/events/${encodeURIComponent(selectedEvent.eventId)}/checkins/ussd/verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phoneNumber: phoneWithCountryCode,
            pin: ussdPin,
          }),
        },
      );

      const verifyData = await verifyRes.json().catch(() => ({}));
      console.log('[CHECKINS] handleUssdVerify:verifyResponse', {
        status: verifyRes.status,
        ok: verifyRes.ok,
        data: verifyData,
      });

      if (!verifyRes.ok) {
        console.error('[CHECKINS] handleUssdVerify:verifyError', {
          status: verifyRes.status,
          data: verifyData,
        });
        // eslint-disable-next-line no-alert
        alert(verifyData?.error || 'Error occurred during verification');
        return;
      }

      if (!verifyData?.valid) {
        console.warn('[CHECKINS] handleUssdVerify:verifyInvalid', verifyData);
        // eslint-disable-next-line no-alert
        alert(verifyData?.reason || 'Verification failed');
        return;
      }

      const userId: string | undefined = verifyData.userId;
      if (!userId) {
        // eslint-disable-next-line no-alert
        alert('No userId in verification result');
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
      console.log('[CHECKINS] handleUssdVerify:verifiedUser', userInfo);
      setVerifiedUser(userInfo);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUssdApprove() {
    if (!selectedEvent || !verifiedUser) {
      // eslint-disable-next-line no-alert
      alert('Please complete verification first');
      return;
    }

    if (submitting) return;

    setSubmitting(true);
    setModalMode('idle');
    setModalMsg('Processing check-in. Please wait...');
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
        const msg: string = approveData?.error || 'Error occurred during check-in approval';
        setModalMode('error');
        setModalMsg(`Check-in approval failed: ${msg}`);
        setModalDone(true);
        return;
      }

      setModalMode('success');
      setModalMsg('Check-in completed');
      setModalDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  // Determine header title
  const getHeaderTitle = () => {
    if (method === 'ANAMWALLET') return 'AnamWallet Check-in';
    if (method === 'USSD') return 'USSD Check-in';
    if (method === 'PAPER') return 'Paper Voucher Check-in';
    if (selectedEvent) return selectedEvent.name;
    return 'Check-in';
  };

  // Format date
  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const sYear = startDate.getUTCFullYear();
    const sMonth = String(startDate.getUTCMonth() + 1).padStart(2, '0');
    const sDay = String(startDate.getUTCDate()).padStart(2, '0');
    const eYear = endDate.getUTCFullYear();
    const eMonth = String(endDate.getUTCMonth() + 1).padStart(2, '0');
    const eDay = String(endDate.getUTCDate()).padStart(2, '0');
    return `${sYear}.${sMonth}.${sDay} - ${eYear}.${eMonth}.${eDay} UTC`;
  };

  // Status badge color
  const getStatusColor = (status?: string) => {
    if (status === 'ONGOING') return 'bg-green-50 text-green-700 border-green-200';
    if (status === 'PENDING') return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    if (status === 'COMPLETED') return 'bg-gray-50 text-gray-700 border-gray-200';
    return 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const getStatusLabel = (status?: string) => {
    if (status === 'ONGOING') return 'Ongoing';
    if (status === 'PENDING') return 'Pending';
    if (status === 'COMPLETED') return 'Completed';
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
              title={modalDone ? 'Complete' : 'Processing'}
              message={modalMsg}
              done={modalDone}
              confirmText="Confirm"
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
                aria-label="Go back"
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
            {/* Step 1: Select event */}
            {!selectedEvent && !method && (
              <div className="py-2">
                {isLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading event list...</div>
                ) : events.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-gray-500 mb-2">No assigned events</div>
                    <p className="text-sm text-gray-400">Events will appear here when assigned by admin</p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-600 mb-4">Select an event to check in.</p>
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

            {/* Step 2: Select check-in method */}
            {selectedEvent && !method && (
              <div className="py-2">
                <p className="text-sm text-gray-600 mb-4">Select a check-in method.</p>
                <div className="flex flex-col gap-3">
                  {/* AnamWallet */}
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 p-4 border rounded-lg bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                    onClick={() => setMethod('ANAMWALLET')}
                    aria-label="AnamWallet Check-in"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/icons/smartphone.svg" alt="" className="w-6 h-6" />
                    <div className="flex-1 text-left">
                      <div className="text-base font-semibold">AnamWallet</div>
                      <div className="text-xs text-gray-500">Check in via app</div>
                    </div>
                  </button>

                  {/* USSD */}
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 p-4 border rounded-lg bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                    onClick={() => setMethod('USSD')}
                    aria-label="USSD Check-in"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/icons/ussd.svg" alt="" className="w-6 h-6" />
                    <div className="flex-1 text-left">
                      <div className="text-base font-semibold">USSD</div>
                      <div className="text-xs text-gray-500">Check in for feature phone users</div>
                    </div>
                  </button>

                  {/* Paper Voucher */}
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 p-4 border rounded-lg bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                    onClick={() => setMethod('PAPER')}
                    aria-label="Paper Voucher Check-in"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/icons/paper.svg" alt="" className="w-6 h-6" />
                    <div className="flex-1 text-left">
                      <div className="text-base font-semibold">Paper Voucher</div>
                      <div className="text-xs text-gray-500">Check in with QR voucher</div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {method === 'USSD' && (
              <div className="py-2">
                {!verifiedUser && (
                  <div className="grid gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Phone Number</label>
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
                          value={ussdPhone}
                          onChange={(e) => setUssdPhone(e.target.value)}
                          inputMode="numeric"
                        />
                      </div>
                    </div>
                    <Input
                      label="PIN"
                      type="password"
                      placeholder="Enter 4-6 digit PIN"
                      value={ussdPin}
                      onChange={(e) => setUssdPin(e.target.value)}
                      inputMode="numeric"
                    />
                    <p className="text-xs text-gray-500">
                      Enter the participant&apos;s phone number and PIN to verify their identity.
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
                              <div className="font-semibold mb-1">Participant DID</div>
                              <div className="mt-0.5 p-2 bg-gray-50 border border-[var(--line)] rounded break-all text-[11px] leading-snug">
                                {verifiedUser.did}
                              </div>
                            </div>
                          )}
                          {verifiedUser.walletAddress && (
                            <div>
                              <div className="font-semibold mb-1">Wallet Address</div>
                              <div className="mt-0.5 p-2 bg-gray-50 border border-[var(--line)] rounded break-all text-[11px] leading-snug">
                                {verifiedUser.walletAddress}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 text-center sm:text-left">
                      Verify that the participant information above is correct, then approve check-in with the button
                      below.
                    </p>
                  </div>
                )}
              </div>
            )}

            {method === 'ANAMWALLET' && (
              <div className="py-2">
                {!verifiedUser && (
                  <div className="grid gap-3">
                    <p className="text-xs text-gray-500">
                      Tap &quot;Check-in&quot; to scan the QR code displayed on the participant&apos;s AnamWallet app.
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
                              <div className="font-semibold mb-1">Participant DID</div>
                              <div className="mt-0.5 p-2 bg-gray-50 border border-[var(--line)] rounded break-all text-[11px] leading-snug">
                                {verifiedUser.did}
                              </div>
                            </div>
                          )}
                          {verifiedUser.walletAddress && (
                            <div>
                              <div className="font-semibold mb-1">Wallet Address</div>
                              <div className="mt-0.5 p-2 bg-gray-50 border border-[var(--line)] rounded break-all text-[11px] leading-snug">
                                {verifiedUser.walletAddress}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 text-center sm:text-left">
                      Verify that the participant information above is correct, then approve check-in with the button
                      below.
                    </p>
                  </div>
                )}
              </div>
            )}

            {method === 'PAPER' && (
              <div className="py-2">
                {!verifiedUser && (
                  <div className="grid gap-3">
                    {!paperPayload && (
                      <p className="text-xs text-gray-500">
                        Tap &quot;Check-in&quot; to scan the QR code on the paper voucher. After scanning, you&apos;ll
                        be asked to enter the voucher password.
                      </p>
                    )}
                    {!!paperPayload && (
                      <>
                        <Input
                          label="Voucher Password"
                          type="password"
                          placeholder="Enter numbers only"
                          value={paperPin}
                          onChange={(e) => setPaperPin(e.target.value)}
                          inputMode="numeric"
                        />
                        <p className="text-xs text-gray-500">
                          Enter the voucher password and tap &quot;Check-in&quot; again to verify the participant.
                        </p>
                      </>
                    )}
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
                              <div className="font-semibold mb-1">Participant DID</div>
                              <div className="mt-0.5 p-2 bg-gray-50 border border-[var(--line)] rounded break-all text-[11px] leading-snug">
                                {verifiedUser.did}
                              </div>
                            </div>
                          )}
                          {verifiedUser.walletAddress && (
                            <div>
                              <div className="font-semibold mb-1">Wallet Address</div>
                              <div className="mt-0.5 p-2 bg-gray-50 border border-[var(--line)] rounded break-all text-[11px] leading-snug">
                                {verifiedUser.walletAddress}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 text-center sm:text-left">
                      Verify that the participant information above matches the voucher, then approve check-in with the
                      button below.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          {method && (
            <div className="card__footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={resetToMethodSelection}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (method === 'ANAMWALLET') {
                    if (verifiedUser) {
                      void handleAnamWalletApprove();
                    } else {
                      void handleAnamWalletVerify();
                    }
                    return;
                  }
                  if (method === 'PAPER') {
                    if (verifiedUser) {
                      void handlePaperApprove();
                    } else {
                      void handlePaperVerify();
                    }
                    return;
                  }
                  if (method === 'USSD') {
                    if (verifiedUser) {
                      void handleUssdApprove();
                    } else {
                      void handleUssdVerify();
                    }
                    return;
                  }
                }}
                disabled={submitting}
              >
                {submitting ? 'Processing...' : 'Check-in'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
