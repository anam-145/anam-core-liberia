'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface VoucherInfo {
  voucherId: string;
  balance: string;
  walletAddress: string;
  phoneNumber: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export default function RedeemVoucherPage() {
  const router = useRouter();
  const [step, setStep] = useState<'password' | 'processing' | 'success' | 'error'>('password');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Mock voucher data (실제로는 QR 스캔 결과로 받을 데이터)
  const [voucherInfo] = useState<VoucherInfo>({
    voucherId: 'PV-2024-0001',
    balance: '50.00',
    walletAddress: '0x742d...bEb0',
    phoneNumber: '0886-XXX-XXX',
    status: 'pending',
  });

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password) {
      setErrorMessage('Please enter your password');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setStep('processing');

    // Simulate processing
    setTimeout(() => {
      // Mock success (70% chance)
      const isSuccess = Math.random() > 0.3;

      if (isSuccess) {
        setStep('success');
      } else {
        setStep('error');
        setErrorMessage('Transaction failed. Please try again.');
      }
      setIsLoading(false);
    }, 3000);
  };

  const handleRetry = () => {
    setStep('password');
    setPassword('');
    setErrorMessage('');
  };

  const handleClose = () => {
    router.push('/cashout');
  };

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Mobile Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">Paper Voucher Redemption</h1>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      <div className="px-4 py-6 max-w-md mx-auto">
        {/* Voucher Info Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Amount</span>
              <span className="text-lg font-bold text-gray-900">${voucherInfo.balance} USDC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Recipient</span>
              <span className="text-sm font-medium text-gray-900">{voucherInfo.phoneNumber}</span>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Password Step */}
          {step === 'password' && (
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900">Enter Voucher Password</h2>
                <p className="text-sm text-gray-600 mt-1">Enter the password to unlock and redeem this voucher</p>
              </div>

              <form onSubmit={handlePasswordSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      placeholder="Enter voucher password"
                      autoFocus
                    />
                    {errorMessage && <p className="mt-2 text-sm text-red-600">{errorMessage}</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 bg-[#8a1e1e] text-white font-semibold rounded-lg hover:bg-[#7a1a1a] disabled:bg-gray-400 transition-colors"
                  >
                    Unlock & Redeem
                  </button>
                </div>
              </form>

              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-800">
                  <strong>Note:</strong> This will transfer ${voucherInfo.balance} USDC from the voucher to your mobile
                  money account ({voucherInfo.phoneNumber}).
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
                  <div className="absolute inset-0 border-4 border-red-200 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-red-600 rounded-full animate-spin border-t-transparent"></div>
                </div>

                <h2 className="text-xl font-bold text-gray-900 mb-2">Processing Redemption</h2>

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
                    <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center mr-3 animate-pulse">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                    <span className="text-gray-700">Transferring to service wallet...</span>
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
          {step === 'success' && (
            <div className="p-8 text-center">
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>

                <h2 className="text-xl font-bold text-gray-900 mb-2">Redemption Successful!</h2>
                <p className="text-sm text-gray-600 mb-6">
                  ${voucherInfo.balance} USDC has been sent to your mobile money
                </p>

                <div className="w-full space-y-3 bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Transaction ID</span>
                    <span className="font-mono font-semibold">TX-2024-0001</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Amount</span>
                    <span className="font-semibold">${voucherInfo.balance} USDC</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Sent to</span>
                    <span className="font-semibold">{voucherInfo.phoneNumber}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Status</span>
                    <span className="text-green-600 font-semibold">Completed</span>
                  </div>
                </div>

                <button
                  onClick={handleClose}
                  className="w-full py-3 bg-[#8a1e1e] text-white font-semibold rounded-lg hover:bg-[#7a1a1a] transition-colors"
                >
                  Done
                </button>
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

                <h2 className="text-xl font-bold text-gray-900 mb-2">Redemption Failed</h2>
                <p className="text-sm text-gray-600 mb-6">
                  {errorMessage || 'Something went wrong. Please try again.'}
                </p>

                <div className="w-full space-y-3">
                  <button
                    onClick={handleRetry}
                    className="w-full py-3 bg-[#8a1e1e] text-white font-semibold rounded-lg hover:bg-[#7a1a1a] transition-colors"
                  >
                    Try Again
                  </button>

                  <button
                    onClick={handleClose}
                    className="w-full py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Process Flow Info */}
        {step === 'password' && (
          <div className="mt-6 bg-gray-100 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">How it works:</h3>
            <ol className="space-y-1 text-xs text-gray-700">
              <li>1. Enter password to unlock the voucher wallet</li>
              <li>2. Transfer USDC from voucher to our service wallet</li>
              <li>3. Convert and send USD to your mobile money</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
