import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireEventRole } from '@/lib/auth-middleware';
import { getSession } from '@/lib/auth';
import { apiOk, apiError } from '@/lib/api-response';
import { EventRole } from '@/server/db/entities/EventStaff';

/**
 * POST /api/admin/events/[eventId]/checkins/approve
 * Approve check-in (VERIFIER only)
 *
 * Request Body:
 * - userId: User UUID
 *
 * Response:
 * - checkin: EventCheckin object
 */
export async function POST(request: NextRequest, { params }: { params: { eventId: string } }) {
  const authCheck = await requireEventRole(params.eventId, [EventRole.APPROVER, EventRole.VERIFIER]);
  if (authCheck) return authCheck;

  try {
    const body = await request.json();

    if (!body.userId) {
      return apiError('Missing required field: userId', 400, 'VALIDATION_ERROR');
    }

    const session = await getSession();

    // TODO: Blockchain Integration - Record Check-in on-chain
    // 향후 구현:
    //   1. VP(Verifiable Presentation) 검증 및 Verifier DID 서명 확인
    //   2. LiberiaEvent 컨트랙트에 체크인 기록
    //   3. 생성된 트랜잭션 해시를 checkinTxHash에 저장

    const checkin = await adminService.checkInParticipant({
      eventId: params.eventId,
      userId: body.userId,
      checkedInByAdminId: session.adminId,
      checkinTxHash: null,
    });

    return apiOk({ checkin }, 201);
  } catch (error) {
    console.error('Error in POST /api/admin/events/[eventId]/checkins/approve:', error);
    if (error instanceof Error && error.message.includes('already checked in')) {
      return apiError(error.message, 409, 'CONFLICT');
    }
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
