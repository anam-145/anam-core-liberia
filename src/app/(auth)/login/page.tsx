'use client';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Logo from '@/components/icons/Logo';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import ProgressModal from '@/components/ui/ProgressModal';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [progressMsg, setProgressMsg] = useState('Processing login...');
  const [blockExit, setBlockExit] = useState(false);
  const [progressDone, setProgressDone] = useState(false);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!blockExit) return;
      e.preventDefault();
      // Some browsers require returnValue to be set
      // eslint-disable-next-line no-param-reassign
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [blockExit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1) Precheck (조건 기반 진행 모달/이탈 방지)
      const [sys, pre] = await Promise.all([
        fetch('/api/system/status')
          .then((r) => r.json())
          .catch(() => ({ initialized: true })),
        fetch('/api/public/admins/precheck', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username }),
        })
          .then((r) => r.json())
          .catch(() => ({ needsActivation: false })),
      ]);

      let timer: ReturnType<typeof setTimeout> | null = null;
      const heavy = !sys.initialized || pre.needsActivation;
      if (heavy) {
        setProgressMsg(
          pre.needsActivation ? 'Initial setup in progress. Please wait...' : 'System initialization in progress...',
        );
        setShowProgress(true);
        setBlockExit(true);
      } else {
        timer = setTimeout(() => {
          setProgressMsg('Processing login...');
          setShowProgress(true);
          setTimeout(() => setProgressMsg('Initial setup in progress. Please wait...'), 2500);
        }, 500);
      }

      // 2) Login request
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        if (timer) clearTimeout(timer);
        setShowProgress(false);
        setBlockExit(false);
        return;
      }

      if (data.activated) {
        // Show success state in modal instead of alert
        if (timer) clearTimeout(timer);
        setProgressMsg('Initial setup completed. Wallet/DID/VC are ready.');
        setProgressDone(true);
        setShowProgress(true);
        setBlockExit(false);
        setLoading(false);
        return; // wait for user to confirm
      }

      // Normal login without activation
      router.push('/checkins');
      if (timer) clearTimeout(timer);
      setShowProgress(false);
      setBlockExit(false);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_err) {
      console.error('>>> [LOGIN] ❌ Network error:', _err);
      setError('Network error. Please try again.');
      setLoading(false);
      setShowProgress(false);
      setBlockExit(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
      }}
    >
      <Card>
        <ProgressModal
          open={showProgress}
          title={progressDone ? 'Complete' : 'Processing'}
          message={progressMsg}
          done={progressDone}
          confirmText="Confirm"
          onConfirm={() => {
            setShowProgress(false);
            setProgressDone(false);
            router.push('/checkins');
          }}
        />
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Logo size={36} />
              <div>
                <div style={{ fontWeight: 800 }}>ANAM Admin</div>
                <small style={{ color: 'var(--muted)' }}>UNDP Liberia - Sign in to continue</small>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            <div style={{ display: 'grid', gap: 14, width: 360, maxWidth: '80vw' }}>
              {error && (
                <div
                  style={{
                    padding: '12px',
                    backgroundColor: '#fee',
                    border: '1px solid #fcc',
                    borderRadius: '8px',
                    color: '#c33',
                    fontSize: '13px',
                  }}
                >
                  {error}
                </div>
              )}
              <Input
                label="Username"
                type="text"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardBody>
          <CardFooter>
            <div style={{ display: 'flex', gap: 10, width: '100%', justifyContent: 'space-between' }}>
              <Button type="submit" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Logging in...' : 'Login'}
              </Button>
            </div>
            <div style={{ marginTop: 10, textAlign: 'center' }}>
              <button
                type="button"
                className="btn btn--link"
                onClick={() => router.push('/admin-signup')}
                style={{ fontSize: 13 }}
              >
                Apply as New Admin
              </button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
