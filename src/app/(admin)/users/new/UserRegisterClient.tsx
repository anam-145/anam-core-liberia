'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import ProgressModal from '@/components/ui/ProgressModal';

export default function UserRegisterClient() {
  const router = useRouter();
  const [registrationType, setRegistrationType] = useState<string>('ANAMWALLET'); // Default: AnamWallet
  const [showCameraModal, setShowCameraModal] = useState(false);

  // Participant registration form state (includes sample data for development)
  const [formData, setFormData] = useState({
    name: 'John Doe', // Sample name
    phoneNumber: '886123456', // Sample phone number (9 digits)
    email: 'john.doe@example.com', // Sample email
    nationality: 'Liberia',
    gender: 'MALE', // Sample gender
    dateOfBirth: '1990-01-15', // Sample date of birth
    address: 'Monrovia, Montserrado County', // Sample address
    kycType: 'NIR', // Sample KYC type (National ID Registry)
    walletAddress: '0x089b5956c702Fc6654040f46666bFE383f9a7dF0', // Sample wallet address
    password: '', // Paper Voucher password
  });

  // File state
  const [kycDocument, setKycDocument] = useState<File | null>(null);
  const [kycFace, setKycFace] = useState<File | null>(null);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Progress Modal states
  const [showProgress, setShowProgress] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [progressDone, setProgressDone] = useState(false);

  // Form validation
  const validateForm = () => {
    const errors: Record<string, string> = {};

    // Required field validation
    if (!formData.name.trim()) {
      errors.name = 'Please enter name';
    }

    // Phone number is required only for USSD
    if (registrationType === 'USSD' && !formData.phoneNumber.trim()) {
      errors.phoneNumber = 'Phone number is required for USSD service';
    }

    // Phone number format validation (if entered) - 9 digits only
    if (formData.phoneNumber && !/^\d{9}$/.test(formData.phoneNumber)) {
      errors.phoneNumber = 'Phone number must be 9 digits (e.g., 886123456)';
    }

    // Email format validation (if entered)
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }

    if (!formData.nationality.trim()) {
      errors.nationality = 'Please enter nationality';
    }

    if (!formData.gender) {
      errors.gender = 'Please select gender';
    }

    if (!formData.dateOfBirth) {
      errors.dateOfBirth = 'Please enter date of birth';
    }

    if (!formData.kycType) {
      errors.kycType = 'Please select ID type';
    }

    if (!registrationType) {
      errors.registrationType = 'Please select wallet type';
    }

    // Wallet address is required for AnamWallet
    if (registrationType === 'ANAMWALLET' && !formData.walletAddress.trim()) {
      errors.walletAddress = 'Please enter wallet address';
    }

    // Wallet address format validation (0x followed by 40 hex chars)
    if (formData.walletAddress && !/^0x[a-fA-F0-9]{40}$/.test(formData.walletAddress)) {
      errors.walletAddress = 'Invalid Ethereum address format';
    }

    // Password is required for Paper Voucher
    if (registrationType === 'PAPERVOUCHER' && !formData.password.trim()) {
      errors.password = 'Password is required for paper voucher generation';
    }

    // Password minimum length validation (if entered)
    if (registrationType === 'PAPERVOUCHER' && formData.password && formData.password.length < 4) {
      errors.password = 'Password must be at least 4 characters';
    }

    // File validation
    if (!kycDocument) {
      errors.kycDocument = 'Please upload ID document';
    } else {
      // File type validation
      const allowedDocTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'];
      if (!allowedDocTypes.includes(kycDocument.type)) {
        errors.kycDocument = 'Only PDF, JPG, PNG, HEIC, WebP files are allowed';
      }
      // File size validation (10MB)
      if (kycDocument.size > 10 * 1024 * 1024) {
        errors.kycDocument = 'File size cannot exceed 10MB';
      }
    }

    if (!kycFace) {
      errors.kycFace = 'Please upload face photo';
    } else {
      // File type validation (images only)
      const allowedImageTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'];
      if (!allowedImageTypes.includes(kycFace.type)) {
        errors.kycFace = 'Only JPG, PNG, HEIC, WebP files are allowed';
      }
      // File size validation (10MB)
      if (kycFace.size > 10 * 1024 * 1024) {
        errors.kycFace = 'File size cannot exceed 10MB';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Form submission processing
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');

    // Set Progress Modal based on registration type
    setShowProgress(true);
    setProgressDone(false);

    if (registrationType === 'PAPERVOUCHER') {
      setProgressMsg('Creating user wallet. Please wait...');
    } else if (registrationType === 'USSD') {
      setProgressMsg('Registering USSD user...');
    } else {
      setProgressMsg('Registering AnamWallet user...');
    }

    try {
      // Add +231 country code if phone number exists
      const phoneWithCountryCode = formData.phoneNumber ? `+231${formData.phoneNumber}` : '';

      // Create FormData
      const submitData = new FormData();
      submitData.append('name', formData.name.trim());
      if (phoneWithCountryCode) submitData.append('phoneNumber', phoneWithCountryCode);
      if (formData.email) submitData.append('email', formData.email.trim());
      if (formData.gender) submitData.append('gender', formData.gender);
      if (formData.dateOfBirth) submitData.append('dateOfBirth', formData.dateOfBirth);
      if (formData.nationality) submitData.append('nationality', formData.nationality.trim());
      if (formData.address) submitData.append('address', formData.address.trim());
      submitData.append('registrationType', registrationType);
      if (formData.walletAddress) submitData.append('walletAddress', formData.walletAddress);
      if (formData.password) submitData.append('password', formData.password);
      if (formData.kycType) submitData.append('kycType', formData.kycType);

      // Add files
      if (kycDocument) submitData.append('kycDocument', kycDocument);
      if (kycFace) submitData.append('kycFace', kycFace);

      // API call (Content-Type is automatically set for multipart/form-data)
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        body: submitData,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409) {
          // Duplicate error handling - distinguish by details.field
          if (data?.details?.field === 'phoneNumber') {
            setFieldErrors({ phoneNumber: data.error || 'Phone number already registered.' });
            setError(data.error || 'Phone number already registered. Please use a different number.');
          } else if (data?.details?.field === 'walletAddress') {
            setFieldErrors({ walletAddress: data.error || 'Wallet address already registered.' });
            setError(data.error || 'Wallet address already registered. Please use a different address.');
          } else {
            // If no field info, distinguish by message
            if (data?.error?.includes('phone')) {
              setFieldErrors({ phoneNumber: data.error });
            } else if (data?.error?.includes('wallet')) {
              setFieldErrors({ walletAddress: data.error });
            }
            setError(data?.error || 'Duplicate information found. Please check your input.');
          }
          // Close Modal on 409 error and return
          setShowProgress(false);
          setProgressDone(false);
          setLoading(false);
          return;
        }
        throw new Error(data?.error || 'Registration failed.');
      }

      // Handle success with Modal for all cases
      if (registrationType === 'PAPERVOUCHER' && data?.qrData) {
        // Paper Voucher: Show detailed info
        setProgressMsg(
          `User wallet successfully created!\n\nWallet Address: ${data.qrData.address}\n\nVoucher issuance is available from the Users tab.`,
        );
      } else if (data?.message) {
        // Use server-provided message
        setProgressMsg(data.message);
      } else {
        // Default success message
        setProgressMsg('Participant successfully registered');
      }

      setProgressDone(true);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      // Close Modal on error
      setShowProgress(false);
      setProgressDone(false);
      setLoading(false);
    }
  };

  // Form reset
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
      walletAddress: '',
      password: '',
    });
    setRegistrationType('ANAMWALLET');
    setKycDocument(null);
    setKycFace(null);
    setFieldErrors({});
    setError('');
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">User Registration</h1>

      <form onSubmit={handleRegisterSubmit} className="bg-white rounded-lg shadow p-6">
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">{error}</div>}

        <div className="space-y-4">
          {/* Required Information */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <input
                type="text"
                className="input w-full"
                placeholder="e.g., Comfort Wleh"
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
              <label className="block text-sm font-medium mb-1">
                Phone Number {registrationType === 'USSD' ? '*' : ''}
              </label>
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
                  required={registrationType === 'USSD'}
                />
              </div>
              {fieldErrors.phoneNumber && <p className="text-red-500 text-xs mt-1">{fieldErrors.phoneNumber}</p>}
            </div>
          </div>

          {/* Optional Information */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
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
              <label className="block text-sm font-medium mb-1">Nationality *</label>
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
              <label className="block text-sm font-medium mb-1">Gender *</label>
              <select
                className="input w-full"
                value={formData.gender}
                onChange={(e) => {
                  setFormData({ ...formData, gender: e.target.value });
                  if (fieldErrors.gender) setFieldErrors({ ...fieldErrors, gender: '' });
                }}
                required
              >
                <option value="">Select</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
              {fieldErrors.gender && <p className="text-red-500 text-xs mt-1">{fieldErrors.gender}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date of Birth *</label>
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
            <label className="block text-sm font-medium mb-1">Address</label>
            <textarea
              className="input w-full"
              rows={2}
              placeholder="e.g., Monrovia, Montserrado County"
              value={formData.address}
              onChange={(e) => {
                setFormData({ ...formData, address: e.target.value });
              }}
            ></textarea>
          </div>

          {/* KYC Information */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-3">KYC Information *</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">ID Type *</label>
                <select
                  className="input w-full"
                  value={formData.kycType}
                  onChange={(e) => {
                    setFormData({ ...formData, kycType: e.target.value });
                    if (fieldErrors.kycType) setFieldErrors({ ...fieldErrors, kycType: '' });
                  }}
                  required
                >
                  <option value="">Select</option>
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
                  <label className="block text-sm font-medium mb-1">ID Document Copy *</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,.pdf"
                      className="input flex-1 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setKycDocument(file);
                        if (fieldErrors.kycDocument) setFieldErrors({ ...fieldErrors, kycDocument: '' });
                      }}
                      required
                    />
                    <button
                      type="button"
                      className="icon-btn h-11 w-11"
                      aria-label="Open camera"
                      onClick={() => setShowCameraModal(true)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/icons/camera.svg" alt="" width={24} height={24} />
                    </button>
                  </div>
                  {kycDocument && (
                    <p className="text-xs text-gray-600 mt-1">
                      Selected file: {kycDocument.name} ({(kycDocument.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                  {fieldErrors.kycDocument && <p className="text-red-500 text-xs mt-1">{fieldErrors.kycDocument}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Face Photo *</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/jpeg,image/png"
                      className="input flex-1 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setKycFace(file);
                        if (fieldErrors.kycFace) setFieldErrors({ ...fieldErrors, kycFace: '' });
                      }}
                      required
                    />
                    <button
                      type="button"
                      className="icon-btn h-11 w-11"
                      aria-label="Open camera"
                      onClick={() => setShowCameraModal(true)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/icons/camera.svg" alt="" width={24} height={24} />
                    </button>
                  </div>
                  {kycFace && (
                    <p className="text-xs text-gray-600 mt-1">
                      Selected file: {kycFace.name} ({(kycFace.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                  {fieldErrors.kycFace && <p className="text-red-500 text-xs mt-1">{fieldErrors.kycFace}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Wallet Type Selection */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium mb-1">Initial Wallet Type *</label>
            <select
              className="input w-full"
              required
              value={registrationType}
              onChange={(e) => {
                setRegistrationType(e.target.value);
                if (fieldErrors.registrationType) setFieldErrors({ ...fieldErrors, registrationType: '' });
              }}
            >
              <option value="">Select</option>
              <option value="ANAMWALLET">AnamWallet</option>
              <option value="USSD">USSD</option>
              <option value="PAPERVOUCHER">Paper Voucher</option>
            </select>
            {fieldErrors.registrationType && (
              <p className="text-red-500 text-xs mt-1">{fieldErrors.registrationType}</p>
            )}
          </div>

          {/* Wallet Address Registration - Only shown when AnamWallet is selected */}
          {registrationType === 'ANAMWALLET' && (
            <div className="pt-4">
              <label className="block text-sm font-medium mb-1">
                Wallet Address Registration <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Enter Ethereum address starting with 0x"
                  className="input flex-1"
                  value={formData.walletAddress}
                  onChange={(e) => {
                    setFormData({ ...formData, walletAddress: e.target.value });
                    if (fieldErrors.walletAddress) setFieldErrors({ ...fieldErrors, walletAddress: '' });
                  }}
                  required
                />
                <button
                  type="button"
                  className="icon-btn h-11 w-11"
                  aria-label="Scan QR"
                  onClick={() => setShowCameraModal(true)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icons/camera.svg" alt="" width={24} height={24} />
                </button>
              </div>
              {fieldErrors.walletAddress && <p className="text-red-500 text-xs mt-1">{fieldErrors.walletAddress}</p>}
              <p className="text-xs text-gray-500 mt-1">AnamWallet users must register wallet address</p>
            </div>
          )}

          {/* Password Input - Only shown when Paper Voucher is selected */}
          {registrationType === 'PAPERVOUCHER' && (
            <div className="pt-4">
              <label className="block text-sm font-medium mb-1">
                Voucher Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                placeholder="Enter password (minimum 4 characters)"
                className="input w-full"
                value={formData.password}
                onChange={(e) => {
                  setFormData({ ...formData, password: e.target.value });
                  if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: '' });
                }}
                required
              />
              {fieldErrors.password && <p className="text-red-500 text-xs mt-1">{fieldErrors.password}</p>}
              <p className="text-xs text-gray-500 mt-1">
                Password for paper voucher users. Please deliver it securely to the user.
              </p>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                resetForm();
                router.push('/users');
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Registering...' : 'Register'}
            </Button>
          </div>
        </div>
      </form>

      {/* Camera Modal */}
      {showCameraModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Camera</h3>
            <div className="h-64 bg-gray-100 rounded flex items-center justify-center mb-4">
              <p className="text-gray-500">Camera feature (to be implemented)</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowCameraModal(false)}>
                Close
              </Button>
              <Button onClick={() => setShowCameraModal(false)}>Capture</Button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Modal for Registration */}
      <ProgressModal
        open={showProgress}
        title={progressDone ? 'Registration Complete' : 'Processing Registration'}
        message={progressMsg}
        done={progressDone}
        confirmText="Confirm"
        onConfirm={() => {
          setShowProgress(false);
          setProgressDone(false);
          resetForm();
          router.push('/users');
        }}
      />
    </div>
  );
}
