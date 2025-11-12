import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireRole } from '@/lib/auth-middleware';
import { getSession } from '@/lib/auth';
import { apiOk, apiError } from '@/lib/api-response';
import { AdminRole } from '@/server/db/entities/Admin';

/**
 * POST /api/admin/events/[eventId]/checkins/approve
 * Approve check-in (VERIFIER only)
 *
 * Request Body:
 * - userId: User UUID
 * - vpData: Optional Verifiable Presentation data
 *
 * Response:
 * - checkin: EventCheckin object
 */
export async function POST(request: NextRequest, { params }: { params: { eventId: string } }) {
  const authCheck = await requireRole(AdminRole.VERIFIER);
  if (authCheck) return authCheck;

  try {
    const body = await request.json();

    if (!body.userId) {
      return apiError('Missing required field: userId', 400, 'VALIDATION_ERROR');
    }

    const session = await getSession();

    // TODO: Blockchain Integration - Record Check-in with DID Signature
    // 설계서 요구사항 (system-design.md:2047):
    // 체크인 최종 승인 시 블록체인에 기록
    // 구현 필요:
    //   1. Verifier DID 서명을 통한 부인 방지 (개인키 서명)
    //   2. VP (Verifiable Presentation) 검증
    //   3. 체크인 트랜잭션을 블록체인에 기록
    //   4. 트랜잭션 해시를 checkin 레코드에 저장

    const checkin = await adminService.checkInParticipant({
      eventId: params.eventId,
      userId: body.userId,
      checkedInBy: session.adminId,
      vpData: body.vpData,
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
