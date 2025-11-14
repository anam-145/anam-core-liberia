'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from '../icons/Logo';

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

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
        aria-label={sidebarOpen ? '사이드바 메뉴' : undefined}
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
          <Link
            href="/dashboard"
            className={pathname === '/dashboard' ? 'active' : ''}
            onClick={() => setSidebarOpen(false)}
          >
            <span>대시보드</span>
          </Link>
          <Link
            href="/admins"
            className={pathname?.startsWith('/admins') ? 'active' : ''}
            onClick={() => setSidebarOpen(false)}
          >
            <span>관리자</span>
          </Link>
          <Link
            href="/users"
            className={pathname?.startsWith('/users') ? 'active' : ''}
            onClick={() => setSidebarOpen(false)}
          >
            <span>참가자</span>
          </Link>
          <Link
            href="/events"
            className={pathname?.startsWith('/events') ? 'active' : ''}
            onClick={() => setSidebarOpen(false)}
          >
            <span>이벤트</span>
          </Link>
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
            aria-label="메뉴 열기"
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
            <div className="badge badge--brand">System Admin</div>
            <button className="btn btn--secondary btn--sm">로그아웃</button>
          </div>
        </header>

        {/* Main */}
        <main className="shell__main overflow-auto">{children}</main>
      </div>
    </div>
  );
}
