'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export default function RedeemVoucherPage() {
  const router = useRouter();
  const [step, setStep] = useState<'input' | 'processing' | 'success' | 'error'>('input');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phoneNumber) {
      setErrorMessage('Please enter recipient phone number');
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
    setStep('input');
    setPassword('');
    setErrorMessage('');
  };

  const handleClose = () => {
    router.push('/withdraw');
  };

  return (
    <div className="max-w-screen-xl mx-auto">
      {/* Header - Same style as other admin pages */}
      <div className="mb-6 lg:mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-[var(--text)]">Paper Voucher Redemption</h1>
            <p className="text-sm lg:text-base text-[var(--muted)] mt-1">
              Scan and redeem paper vouchers to mobile money
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
          {/* Input Step */}
          {step === 'input' && (
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900">Transfer to Mobile Money</h2>
                <p className="text-sm text-gray-600 mt-1">Enter recipient details and amount to transfer</p>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <Input
                    label="Recipient Phone Number"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g. 0886-123-456"
                    autoFocus
                  />

                  <Input
                    label="Amount (USDC)"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 50.00"
                    min="0"
                    step="0.01"
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
                    {isLoading ? 'Processing...' : 'Transfer'}
                  </Button>
                </div>
              </form>

              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-800">
                  <strong>Note:</strong> USDC will be converted to USD and sent to the recipient&apos;s mobile money
                  account.
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

                <h2 className="text-xl font-bold text-gray-900 mb-2">Transfer Successful!</h2>
                <p className="text-sm text-gray-600 mb-6">${amount} USDC has been sent to mobile money</p>

                <div className="w-full space-y-3 bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Transaction ID</span>
                    <span className="font-mono font-semibold">TX-{Date.now()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Amount</span>
                    <span className="font-semibold">${amount} USDC</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Sent to</span>
                    <span className="font-semibold">{phoneNumber}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Status</span>
                    <span className="text-green-600 font-semibold">Completed</span>
                  </div>
                </div>

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

                <h2 className="text-xl font-bold text-gray-900 mb-2">Transfer Failed</h2>
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
              <li>1. Enter recipient phone number and amount</li>
              <li>2. Enter voucher password to authorize</li>
              <li>3. USDC is converted and sent to mobile money</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
