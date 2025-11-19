import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireEventRole } from '@/lib/auth-middleware';
import { apiOk, apiError } from '@/lib/api-response';
import { EventRole } from '@/server/db/entities/EventStaff';

/**
 * GET /api/admin/events/[eventId]/checkins
 * Get event check-in list (SYSTEM_ADMIN, APPROVER, VERIFIER)
 *
 * Response:
 * - checkins: EventCheckin[]
 */
export async function GET(_request: NextRequest, { params }: { params: { eventId: string } }) {
  const authCheck = await requireEventRole(params.eventId, [EventRole.APPROVER, EventRole.VERIFIER]);
  if (authCheck) return authCheck;

  try {
    const checkins = await adminService.getEventCheckins(params.eventId);
    return apiOk({ checkins });
  } catch (error) {
    console.error('Error in GET /api/admin/events/[eventId]/checkins:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
