'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Logo from '../icons/Logo';
import { useSessionStore } from '@/stores/session.store';

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const router = useRouter();
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [utcNow, setUtcNow] = React.useState<string>('');

  // Use Zustand store for session management
  const { role, isLoaded: sessionLoaded, fetchSession } = useSessionStore();

  // 바디 스크롤 잠금 (모바일 드로어 열렸을 때)
  React.useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  // ESC 키로 드로어 닫기
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [sidebarOpen]);

  // Load session role for role-aware navigation (once on mount)
  React.useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Update UTC clock every second
  React.useEffect(() => {
    const update = () => {
      const now = new Date();
      const year = now.getUTCFullYear();
      const month = String(now.getUTCMonth() + 1).padStart(2, '0');
      const day = String(now.getUTCDate()).padStart(2, '0');
      const hours = String(now.getUTCHours()).padStart(2, '0');
      const minutes = String(now.getUTCMinutes()).padStart(2, '0');
      const seconds = String(now.getUTCSeconds()).padStart(2, '0');
      setUtcNow(`${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`);
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        id="sidebar"
        role={sidebarOpen ? 'dialog' : undefined}
        aria-modal={sidebarOpen ? true : undefined}
        aria-label={sidebarOpen ? 'Sidebar Menu' : undefined}
        className={`
          fixed lg:static inset-y-0 left-0 z-50 w-[280px]
          bg-white border-r border-[var(--line)]
          flex flex-col
          transform transition-transform duration-200 ease-in-out
          lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="brand">
          <Logo size={44} />
          <div className="brand__text">
            <div className="brand__title">ANAM Admin</div>
            <small>UNDP Liberia</small>
          </div>
        </div>
        <nav className="nav">
          {/* Treasury (SYSTEM_ADMIN only) - First menu item for System Admin */}
          {sessionLoaded && role === 'SYSTEM_ADMIN' && (
            <>
              <Link
                href="/treasury"
                className={pathname?.startsWith('/treasury') ? 'active' : ''}
                onClick={() => setSidebarOpen(false)}
              >
                <span>Treasury</span>
              </Link>
              <Link
                href="/withdraw"
                className={pathname?.startsWith('/withdraw') ? 'active' : ''}
                onClick={() => setSidebarOpen(false)}
              >
                <span>Mobile Money</span>
              </Link>
            </>
          )}
          {/* Check-in (STAFF only) */}
          {sessionLoaded && role === 'STAFF' && (
            <Link
              href="/checkins"
              className={pathname?.startsWith('/checkins') ? 'active' : ''}
              onClick={() => setSidebarOpen(false)}
            >
              <span>Check-in</span>
            </Link>
          )}
          {/* Dashboard (STAFF only) */}
          {sessionLoaded && role === 'STAFF' && (
            <Link
              href="/dashboard"
              className={pathname?.startsWith('/dashboard') ? 'active' : ''}
              onClick={() => setSidebarOpen(false)}
            >
              <span>Dashboard</span>
            </Link>
          )}
          {/* Users (accessible to both SYSTEM_ADMIN and STAFF) */}
          <Link
            href="/users"
            className={pathname?.startsWith('/users') ? 'active' : ''}
            onClick={() => setSidebarOpen(false)}
          >
            <span>Participants</span>
          </Link>
          {/* SYSTEM_ADMIN only menu - remaining items */}
          {sessionLoaded && role === 'SYSTEM_ADMIN' && (
            <>
              <Link
                href="/admins"
                className={pathname?.startsWith('/admins') ? 'active' : ''}
                onClick={() => setSidebarOpen(false)}
              >
                <span>Admins</span>
              </Link>
              <Link
                href="/events"
                className={pathname?.startsWith('/events') ? 'active' : ''}
                onClick={() => setSidebarOpen(false)}
              >
                <span>Events</span>
              </Link>
            </>
          )}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="shell__header">
          {/* Hamburger Button (Mobile Only) */}
          <button
            type="button"
            className="lg:hidden p-2 -ml-2 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Open menu"
            aria-expanded={sidebarOpen}
            aria-controls="sidebar"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div style={{ fontWeight: 700 }}>Admin Dashboard</div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
            {utcNow && (
              <div className="hidden md:flex items-center text-xs text-[var(--muted)] gap-2 px-2 py-1 rounded bg-gray-50 border border-[var(--line)]">
                <span className="font-semibold text-gray-700">UTC</span>
                <span className="font-mono tracking-tight">{utcNow}</span>
              </div>
            )}
            {sessionLoaded && (
              <div className="badge badge--brand">{role === 'SYSTEM_ADMIN' ? 'System Admin' : 'Staff'}</div>
            )}
            <button
              className="btn btn--secondary btn--sm"
              onClick={async () => {
                if (loggingOut) return;
                try {
                  setLoggingOut(true);
                  await fetch('/api/admin/auth/logout', { method: 'POST' });
                  router.push('/login');
                } finally {
                  setLoggingOut(false);
                }
              }}
              disabled={loggingOut}
            >
              {loggingOut ? 'Logging out…' : 'Logout'}
            </button>
          </div>
        </header>

        {/* Main */}
        <main className="shell__main overflow-auto">{children}</main>
      </div>
    </div>
  );
}
