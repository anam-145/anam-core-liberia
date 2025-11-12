import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireRole } from '@/lib/auth-middleware';
import { apiOk, apiError } from '@/lib/api-response';
import { AdminRole } from '@/server/db/entities/Admin';

/**
 * DELETE /api/admin/events/[eventId]/staff/[adminId]
 * Remove staff from event (SYSTEM_ADMIN only)
 *
 * Response:
 * - success: true
 */
export async function DELETE(_request: NextRequest, { params }: { params: { eventId: string; adminId: string } }) {
  const authCheck = await requireRole(AdminRole.SYSTEM_ADMIN);
  if (authCheck) return authCheck;

  try {
    const removed = await adminService.removeStaff(params.eventId, params.adminId);

    if (!removed) {
      return apiError('Staff assignment not found', 404, 'NOT_FOUND');
    }

    return apiOk({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/admin/events/[eventId]/staff/[adminId]:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
