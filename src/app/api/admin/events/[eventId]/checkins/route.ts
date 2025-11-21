import type { NextRequest } from 'next/server';
import { requireEventRole } from '@/lib/auth-middleware';
import { apiOk, apiError } from '@/lib/api-response';
import { EventRole } from '@/server/db/entities/EventStaff';
import { AppDataSource } from '@/server/db/datasource';
import { EventCheckin } from '@/server/db/entities/EventCheckin';
import { User } from '@/server/db/entities/User';
import { Admin } from '@/server/db/entities/Admin';
import { DidDocument, DIDType } from '@/server/db/entities/DidDocument';

/**
 * GET /api/admin/events/[eventId]/checkins
 * Get event check-in list with participant and admin info (SYSTEM_ADMIN, APPROVER, VERIFIER)
 *
 * Response:
 * - checkins: Array<{
 *     checkinId, userId, checkedInAt, checkinTxHash,
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

    const repo = AppDataSource.getRepository(EventCheckin);

    const rows = await repo
      .createQueryBuilder('c')
      .leftJoin(User, 'u', 'u.user_id = c.user_id')
      .leftJoin(DidDocument, 'ud', 'ud.wallet_address = u.wallet_address AND ud.did_type = :userDidType', {
        userDidType: DIDType.USER,
      })
      .leftJoin(Admin, 'a', 'a.admin_id = c.checked_in_by_admin_id')
      .select([
        'c.checkin_id AS checkinId',
        'c.user_id AS userId',
        'c.checked_in_at AS checkedInAt',
        'c.checkin_tx_hash AS checkinTxHash',
        'u.name AS userName',
        'ud.did AS userDid',
        'a.full_name AS adminFullName',
        'a.did AS adminDid',
      ])
      .where('c.event_id = :eventId', { eventId: params.eventId })
      .orderBy('c.checked_in_at', 'DESC')
      .getRawMany();

    return apiOk({ checkins: rows });
  } catch (error) {
    console.error('Error in GET /api/admin/events/[eventId]/checkins:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
