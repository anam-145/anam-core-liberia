import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireRole } from '@/lib/auth-middleware';
import { getSession } from '@/lib/auth';
import { apiOk, apiError } from '@/lib/api-response';
import { AdminRole } from '@/server/db/entities/Admin';

/**
 * POST /api/admin/users/[id]/kyc/approve
 * Approve user KYC (APPROVER or SYSTEM_ADMIN only)
 *
 * Response:
 * - user: Updated user object
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authCheck = await requireRole([AdminRole.APPROVER, AdminRole.SYSTEM_ADMIN]);
  if (authCheck) return authCheck;

  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return apiError('Invalid user ID', 400, 'VALIDATION_ERROR');
    }

    const session = await getSession();
    const user = await adminService.approveKyc(id, session.adminId);

    if (!user) {
      return apiError('User not found', 404, 'NOT_FOUND');
    }

    return apiOk({ user });
  } catch (error) {
    console.error('Error in POST /api/admin/users/[id]/kyc/approve:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
