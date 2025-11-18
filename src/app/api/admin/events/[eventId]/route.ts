import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireRole } from '@/lib/auth-middleware';
import { apiOk, apiError } from '@/lib/api-response';
import type { EventStatus } from '@/server/db/entities/Event';
import { AdminRole } from '@/server/db/entities/Admin';

/**
 * GET /api/admin/events/[eventId]
 * Get event by ID
 */
export async function GET(_request: NextRequest, { params }: { params: { eventId: string } }) {
  const authCheck = await requireRole(AdminRole.SYSTEM_ADMIN);
  if (authCheck) return authCheck;

  try {
    const event = await adminService.getEventByEventId(params.eventId);

    if (!event) {
      return apiError('Event not found', 404, 'NOT_FOUND');
    }

    const now = new Date();
    const start = event.startDate as unknown as Date;
    const end = event.endDate as unknown as Date;
    const derivedStatus = now < start ? 'PENDING' : now > end ? 'COMPLETED' : 'ONGOING';
    return apiOk({ event: { ...event, derivedStatus } });
  } catch (error) {
    console.error('Error in GET /api/admin/events/[eventId]:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}

/**
 * PATCH /api/admin/events/[eventId]
 * Update event
 */
export async function PATCH(request: NextRequest, { params }: { params: { eventId: string } }) {
  const authCheck = await requireRole(AdminRole.SYSTEM_ADMIN);
  if (authCheck) return authCheck;

  try {
    const body = await request.json();

    const event = await adminService.updateEventByEventId(params.eventId, {
      name: body.name,
      description: body.description,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      maxParticipants: body.maxParticipants,
      status: body.status as EventStatus | undefined,
      isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
    });

    if (!event) {
      return apiError('Event not found', 404, 'NOT_FOUND');
    }

    return apiOk({ event });
  } catch (error) {
    console.error('Error in PATCH /api/admin/events/[eventId]:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
