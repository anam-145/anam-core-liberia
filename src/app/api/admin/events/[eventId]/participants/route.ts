import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireEventRole } from '@/lib/auth-middleware';
import { apiOk, apiError } from '@/lib/api-response';
import { EventRole } from '@/server/db/entities/EventStaff';

/**
 * POST /api/admin/events/[eventId]/participants
 * Register participant for event (SYSTEM_ADMIN, APPROVER, VERIFIER)
 *
 * Request Body:
 * - userId: User UUID
 *
 * Response:
 * - participant: EventParticipant object
 */
export async function POST(request: NextRequest, { params }: { params: { eventId: string } }) {
  const authCheck = await requireEventRole(params.eventId, [EventRole.APPROVER, EventRole.VERIFIER]);
  if (authCheck) return authCheck;

  try {
    const body = await request.json();

    if (!body.userId) {
      return apiError('Missing required field: userId', 400, 'VALIDATION_ERROR');
    }

    const participant = await adminService.registerParticipant({
      eventId: params.eventId,
      userId: body.userId,
    });

    return apiOk({ participant }, 201);
  } catch (error) {
    console.error('Error in POST /api/admin/events/[eventId]/participants:', error);
    if (error instanceof Error && error.message.includes('already registered')) {
      return apiError(error.message, 409, 'CONFLICT');
    }
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}

/**
 * GET /api/admin/events/[eventId]/participants
 * Get event participants list (SYSTEM_ADMIN, APPROVER, VERIFIER)
 *
 * Response:
 * - participants: EventParticipant[]
 */
export async function GET(_request: NextRequest, { params }: { params: { eventId: string } }) {
  const authCheck = await requireEventRole(params.eventId, [EventRole.APPROVER, EventRole.VERIFIER]);
  if (authCheck) return authCheck;

  try {
    const participants = await adminService.getEventParticipants(params.eventId);
    return apiOk({ participants });
  } catch (error) {
    console.error('Error in GET /api/admin/events/[eventId]/participants:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
