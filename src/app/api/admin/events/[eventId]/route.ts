import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireAuth } from '@/lib/auth-middleware';
import { apiOk, apiError } from '@/lib/api-response';
import type { EventStatus } from '@/server/db/entities/Event';

/**
 * GET /api/admin/events/[eventId]
 * Get event by ID
 */
export async function GET(_request: NextRequest, { params }: { params: { eventId: string } }) {
  const authCheck = await requireAuth(_request);
  if (authCheck) return authCheck;

  try {
    const id = parseInt(params.eventId);
    if (isNaN(id)) {
      return apiError('Invalid event ID', 400, 'VALIDATION_ERROR');
    }

    const event = await adminService.getEventById(id);

    if (!event) {
      return apiError('Event not found', 404, 'NOT_FOUND');
    }

    return apiOk({ event });
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
  const authCheck = await requireAuth(request);
  if (authCheck) return authCheck;

  try {
    const id = parseInt(params.eventId);
    if (isNaN(id)) {
      return apiError('Invalid event ID', 400, 'VALIDATION_ERROR');
    }

    const body = await request.json();

    const event = await adminService.updateEvent(id, {
      name: body.name,
      description: body.description,
      location: body.location,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      maxParticipants: body.maxParticipants,
      registrationDeadline: body.registrationDeadline ? new Date(body.registrationDeadline) : undefined,
      paymentRequired: body.paymentRequired,
      paymentAmount: body.paymentAmount,
      status: body.status as EventStatus | undefined,
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
