import type { NextRequest, NextResponse } from 'next/server';
import { getSession } from './auth';
import { apiError } from './api-response';
import type { AdminRole } from '@/server/db/entities/Admin';
import { AdminRole as AdminRoleEnum } from '@/server/db/entities/Admin';
import { AppDataSource } from '@/server/db/datasource';
import { EventStaff, EventStaffStatus } from '@/server/db/entities/EventStaff';
import type { EventRole } from '@/server/db/entities/EventStaff';

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

/**
 * Event-specific role-based authorization middleware
 * Checks if the current user has the required role for a specific event
 *
 * Usage:
 * ```typescript
 * export async function POST(request: NextRequest, { params }: { params: { eventId: string } }) {
 *   const authCheck = await requireEventRole(params.eventId, ['APPROVER']);
 *   if (authCheck) return authCheck;
 *   // Continue with authorized logic
 * }
 * ```
 *
 * Permission logic:
 * - SYSTEM_ADMIN: Always allowed (bypasses event role check)
 * - Other roles: Must have active EventStaff assignment with required role
 */
export async function requireEventRole(
  eventId: string,
  requiredRoles: EventRole | EventRole[],
): Promise<NextResponse | null> {
  const session = await getSession();

  if (!session.isLoggedIn) {
    return apiError('Unauthorized', 401, 'UNAUTHORIZED');
  }

  // SYSTEM_ADMIN bypasses event role check
  if (session.role === AdminRoleEnum.SYSTEM_ADMIN) {
    return null;
  }

  // Initialize database if needed
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const eventStaffRepository = AppDataSource.getRepository(EventStaff);

  // Check if user has active staff assignment for this event
  const staffAssignment = await eventStaffRepository.findOne({
    where: {
      eventId,
      adminId: session.adminId,
      status: EventStaffStatus.ACTIVE,
    },
  });

  if (!staffAssignment) {
    return apiError('Forbidden: You are not assigned to this event', 403, 'FORBIDDEN');
  }

  // Check if user has required role
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

  if (!roles.includes(staffAssignment.eventRole)) {
    return apiError(`Forbidden: Requires ${roles.join(' or ')} role for this event`, 403, 'FORBIDDEN');
  }

  return null;
}
