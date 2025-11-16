import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireEventRole } from '@/lib/auth-middleware';
import { apiOk, apiError } from '@/lib/api-response';
import { EventRole } from '@/server/db/entities/EventStaff';

/**
 * POST /api/admin/events/[eventId]/checkins/identify
 * Identify user by phone number (VERIFIER only)
 *
 * Request Body:
 * - phoneNumber: User's phone number
 *
 * Response:
 * - user: Partial user info (id, userId, name, phoneNumber)
 */
export async function POST(request: NextRequest, { params }: { params: { eventId: string } }) {
  const authCheck = await requireEventRole(params.eventId, EventRole.VERIFIER);
  if (authCheck) return authCheck;

  try {
    const body = await request.json();

    if (!body.phoneNumber) {
      return apiError('Missing required field: phoneNumber', 400, 'VALIDATION_ERROR');
    }

    const user = await adminService.identifyUserForCheckin(body.phoneNumber);

    if (!user) {
      return apiError('User not found or not KYC approved', 404, 'NOT_FOUND');
    }

    // Return only necessary user info for security
    return apiOk({
      user: {
        id: user.id,
        userId: user.userId,
        name: user.name,
        phoneNumber: user.phoneNumber,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/admin/events/[eventId]/checkins/identify:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
