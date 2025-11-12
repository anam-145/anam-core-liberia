import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireRole } from '@/lib/auth-middleware';
import { apiOk, apiError } from '@/lib/api-response';
import { AdminRole } from '@/server/db/entities/Admin';

/**
 * GET /api/admin/events/[eventId]/payments
 * Get event payments list (SYSTEM_ADMIN, APPROVER, VERIFIER)
 *
 * Response:
 * - payments: EventPayment[]
 */
export async function GET(_request: NextRequest, { params }: { params: { eventId: string } }) {
  const authCheck = await requireRole([AdminRole.SYSTEM_ADMIN, AdminRole.APPROVER, AdminRole.VERIFIER]);
  if (authCheck) return authCheck;

  try {
    const payments = await adminService.getEventPayments(params.eventId);
    return apiOk({ payments });
  } catch (error) {
    console.error('Error in GET /api/admin/events/[eventId]/payments:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
