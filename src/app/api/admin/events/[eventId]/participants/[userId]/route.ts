import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireEventRole } from '@/lib/auth-middleware';
import { apiOk, apiError } from '@/lib/api-response';
import { EventRole } from '@/server/db/entities/EventStaff';

/**
 * DELETE /api/admin/events/[eventId]/participants/[userId]
 * Remove participant from event (SYSTEM_ADMIN, APPROVER)
 *
 * Response:
 * - success: true
 */
export async function DELETE(_request: NextRequest, { params }: { params: { eventId: string; userId: string } }) {
  const authCheck = await requireEventRole(params.eventId, EventRole.APPROVER);
  if (authCheck) return authCheck;

  try {
    const removed = await adminService.removeParticipant(params.eventId, params.userId);

    if (!removed) {
      return apiError('Participant not found', 404, 'NOT_FOUND');
    }

    return apiOk({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/admin/events/[eventId]/participants/[userId]:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
