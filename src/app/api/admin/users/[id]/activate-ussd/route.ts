import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireRole } from '@/lib/auth-middleware';
import { apiOk, apiError } from '@/lib/api-response';
import { AdminRole } from '@/server/db/entities/Admin';

/**
 * POST /api/admin/users/[id]/activate-ussd
 * Activate USSD user (Internal Service)
 *
 * Note: This endpoint is typically called by internal services.
 * For MVP, we allow SYSTEM_ADMIN access.
 *
 * Response:
 * - user: Updated user object
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const authCheck = await requireRole(AdminRole.SYSTEM_ADMIN);
  if (authCheck) return authCheck;

  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return apiError('Invalid user ID', 400, 'VALIDATION_ERROR');
    }

    const user = await adminService.activateUssdUser(id);

    if (!user) {
      return apiError('User not found', 404, 'NOT_FOUND');
    }

    return apiOk({ user });
  } catch (error) {
    console.error('Error in POST /api/admin/users/[id]/activate-ussd:', error);
    if (error instanceof Error && error.message.includes('not a USSD wallet type')) {
      return apiError(error.message, 400, 'VALIDATION_ERROR');
    }
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
