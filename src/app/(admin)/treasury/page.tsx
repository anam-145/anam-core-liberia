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

interface Transaction {
  txHash: string;
  from: string;
  to: string;
  value: string;
  gasUsed?: string;
  gasPrice?: string;
  timestamp: string;
  blockNumber: string;
}

export default function TreasuryPage() {
  const router = useRouter();
  const { role, isLoaded } = useSessionStore();
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState<BalanceInfo | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingHistory, setRefreshingHistory] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Role check
  useEffect(() => {
    if (isLoaded && role !== 'SYSTEM_ADMIN') {
      router.push('/denied');
    }
  }, [isLoaded, role, router]);

  // Fetch transaction history
  const fetchTransactions = async () => {
    setRefreshingHistory(true);
    try {
      // Add a minimum delay for better UX (prevents flashing)
      const [res] = await Promise.all([
        fetch('/api/admin/treasury/transactions?limit=10'),
        new Promise((resolve) => setTimeout(resolve, 300)), // Minimum 300ms for smooth animation
      ]);

      if (!res.ok) {
        throw new Error('Failed to fetch transactions');
      }
      const data = await res.json();

      // Update wallet address if available
      if (data.walletAddress && !balances?.walletAddress) {
        setBalances((prev) => (prev ? { ...prev, walletAddress: data.walletAddress } : null));
      }

      setTransactions(data.transactions || []);
    } catch (error) {
      console.error('Failed to fetch transaction history:', error);
    } finally {
      setRefreshingHistory(false);
    }
  };

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
      fetchTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        {/* Action Buttons - Moved to top */}
        <div className="card mb-6">
          <div className="p-6">
            <div className="flex flex-wrap gap-4">
              <button
                onClick={fetchData}
                disabled={refreshing}
                className="px-6 py-3 bg-[#8a1e1e] text-white rounded-xl font-semibold flex items-center gap-2 hover:bg-[#7a1a1a] transition-all disabled:bg-gray-400"
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
                href={`${process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL || 'https://basescan.org'}/address/${balances?.walletAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-semibold flex items-center gap-2 hover:bg-gray-50 transition-all"
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
                className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-semibold flex items-center gap-2 hover:bg-gray-50 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create Event
              </button>
            </div>
          </div>
        </div>

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

        {/* USDC Transaction History */}
        <div className="card mt-6">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-gray-900">USDC Transaction History</h3>
                <button
                  onClick={fetchTransactions}
                  disabled={refreshingHistory}
                  className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all flex items-center gap-1.5"
                >
                  <svg
                    className={`w-3.5 h-3.5 ${refreshingHistory ? 'animate-spin' : ''}`}
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
                  Refresh
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Direction
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      From
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      To
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Gas Fee
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Block
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      TX Hash
                    </th>
                  </tr>
                </thead>
                <tbody
                  className={`divide-y divide-gray-200 ${refreshingHistory && transactions.length > 0 ? 'relative' : ''}`}
                >
                  {/* Overlay for existing data refresh */}
                  {refreshingHistory && transactions.length > 0 && (
                    <tr className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10">
                      <td colSpan={8} className="h-full">
                        <div className="flex items-center justify-center h-full">
                          <div className="flex flex-col items-center gap-3 bg-white/90 px-6 py-4 rounded-xl shadow-lg">
                            <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-[#8a1e1e]"></div>
                            <span className="text-sm text-gray-700 font-medium">Updating transactions...</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Skeleton Rows for Initial Loading */}
                  {refreshingHistory && transactions.length === 0 && (
                    <>
                      {[...Array(5)].map((_, index) => (
                        <tr key={`skeleton-${index}`} className="animate-pulse">
                          <td className="py-4 px-4">
                            <div className="flex items-center">
                              <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
                              <div className="ml-2 h-4 w-10 bg-gray-200 rounded"></div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 w-24 bg-gray-200 rounded"></div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 w-24 bg-gray-200 rounded"></div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 w-20 bg-gray-200 rounded"></div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 w-16 bg-gray-200 rounded"></div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 w-20 bg-gray-200 rounded"></div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 w-24 bg-gray-200 rounded"></div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-8 w-16 bg-gray-200 rounded-lg"></div>
                          </td>
                        </tr>
                      ))}
                    </>
                  )}

                  {/* Actual Transactions */}
                  {!refreshingHistory &&
                    transactions.map((tx) => {
                      // Use actual wallet address from balances
                      const systemWallet = balances?.walletAddress;
                      if (!systemWallet) return null;
                      const isIncoming = tx.to.toLowerCase() === systemWallet.toLowerCase();
                      // gasPrice is already in gwei from API
                      const gasFee =
                        tx.gasUsed && tx.gasPrice
                          ? ((parseFloat(tx.gasUsed) * parseFloat(tx.gasPrice)) / 1000000000).toFixed(6)
                          : '0';

                      return (
                        <tr key={tx.txHash} className="hover:bg-gray-50">
                          <td className="py-4 px-4">
                            <div className="flex items-center">
                              {isIncoming ? (
                                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                                  <svg
                                    className="w-3 h-3 text-green-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={3}
                                      d="M7 11l5-5m0 0l5 5m-5-5v12"
                                    />
                                  </svg>
                                </div>
                              ) : (
                                <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                                  <svg
                                    className="w-3 h-3 text-red-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={3}
                                      d="M17 13l-5 5m0 0l-5-5m5 5V6"
                                    />
                                  </svg>
                                </div>
                              )}
                              <span
                                className={`ml-2 text-xs font-semibold ${isIncoming ? 'text-green-600' : 'text-red-600'}`}
                              >
                                {isIncoming ? 'IN' : 'OUT'}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="text-xs text-gray-600 font-mono">
                              {tx.from.slice(0, 6)}...{tx.from.slice(-4)}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="text-xs text-gray-600 font-mono">
                              {tx.to.slice(0, 6)}...{tx.to.slice(-4)}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className={`text-sm font-bold ${isIncoming ? 'text-green-600' : 'text-red-600'}`}>
                              {isIncoming ? '+' : '-'}
                              {tx.value} USDC
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="text-xs text-gray-500">{gasFee} ETH</div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="text-xs text-gray-600 font-mono">{tx.blockNumber}</div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="text-xs text-gray-600">
                              {new Date(tx.timestamp).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <a
                              href={`${process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL || 'https://basescan.org'}/tx/${tx.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#8a1e1e] text-white text-xs font-semibold rounded-lg hover:bg-[#7a1a1a] transition-all"
                            >
                              View TX
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                />
                              </svg>
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>

              {/* Empty State - Only show when not loading and no data */}
              {!refreshingHistory && transactions.length === 0 && (
                <div className="text-center py-12">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400 mb-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="text-gray-500 font-medium">No USDC transactions found</p>
                  <p className="text-sm text-gray-400 mt-1">Transactions will appear here once processed</p>
                </div>
              )}
            </div>

            {/* Info Note */}
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-700">
                <strong>Note:</strong> This table shows only USDC token transfers. Gas fees are paid in ETH from the
                sender&apos;s wallet.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
