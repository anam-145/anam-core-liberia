'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const navItems = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/events', label: 'Events' },
  { href: '/payments', label: 'Payments' },
  { href: '/vcs', label: 'VCs' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-8">Admin Panel</h2>
          <nav>
            <ul className="space-y-2">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`block px-4 py-2 rounded-md transition-colors ${
                      pathname === item.href ? 'bg-gray-700 text-white' : 'hover:bg-gray-800'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 bg-gray-50">{children}</main>
    </div>
  );
}
