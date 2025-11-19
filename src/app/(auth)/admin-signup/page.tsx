'use client';

import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Logo from '@/components/icons/Logo';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import ProgressModal from '@/components/ui/ProgressModal';

export default function AdminSignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showModal, setShowModal] = useState(false);
  const [modalMsg, setModalMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const fe: Record<string, string> = {};
    if (password !== confirmPassword) {
      fe.confirmPassword = 'Passwords do not match.';
    }
    if (!username.trim()) fe.username = 'Please enter username.';
    if (!fullName.trim()) fe.fullName = 'Please enter full name.';
    if (!password) fe.password = 'Please enter password.';
    if (Object.keys(fe).length > 0) {
      setFieldErrors(fe);
      setError('Please check your input.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/public/admins/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, fullName, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const details = (data && data.details) || {};
        const serverFieldErrors = (details && (details.fieldErrors as Record<string, string>)) || {};
        setFieldErrors(serverFieldErrors);
        setError(data.error || 'Application failed');
        return;
      }
      setModalMsg('Application submitted. Please wait for admin approval.');
      setShowModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Application failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <Card>
        <ProgressModal
          open={showModal}
          title="Application Complete"
          message={modalMsg}
          done
          confirmText="Confirm"
          onConfirm={() => {
            setShowModal(false);
            router.push('/login');
          }}
        />
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Logo size={36} />
              <div>
                <div style={{ fontWeight: 800 }}>ANAM Admin</div>
                <small style={{ color: 'var(--muted)' }}>New Admin Application</small>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            <div style={{ display: 'grid', gap: 14, width: 420, maxWidth: '85vw' }}>
              {error && (
                <div
                  style={{
                    padding: 12,
                    background: '#fee',
                    border: '1px solid #fcc',
                    borderRadius: 8,
                    color: '#c33',
                    fontSize: 13,
                  }}
                >
                  {error}
                </div>
              )}
              <Input
                label="Username"
                placeholder="admin"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (fieldErrors.username) setFieldErrors((s) => ({ ...s, username: '' }));
                }}
                required
              />
              {fieldErrors.username && <div style={{ color: '#c33', fontSize: 12 }}>{fieldErrors.username}</div>}

              <Input
                label="Full Name"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (fieldErrors.fullName) setFieldErrors((s) => ({ ...s, fullName: '' }));
                }}
                required
              />
              {fieldErrors.fullName && <div style={{ color: '#c33', fontSize: 12 }}>{fieldErrors.fullName}</div>}

              <Input
                label="Email (Optional)"
                type="email"
                placeholder="name@example.org"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors((s) => ({ ...s, email: '' }));
                }}
              />
              {fieldErrors.email && <div style={{ color: '#c33', fontSize: 12 }}>{fieldErrors.email}</div>}

              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors((s) => ({ ...s, password: '' }));
                }}
                required
              />
              {fieldErrors.password && <div style={{ color: '#c33', fontSize: 12 }}>{fieldErrors.password}</div>}

              <Input
                label="Confirm Password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (fieldErrors.confirmPassword) setFieldErrors((s) => ({ ...s, confirmPassword: '' }));
                }}
                required
              />
              {fieldErrors.confirmPassword && (
                <div style={{ color: '#c33', fontSize: 12 }}>{fieldErrors.confirmPassword}</div>
              )}
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                Once approved, wallet/DID/ADMIN VC creation and encrypted vault storage will be completed on first
                login.
              </div>
            </div>
          </CardBody>
          <CardFooter>
            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              <Button type="submit" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Submitting...' : 'Submit Application'}
              </Button>
            </div>
            <div style={{ marginTop: 10, textAlign: 'center' }}>
              <button
                type="button"
                className="btn btn--link"
                onClick={() => router.push('/login')}
                style={{ fontSize: 13 }}
              >
                Back to Login
              </button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
