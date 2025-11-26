'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

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

export default function RedeemVoucherPage() {
  const router = useRouter();
  const [step, setStep] = useState<'loading' | 'input' | 'processing' | 'success' | 'error'>('loading');
  const [password, setPassword] = useState('');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [payload, setPayload] = useState<PaperVoucherPayload | null>(null);
  const [txResult, setTxResult] = useState<{
    txHash: string;
    from: string;
    to: string;
    amount: string;
  } | null>(null);

  // Load payload from sessionStorage
  useEffect(() => {
    const data = sessionStorage.getItem('withdrawPayload');
    if (!data) {
      // No payload - redirect back to withdraw page
      router.push('/withdraw');
      return;
    }

    try {
      const parsed = JSON.parse(data) as PaperVoucherPayload;
      if (!parsed.address || !parsed.vault?.ciphertext) {
        throw new Error('Invalid payload structure');
      }
      setPayload(parsed);
      setStep('input');
      // Remove from sessionStorage after reading (one-time use)
      sessionStorage.removeItem('withdrawPayload');
    } catch {
      sessionStorage.removeItem('withdrawPayload');
      router.push('/withdraw');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!payload) {
      setErrorMessage('No voucher data. Please scan again.');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setErrorMessage('Please enter a valid amount');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter voucher password');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setStep('processing');

    try {
      const res = await fetch('/api/withdraw/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: {
            address: payload.address,
            vault: payload.vault,
          },
          password,
          amount,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStep('error');
        setErrorMessage(data.error || 'Transaction failed. Please try again.');
        return;
      }

      setTxResult({
        txHash: data.txHash,
        from: data.from,
        to: data.to,
        amount: data.amount,
      });
      setStep('success');
    } catch (error) {
      console.error('Redeem error:', error);
      setStep('error');
      setErrorMessage('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    setStep('input');
    setPassword('');
    setErrorMessage('');
  };

  const handleClose = () => {
    router.push('/withdraw');
  };

  // Truncate address for display
  const truncateAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="max-w-screen-xl mx-auto">
      {/* Header - Same style as other admin pages */}
      <div className="mb-6 lg:mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-[var(--text)]">Paper Voucher Redemption</h1>
            <p className="text-sm lg:text-base text-[var(--muted)] mt-1">
              Withdraw USDC from your paper voucher to mobile money
            </p>
          </div>
          <Button variant="secondary" onClick={handleClose}>
            ← Back to Withdraw
          </Button>
        </div>
      </div>

      <div className="max-w-md mx-auto">
        {/* Main Content Area */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Loading Step */}
          {step === 'loading' && (
            <div className="p-8 text-center">
              <div className="text-gray-500">Loading voucher data...</div>
            </div>
          )}

          {/* Input Step */}
          {step === 'input' && payload && (
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900">Withdraw to Mobile Money</h2>
                <p className="text-sm text-gray-600 mt-1">Enter amount and password to complete withdrawal</p>
              </div>

              {/* Wallet Address Info */}
              <div className="bg-purple-50 rounded-lg p-3 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-purple-700 font-medium">Voucher Wallet</span>
                  <span className="text-xs font-mono text-purple-900">{truncateAddress(payload.address)}</span>
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <Input
                    label="Amount (USDC)"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 50.00"
                    min="0"
                    step="0.01"
                    autoFocus
                  />

                  <Input
                    label="Voucher Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter voucher password"
                  />

                  {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

                  <Button type="submit" disabled={isLoading} style={{ width: '100%' }}>
                    {isLoading ? 'Processing...' : 'Withdraw'}
                  </Button>
                </div>
              </form>

              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-800">
                  <strong>Note:</strong> USDC will be sent to our service wallet and converted to USD for your mobile
                  money account.
                </p>
              </div>
            </div>
          )}

          {/* Processing Step */}
          {step === 'processing' && (
            <div className="p-8 text-center">
              <div className="flex flex-col items-center">
                {/* Processing Animation */}
                <div className="relative w-20 h-20 mb-6">
                  <div className="absolute inset-0 border-4 border-purple-200 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-purple-600 rounded-full animate-spin border-t-transparent"></div>
                </div>

                <h2 className="text-xl font-bold text-gray-900 mb-2">Processing Withdrawal</h2>

                <div className="space-y-3 w-full max-w-xs mt-4">
                  <div className="flex items-center text-sm">
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center mr-3">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-gray-700">Unlocking voucher wallet...</span>
                  </div>

                  <div className="flex items-center text-sm">
                    <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center mr-3 animate-pulse">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                    <span className="text-gray-700">Transferring USDC to service...</span>
                  </div>

                  <div className="flex items-center text-sm opacity-50">
                    <div className="w-6 h-6 rounded-full border-2 border-gray-300 mr-3"></div>
                    <span className="text-gray-500">Converting to mobile money...</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Success Step */}
          {step === 'success' && txResult && (
            <div className="p-8 text-center">
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>

                <h2 className="text-xl font-bold text-gray-900 mb-2">Withdrawal Successful!</h2>
                <p className="text-sm text-gray-600 mb-6">${txResult.amount} USDC has been sent for conversion</p>

                <div className="w-full space-y-3 bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Transaction</span>
                    <a
                      href={`${process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL || 'https://basescan.org'}/tx/${txResult.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-purple-600 hover:underline"
                    >
                      {truncateAddress(txResult.txHash)}
                    </a>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Amount</span>
                    <span className="font-semibold">${txResult.amount} USDC</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">From</span>
                    <span className="font-mono text-xs">{truncateAddress(txResult.from)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">To (Service)</span>
                    <span className="font-mono text-xs">{truncateAddress(txResult.to)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Status</span>
                    <span className="text-green-600 font-semibold">Completed</span>
                  </div>
                </div>

                <p className="text-xs text-gray-500 mb-4">
                  You will receive an SMS when the mobile money transfer is complete.
                </p>

                <Button onClick={handleClose} style={{ width: '100%' }}>
                  Done
                </Button>
              </div>
            </div>
          )}

          {/* Error Step */}
          {step === 'error' && (
            <div className="p-8 text-center">
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>

                <h2 className="text-xl font-bold text-gray-900 mb-2">Withdrawal Failed</h2>
                <p className="text-sm text-gray-600 mb-6">
                  {errorMessage || 'Something went wrong. Please try again.'}
                </p>

                <div className="w-full space-y-3">
                  <Button onClick={handleRetry} style={{ width: '100%' }}>
                    Try Again
                  </Button>

                  <Button variant="secondary" onClick={handleClose} style={{ width: '100%' }}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Process Flow Info */}
        {step === 'input' && (
          <div className="mt-6 bg-gray-100 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">How it works:</h3>
            <ol className="space-y-1 text-xs text-gray-700">
              <li>1. Enter the amount of USDC to withdraw</li>
              <li>2. Enter your voucher password to authorize</li>
              <li>3. USDC is sent to our service and converted to mobile money</li>
              <li>4. You&apos;ll receive an SMS confirmation</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
