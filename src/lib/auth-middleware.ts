import type { NextRequest, NextResponse } from 'next/server';
import { getSession } from './auth';
import { apiError } from './api-response';
import type { AdminRole } from '@/server/db/entities/Admin';

/**
 * Authentication middleware for API routes
 * Usage:
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const authCheck = await requireAuth(request);
 *   if (authCheck) return authCheck;
 *   // Continue with authenticated logic
 * }
 * ```
 */
export async function requireAuth(_request: NextRequest): Promise<NextResponse | null> {
  const session = await getSession();

  if (!session.isLoggedIn) {
    return apiError('Unauthorized', 401, 'UNAUTHORIZED');
  }

  return null;
}

/**
 * Role-based authorization middleware
 * Usage:
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const authCheck = await requireRole(['SYSTEM_ADMIN', 'APPROVER']);
 *   if (authCheck) return authCheck;
 *   // Continue with authorized logic
 * }
 * ```
 */
export async function requireRole(requiredRole: AdminRole | AdminRole[]): Promise<NextResponse | null> {
  const session = await getSession();

  if (!session.isLoggedIn) {
    return apiError('Unauthorized', 401, 'UNAUTHORIZED');
  }

  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

  if (!roles.includes(session.role as AdminRole)) {
    return apiError('Forbidden: Insufficient permissions', 403, 'FORBIDDEN');
  }

  return null;
}

/**
 * Get session data or return error response
 * Usage:
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const result = await getSessionOrError();
 *   if ('error' in result) return result.error;
 *   const session = result.session;
 *   // Use session data
 * }
 * ```
 */
export async function getSessionOrError(): Promise<
  { session: Awaited<ReturnType<typeof getSession>>; error?: never } | { error: NextResponse; session?: never }
> {
  const session = await getSession();

  if (!session.isLoggedIn) {
    return { error: apiError('Unauthorized', 401, 'UNAUTHORIZED') };
  }

  return { session };
}
