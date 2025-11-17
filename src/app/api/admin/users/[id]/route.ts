import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireAuth, requireRole } from '@/lib/auth-middleware';
import { apiOk, apiError } from '@/lib/api-response';
import { AdminRole } from '@/server/db/entities/Admin';

/**
 * GET /api/admin/users/[id]
 * Get user by ID
 *
 * Response:
 * - user: User object
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const authCheck = await requireAuth(request);
  if (authCheck) return authCheck;

  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return apiError('Invalid user ID', 400, 'VALIDATION_ERROR');
    }

    const user = await adminService.getUserById(id);

    if (!user) {
      return apiError('User not found', 404, 'NOT_FOUND');
    }

    return apiOk({ user });
  } catch (error) {
    console.error('Error in GET /api/admin/users/[id]:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}

/**
 * PATCH /api/admin/users/[id]
 * Update user profile (Internal Service)
 *
 * Note: This endpoint is typically called by internal services.
 * For MVP, we allow SYSTEM_ADMIN access.
 *
 * Request Body:
 * - name?: string
 * - email?: string
 * - gender?: string
 * - dateOfBirth?: Date
 * - nationality?: string
 * - address?: string
 * - userStatus?: string
 *
 * Response:
 * - user: Updated user object
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const authCheck = await requireRole(AdminRole.SYSTEM_ADMIN);
  if (authCheck) return authCheck;

  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return apiError('Invalid user ID', 400, 'VALIDATION_ERROR');
    }

    const body = await request.json();

    const user = await adminService.updateUser(id, {
      name: body.name,
      email: body.email,
      gender: body.gender,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
      nationality: body.nationality,
      address: body.address,
    });

    if (!user) {
      return apiError('User not found', 404, 'NOT_FOUND');
    }

    return apiOk({ user });
  } catch (error) {
    console.error('Error in PATCH /api/admin/users/[id]:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
