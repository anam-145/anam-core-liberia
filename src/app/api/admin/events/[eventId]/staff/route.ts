import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireRole, requireEventRole } from '@/lib/auth-middleware';
import { EventRole as EventRoleEnum } from '@/server/db/entities/EventStaff';
import { apiOk, apiError } from '@/lib/api-response';
import { AdminRole } from '@/server/db/entities/Admin';
import { EventRole } from '@/server/db/entities/EventStaff';

/**
 * POST /api/admin/events/[eventId]/staff
 * Assign staff to event (SYSTEM_ADMIN only)
 *
 * Request Body:
 * - adminId: Admin UUID
 * - eventRole: 'APPROVER' | 'VERIFIER'
 *
 * Response:
 * - staff: EventStaff object
 */
export async function POST(request: NextRequest, { params }: { params: { eventId: string } }) {
  const authCheck = await requireRole(AdminRole.SYSTEM_ADMIN);
  if (authCheck) return authCheck;

  try {
    const body = await request.json();

    if (!body.adminId || !body.eventRole) {
      return apiError('Missing required fields: adminId, eventRole', 400, 'VALIDATION_ERROR');
    }

    // Validate eventRole
    if (!Object.values(EventRole).includes(body.eventRole)) {
      return apiError('Invalid eventRole. Must be APPROVER or VERIFIER', 400, 'VALIDATION_ERROR');
    }

    const staff = await adminService.assignStaff({
      eventId: params.eventId,
      adminId: body.adminId,
      eventRole: body.eventRole,
    });

    return apiOk({ staff }, 201);
  } catch (error) {
    console.error('Error in POST /api/admin/events/[eventId]/staff:', error);
    if (error instanceof Error && error.message.includes('already assigned')) {
      return apiError(error.message, 409, 'CONFLICT');
    }
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}

/**
 * GET /api/admin/events/[eventId]/staff
 * Get event staff list (SYSTEM_ADMIN, APPROVER)
 *
 * Response:
 * - staff: EventStaff[]
 */
export async function GET(_request: NextRequest, { params }: { params: { eventId: string } }) {
  const authCheck = await requireEventRole(params.eventId, EventRoleEnum.APPROVER);
  if (authCheck) return authCheck;

  try {
    const staff = await adminService.getEventStaff(params.eventId);
    return apiOk({ staff });
  } catch (error) {
    console.error('Error in GET /api/admin/events/[eventId]/staff:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
