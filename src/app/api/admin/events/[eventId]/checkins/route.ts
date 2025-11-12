import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireRole } from '@/lib/auth-middleware';
import { apiOk, apiError } from '@/lib/api-response';
import { AdminRole } from '@/server/db/entities/Admin';

/**
 * GET /api/admin/events/[eventId]/checkins
 * Get event check-in list (SYSTEM_ADMIN, APPROVER, VERIFIER)
 *
 * Response:
 * - checkins: EventCheckin[]
 */
export async function GET(_request: NextRequest, { params }: { params: { eventId: string } }) {
  const authCheck = await requireRole([AdminRole.SYSTEM_ADMIN, AdminRole.APPROVER, AdminRole.VERIFIER]);
  if (authCheck) return authCheck;

  try {
    const checkins = await adminService.getEventCheckins(params.eventId);
    return apiOk({ checkins });
  } catch (error) {
    console.error('Error in GET /api/admin/events/[eventId]/checkins:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
