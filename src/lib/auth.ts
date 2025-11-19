import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import type { SessionData } from './session';
import { sessionOptions } from './session';
import type { AdminRole } from '@/server/db/entities/Admin';

/**
 * Get session from cookies
 * Use this in API routes and Server Components
 */
export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session.isLoggedIn === true;
}

/**
 * Check if user has required role
 */
export async function hasRole(requiredRole: AdminRole | AdminRole[]): Promise<boolean> {
  const session = await getSession();

  if (!session.isLoggedIn) {
    return false;
  }

  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  return roles.includes(session.role as AdminRole);
}

/**
 * Get current admin ID (UUID) from session
 */
export async function getCurrentAdminId(): Promise<string | null> {
  const session = await getSession();
  return session.isLoggedIn ? session.adminId : null;
}
