import type { NextRequest } from 'next/server';
import { requireEventRole } from '@/lib/auth-middleware';
import { apiOk, apiError } from '@/lib/api-response';
import { EventRole } from '@/server/db/entities/EventStaff';
import { AppDataSource } from '@/server/db/datasource';
import { EventPayment } from '@/server/db/entities/EventPayment';
import { User } from '@/server/db/entities/User';
import { Admin } from '@/server/db/entities/Admin';
import { DidDocument, DIDType } from '@/server/db/entities/DidDocument';

/**
 * GET /api/admin/events/[eventId]/payments
 * Get event payments list with participant and admin info (SYSTEM_ADMIN, APPROVER, VERIFIER)
 *
 * Response:
 * - payments: Array<{
 *     id, userId, amount, paidAt, paymentTxHash,
 *     userName, userDid,
 *     adminFullName, adminDid
 *   }>
 */
export async function GET(_request: NextRequest, { params }: { params: { eventId: string } }) {
  const authCheck = await requireEventRole(params.eventId, [EventRole.APPROVER, EventRole.VERIFIER]);
  if (authCheck) return authCheck;

  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const repo = AppDataSource.getRepository(EventPayment);

    const rows = await repo
      .createQueryBuilder('p')
      .leftJoin(User, 'u', 'u.user_id = p.user_id')
      .leftJoin(DidDocument, 'ud', 'ud.wallet_address = u.wallet_address AND ud.did_type = :userDidType', {
        userDidType: DIDType.USER,
      })
      .leftJoin(Admin, 'a', 'a.admin_id = p.paid_by_admin_id')
      .select([
        'p.id AS id',
        'p.user_id AS userId',
        'p.amount AS amount',
        'p.paid_at AS paidAt',
        'p.payment_tx_hash AS paymentTxHash',
        'u.name AS userName',
        'ud.did AS userDid',
        'a.full_name AS adminFullName',
        'a.did AS adminDid',
      ])
      .where('p.event_id = :eventId', { eventId: params.eventId })
      .orderBy('p.paid_at', 'DESC')
      .getRawMany();

    return apiOk({ payments: rows });
  } catch (error) {
    console.error('Error in GET /api/admin/events/[eventId]/payments:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
