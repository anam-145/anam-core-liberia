'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/stores/session.store';
import QRCode from 'qrcode';
import Image from 'next/image';
import CameraIcon from '@/components/icons/Camera';

interface PaperVoucherPayload {
  address: string;
  vault: {
    ciphertext: string;
    iv: string;
    salt: string;
    authTag: string;
  };
  vc: {
    id: string;
    ciphertext: string;
    iv: string;
    salt: string;
    authTag: string;
  };
}

interface WithdrawInfo {
  // USSD Service
  ussdPhoneNumber: string;
  ussdServiceCode: string;

  // AnamWallet Service
  walletServiceEndpoint: string;

  // Paper Voucher ATM
  atmServiceEndpoint: string;

  // Common
  exchangeRate: number;
  network: string;
}

export default function WithdrawPage() {
  const router = useRouter();
  const { role, isLoaded } = useSessionStore();
  const [loading, setLoading] = useState(true);
  const [walletQrUrl, setWalletQrUrl] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState<string>('');
  const [withdrawInfo, setWithdrawInfo] = useState<WithdrawInfo | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // QR Scanner function using WebView bridge (same pattern as CheckinsClient)
  const scanQRCode = useCallback((): Promise<string | null> => {
    if (typeof window === 'undefined') {
      return Promise.resolve(null);
    }

    const w = window as unknown as { anam?: { scanQRCode?: (optionsJson: string) => void } };
    const anam = w.anam;
    if (!anam || typeof anam.scanQRCode !== 'function') {
      // Not a smartphone environment / bridge not connected
      // eslint-disable-next-line no-alert
      alert('No connected device');
      return Promise.resolve(null);
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
        anam.scanQRCode!(
          JSON.stringify({
            title: 'Scan Paper Voucher',
            description: 'Scan the Paper Voucher QR code to withdraw USDC',
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
  }, []);

  // Handle scan voucher button click
  const handleScanVoucher = useCallback(async () => {
    if (isScanning) return;

    setIsScanning(true);
    try {
      const qrData = await scanQRCode();
      if (!qrData) return;

      // Parse QR data
      let payload: PaperVoucherPayload;
      try {
        payload = JSON.parse(qrData) as PaperVoucherPayload;
      } catch {
        // eslint-disable-next-line no-alert
        alert('Invalid QR data format');
        return;
      }

      // Validate payload structure
      if (!payload.address || !payload.vault?.ciphertext) {
        // eslint-disable-next-line no-alert
        alert('Invalid Paper Voucher QR code');
        return;
      }

      // Store payload in sessionStorage and navigate to redeem page
      sessionStorage.setItem('withdrawPayload', JSON.stringify(payload));
      router.push('/withdraw/redeem');
    } finally {
      setIsScanning(false);
    }
  }, [isScanning, scanQRCode, router]);

  // Role check
  useEffect(() => {
    if (isLoaded && role !== 'SYSTEM_ADMIN') {
      router.push('/denied');
    }
  }, [isLoaded, role, router]);

  // Fetch withdraw info from API
  useEffect(() => {
    const fetchWithdrawInfo = async () => {
      if (!isLoaded || role !== 'SYSTEM_ADMIN') return;

      try {
        const res = await fetch('/api/admin/withdraw/info');
        if (!res.ok) {
          throw new Error('Failed to fetch withdraw info');
        }
        const data = await res.json();
        setWithdrawInfo({
          ussdPhoneNumber: data.phoneNumber || '0886-123-456',
          ussdServiceCode: '*123#',
          walletServiceEndpoint: data.walletAddress || '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
          atmServiceEndpoint: data.walletAddress || '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
          exchangeRate: data.exchangeRate || 195.5,
          network: 'base',
        });
      } catch (error) {
        console.error('Failed to fetch withdraw info:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWithdrawInfo();
  }, [isLoaded, role]);

  // Generate QR codes for different services
  useEffect(() => {
    const generateQRs = async () => {
      if (!withdrawInfo) return;

      try {
        // AnamWallet QR - Just the wallet address (plain text)
        const qrOptions = {
          width: 240,
          margin: 2,
          color: {
            dark: '#1a2332',
            light: '#ffffff',
          },
        };

        const walletQr = await QRCode.toDataURL(withdrawInfo.walletServiceEndpoint, qrOptions);
        setWalletQrUrl(walletQr);
      } catch (error) {
        console.error('Failed to generate QR codes:', error);
      }
    };

    generateQRs();
  }, [withdrawInfo]);

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(type);
      setTimeout(() => setCopySuccess(''), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopySuccess(type);
      setTimeout(() => setCopySuccess(''), 2000);
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading withdraw services...</div>
      </div>
    );
  }

  return (
    <div className="max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="mb-6 lg:mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-[var(--text)]">Withdraw to Mobile Money</h1>
            <p className="text-sm lg:text-base text-[var(--muted)] mt-1">
              Multiple channels for withdrawing USDC to mobile money
            </p>
          </div>
        </div>
      </div>

      {/* Three Service Channels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1. USSD Channel (Feature Phone) */}
        <div className="card">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h3 className="font-bold text-gray-900">USSD Service</h3>
                <p className="text-xs text-gray-600">For Feature Phone Users</p>
              </div>
            </div>

            {/* USSD Code - Main Focus */}
            <div className="bg-blue-50 rounded-xl p-6 mb-6 border-2 border-blue-200">
              <label className="block text-sm font-bold text-blue-900 mb-3">Step 1: Dial USSD Code</label>
              <div className="font-mono text-3xl font-bold text-blue-900 text-center mb-2">
                {withdrawInfo?.ussdServiceCode}
              </div>
              <p className="text-xs text-blue-700 text-center">Start by dialing this code on your phone</p>
            </div>

            {/* Service Phone Number */}
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <label className="block text-sm font-bold text-gray-900 mb-2">Step 2: Send Money to Our Service</label>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="font-mono text-xl font-bold text-gray-900">{withdrawInfo?.ussdPhoneNumber}</div>
                  <p className="text-xs text-gray-600 mt-1">Our service will convert and send to recipient</p>
                </div>
                <button
                  onClick={() => copyToClipboard(withdrawInfo?.ussdPhoneNumber || '', 'ussd')}
                  className="px-3 py-2 bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-800"
                >
                  {copySuccess === 'ussd' ? '✓' : 'Copy'}
                </button>
              </div>
            </div>

            {/* USSD Menu Process */}
            <div className="border-l-4 border-blue-400 pl-4 space-y-2 text-sm mb-4">
              <h4 className="font-semibold text-gray-900 mb-2">In USSD Menu:</h4>
              <div className="flex gap-2">
                <span className="text-blue-500 font-bold">3.</span>
                <span className="text-gray-700">Select &quot;Withdraw&quot; option</span>
              </div>
              <div className="flex gap-2">
                <span className="text-blue-500 font-bold">4.</span>
                <span className="text-gray-700">Enter recipient phone number (who receives money)</span>
              </div>
              <div className="flex gap-2">
                <span className="text-blue-500 font-bold">5.</span>
                <span className="text-gray-700">Enter amount in USDC to convert</span>
              </div>
              <div className="flex gap-2 bg-yellow-50 -ml-4 pl-4 py-2 border-l-4 border-yellow-400">
                <span className="text-yellow-600 font-bold">6.</span>
                <span className="text-gray-900 font-semibold">
                  Enter your PIN <span className="text-xs text-yellow-600">(Last step for security)</span>
                </span>
              </div>
              <div className="flex gap-2">
                <span className="text-blue-500 font-bold">7.</span>
                <span className="text-gray-700">Recipient receives USD in mobile money</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. AnamWallet Channel (Smartphone) */}
        <div className="card">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <h3 className="font-bold text-gray-900">AnamWallet</h3>
                <p className="text-xs text-gray-600">For Smartphone Users</p>
              </div>
            </div>

            {/* QR Code */}
            <div className="text-center mb-4">
              {walletQrUrl ? (
                <Image src={walletQrUrl} alt="Wallet QR" width={240} height={240} className="mx-auto" />
              ) : (
                <div className="w-[240px] h-[240px] bg-gray-100 rounded-lg animate-pulse mx-auto" />
              )}
            </div>

            {/* Instructions */}
            <div className="space-y-2 text-sm">
              <div className="flex gap-2">
                <span className="text-gray-500">1.</span>
                <span className="text-gray-700">Open AnamWallet app</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500">2.</span>
                <span className="text-gray-700">Scan this QR code</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500">3.</span>
                <span className="text-gray-700">Enter amount to convert</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500">4.</span>
                <span className="text-gray-700">Receive USD in your mobile money</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Paper Voucher ATM (Physical) */}
        <div className="card">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Paper Voucher ATM</h3>
                <p className="text-xs text-gray-600">Digital Kiosk Service</p>
              </div>
            </div>

            {/* Scan Button */}
            <div className="text-center mb-4">
              <div className="flex flex-col items-center space-y-4">
                <div className="w-[240px] h-[240px] bg-purple-50 border-2 border-dashed border-purple-300 rounded-lg flex flex-col items-center justify-center">
                  <CameraIcon size={48} className="text-purple-600 mb-3" />
                  <p className="text-sm font-semibold text-purple-900">Scan Paper Voucher</p>
                  <p className="text-xs text-purple-600 mt-1">Click button below to scan</p>
                </div>

                <button
                  onClick={handleScanVoucher}
                  disabled={isScanning}
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CameraIcon size={20} />
                  <span className="font-semibold">{isScanning ? 'Scanning...' : 'Scan Voucher'}</span>
                </button>
              </div>
            </div>

            {/* Digital Kiosk Process */}
            <div className="bg-purple-50 rounded-lg p-4 mb-4">
              <div className="font-semibold text-sm text-purple-900 mb-2">Digital Kiosk Process</div>
              <ol className="space-y-1 text-sm text-purple-700">
                <li>1. Scan paper voucher at kiosk</li>
                <li>2. Enter your PIN</li>
                <li>3. Enter amount to convert</li>
                <li>4. Receive USD in your mobile money</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Common Information */}
      <div className="mt-8 card">
        <div className="p-6">
          <h3 className="font-bold text-gray-900 mb-4">How do we send mobile money to you?</h3>

          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-sm text-gray-900 mb-3">Our Unified Process</h4>
            <ol className="space-y-2 text-sm text-gray-700">
              <li className="flex gap-2">
                <span className="font-bold text-gray-900">1.</span>
                <span>You request to convert your USDC through any of the three channels above</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-gray-900">2.</span>
                <span>Our system receives your USDC and verifies your identity</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-gray-900">3.</span>
                <span>We instantly convert USDC to USD</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-gray-900">4.</span>
                <span>We send USD directly to your registered mobile money account</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-gray-900">5.</span>
                <span>You receive an SMS confirmation from your mobile money provider</span>
              </li>
            </ol>
          </div>

          <div className="text-xs text-gray-600 space-y-1">
            <p>• All transfers are processed instantly (subject to network availability)</p>
            <p>• Your mobile money number is linked to your workshop registration</p>
          </div>
        </div>
      </div>
    </div>
  );
}
