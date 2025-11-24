'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/stores/session.store';
import QRCode from 'qrcode';
import Image from 'next/image';

interface BalanceInfo {
  usdcBalance: string;
  ethBalance: string;
  walletAddress: string;
}

export default function TreasuryPage() {
  const router = useRouter();
  const { role, isLoaded } = useSessionStore();
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState<BalanceInfo | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState(false);

  // Role check
  useEffect(() => {
    if (isLoaded && role !== 'SYSTEM_ADMIN') {
      router.push('/denied');
    }
  }, [isLoaded, role, router]);

  // Fetch balances
  const fetchData = async () => {
    setRefreshing(true);
    // Reset balances to show loading state
    setBalances((prev) =>
      prev
        ? {
            ...prev,
            usdcBalance: '-',
            ethBalance: '-',
          }
        : null,
    );
    try {
      // Fetch real blockchain data
      const res = await fetch('/api/admin/treasury/balance');
      if (!res.ok) {
        throw new Error('Failed to fetch balance');
      }
      const data = await res.json();

      // Format balances for display
      setBalances({
        usdcBalance: parseFloat(data.usdcBalance).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
        ethBalance: parseFloat(data.ethBalance).toFixed(6),
        walletAddress: data.walletAddress,
      });

      // Generate QR code with actual wallet address
      const qrUrl = await QRCode.toDataURL(data.walletAddress, {
        width: 280,
        margin: 2,
        color: {
          dark: '#1a2332',
          light: '#ffffff',
        },
      });
      setQrCodeUrl(qrUrl);
    } catch (error) {
      console.error('Failed to fetch treasury data:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded && role === 'SYSTEM_ADMIN') {
      fetchData();
    }
  }, [isLoaded, role]);

  const copyAddress = async () => {
    if (!balances?.walletAddress) return;

    try {
      await navigator.clipboard.writeText(balances.walletAddress);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // Fallback
      const input = document.querySelector('.address-input') as HTMLInputElement;
      if (input) {
        input.select();
        document.execCommand('copy');
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      }
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading treasury data...</div>
      </div>
    );
  }

  return (
    <div className="max-w-screen-2xl mx-auto">
      {/* Header - Same style as Users page */}
      <div className="mb-6 lg:mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-[var(--text)]">Treasury Management</h1>
            <p className="text-sm lg:text-base text-[var(--muted)] mt-1">
              System Admin wallet for UNDP Liberia DSA programs on Base Mainnet
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div>
        {/* Main Card */}
        <div className="card">
          <div className="flex flex-col lg:flex-row">
            {/* QR Section (Left) */}
            <div className="lg:w-2/5 bg-gradient-to-br from-gray-50 to-gray-100 p-8 lg:p-12 flex flex-col items-center justify-center">
              <div className="relative">
                {/* QR Glow Effect */}
                <div className="absolute inset-0 bg-blue-500/20 rounded-2xl blur-2xl scale-110" />

                {/* QR Container */}
                <div className="relative bg-white p-6 rounded-2xl shadow-lg">
                  {qrCodeUrl ? (
                    <Image src={qrCodeUrl} alt="Wallet QR Code" width={256} height={256} />
                  ) : (
                    <div className="w-64 h-64 bg-gray-100 rounded-lg animate-pulse" />
                  )}

                  {/* Base Logo Badge */}
                  <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white rounded-full shadow-lg flex items-center justify-center p-2">
                    <Image
                      src="/img/base-logo.png"
                      alt="Base Network"
                      width={48}
                      height={48}
                      className="object-contain"
                    />
                  </div>
                </div>
              </div>

              <p className="mt-8 text-gray-600 font-medium">Scan QR to send funds</p>
            </div>

            {/* Info Section (Right) */}
            <div className="lg:w-3/5 p-8 lg:p-12">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">System Admin Wallet</h2>
                <p className="text-gray-600">Primary funding source for all UNDP Liberia DSA events</p>
              </div>

              {/* Balances Grid */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-white rounded-xl p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">USDC Balance</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {balances?.usdcBalance === '-' ? '-' : `$${balances?.usdcBalance || '0.00'}`}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Available for events</div>
                </div>

                <div className="bg-white rounded-xl p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">ETH Balance</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {balances?.ethBalance === '-' ? '-' : balances?.ethBalance || '0.00'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">For gas fees</div>
                </div>
              </div>

              {/* Wallet Address */}
              <div className="mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full mb-4 border border-gray-200">
                  <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm font-semibold text-gray-700">Official System Wallet</span>
                </div>

                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Wallet Address
                </label>

                <div className="flex gap-2">
                  <input
                    type="text"
                    className="address-input flex-1 px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl font-mono text-sm text-gray-800 focus:outline-none focus:border-[var(--brand)] focus:bg-white transition-all"
                    value={balances?.walletAddress || ''}
                    readOnly
                  />
                  <button
                    onClick={copyAddress}
                    className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                      copySuccess
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-900 text-white hover:bg-gray-800 hover:scale-105'
                    }`}
                  >
                    {copySuccess ? (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Quick Steps */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="font-semibold text-gray-900 mb-4">How to Fund</h3>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      1
                    </div>
                    <span className="text-sm text-gray-700">Scan QR or Copy Address</span>
                  </div>
                  <div className="hidden sm:block h-0.5 flex-1 bg-gray-300" />
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      2
                    </div>
                    <span className="text-sm text-gray-700">Send USDC from Binance</span>
                  </div>
                  <div className="hidden sm:block h-0.5 flex-1 bg-gray-300" />
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      3
                    </div>
                    <span className="text-sm text-gray-700">Funds Ready</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 justify-start mt-6">
          <button
            onClick={fetchData}
            disabled={refreshing}
            className="px-6 py-3 bg-white rounded-xl shadow-md hover:shadow-lg transition-all font-semibold flex items-center gap-3 hover:scale-105"
          >
            <svg
              className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {refreshing ? 'Refreshing...' : 'Refresh Balance'}
          </button>

          <a
            href={`${process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL}/address/${balances?.walletAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-white rounded-xl shadow-md hover:shadow-lg transition-all font-semibold flex items-center gap-3 hover:scale-105"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            View on Explorer
          </a>

          <button
            onClick={() => router.push('/events')}
            className="px-6 py-3 bg-white text-black rounded-xl shadow-md hover:shadow-lg transition-all font-semibold flex items-center gap-3 hover:scale-105 hover:bg-gray-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Create Event
          </button>
        </div>
      </div>
    </div>
  );
}
