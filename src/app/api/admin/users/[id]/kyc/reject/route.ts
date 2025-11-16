import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireRole } from '@/lib/auth-middleware';
import { apiOk, apiError } from '@/lib/api-response';
import { AdminRole } from '@/server/db/entities/Admin';

/**
 * POST /api/admin/users/[id]/kyc/reject
 * Reject user KYC (SYSTEM_ADMIN or STAFF)
 *
 * Response:
 * - user: Updated user object
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const authCheck = await requireRole([AdminRole.SYSTEM_ADMIN, AdminRole.STAFF]);
  if (authCheck) return authCheck;

  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return apiError('Invalid user ID', 400, 'VALIDATION_ERROR');
    }

    const user = await adminService.rejectKyc(id);

    if (!user) {
      return apiError('User not found', 404, 'NOT_FOUND');
    }

    return apiOk({ user });
  } catch (error) {
    console.error('Error in POST /api/admin/users/[id]/kyc/reject:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
