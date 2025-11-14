'use client';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Logo from '@/components/icons/Logo';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      // Login successful - redirect to dashboard
      router.push('/dashboard');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_err) {
      setError('Network error. Please try again.');
      setLoading(false);
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
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" /> <span style={{ fontSize: 13, color: '#475467' }}>Remember me</span>
              </label>
            </div>
          </CardBody>
          <CardFooter>
            <div style={{ display: 'flex', gap: 10, width: '100%', justifyContent: 'space-between' }}>
              <Button type="submit" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Logging in...' : 'Login'}
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
