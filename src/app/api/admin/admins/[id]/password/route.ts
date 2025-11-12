import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { getSession } from '@/lib/auth';
import { requireAuth } from '@/lib/auth-middleware';
import { apiOk, apiError } from '@/lib/api-response';

/**
 * POST /api/admin/admins/[id]/password
 * Change admin password (admin can only change their own password)
 *
 * Request Body:
 * - oldPassword: string (required)
 * - newPassword: string (required)
 *
 * Response:
 * - success: boolean
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authCheck = await requireAuth(request);
  if (authCheck) return authCheck;

  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return apiError('Invalid admin ID', 400, 'VALIDATION_ERROR');
    }

    // Get admin by id to check adminId
    const admin = await adminService.getAdminById(id);
    if (!admin) {
      return apiError('Admin not found', 404, 'NOT_FOUND');
    }

    // Check if admin is changing their own password
    const session = await getSession();
    if (session.adminId !== admin.adminId) {
      return apiError('You can only change your own password', 403, 'FORBIDDEN');
    }

    const body = await request.json();

    // Validate required fields
    if (!body.oldPassword || !body.newPassword) {
      return apiError('Missing required fields: oldPassword, newPassword', 400, 'VALIDATION_ERROR');
    }

    const success = await adminService.changePassword(id, body.oldPassword, body.newPassword);

    if (!success) {
      return apiError('Invalid old password', 400, 'VALIDATION_ERROR');
    }

    return apiOk({ success: true });
  } catch (error) {
    console.error('Error in POST /api/admin/admins/[id]/password:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
