import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireEventRole } from '@/lib/auth-middleware';
import { apiOk, apiError } from '@/lib/api-response';
import { EventRole } from '@/server/db/entities/EventStaff';

/**
 * POST /api/admin/events/[eventId]/checkins/verify
 * Verify user PIN/password (VERIFIER only)
 *
 * Request Body:
 * - userId: User UUID
 * - pin: User's 4-digit PIN
 * - challenge: Optional blockchain challenge
 *
 * Response:
 * - verified: boolean
 */
export async function POST(request: NextRequest, { params }: { params: { eventId: string } }) {
  const authCheck = await requireEventRole(params.eventId, EventRole.VERIFIER);
  if (authCheck) return authCheck;

  try {
    const body = await request.json();

    if (!body.userId || !body.pin) {
      return apiError('Missing required fields: userId, pin', 400, 'VALIDATION_ERROR');
    }

    const verified = await adminService.verifyUserForCheckin(body.userId, body.pin);

    if (!verified) {
      return apiError('Invalid PIN', 401, 'UNAUTHORIZED');
    }

    return apiOk({ verified: true });
  } catch (error) {
    console.error('Error in POST /api/admin/events/[eventId]/checkins/verify:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
