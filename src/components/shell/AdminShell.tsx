'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from '../icons/Logo';

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="shell">
      {/* Sidebar */}
      <aside className="shell__sidebar">
        <div className="brand">
          <Logo size={44} />
          <div className="brand__text">
            <div className="brand__title">ANAM Admin</div>
            <small>UNDP Liberia</small>
          </div>
        </div>
        <nav className="nav">
          <Link href="/dashboard" className={pathname === '/dashboard' ? 'active' : ''}>
            <span>대시보드</span>
          </Link>
          <Link href="/admins" className={pathname?.startsWith('/admins') ? 'active' : ''}>
            <span>관리자</span>
          </Link>
          <Link href="/users" className={pathname?.startsWith('/users') ? 'active' : ''}>
            <span>참가자</span>
          </Link>
          <Link href="/events" className={pathname?.startsWith('/events') ? 'active' : ''}>
            <span>이벤트</span>
          </Link>
        </nav>
      </aside>

      {/* Header */}
      <header className="shell__header">
        <div style={{ fontWeight: 700 }}>Admin Dashboard</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="badge badge--brand">System Admin</div>
          <button className="btn btn--secondary btn--sm">로그아웃</button>
        </div>
      </header>

      {/* Main */}
      <main className="shell__main">{children}</main>
    </div>
  );
}
