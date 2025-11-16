import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireEventRole } from '@/lib/auth-middleware';
import { getSession } from '@/lib/auth';
import { apiOk, apiError } from '@/lib/api-response';
import { EventRole } from '@/server/db/entities/EventStaff';
import { PaymentMethod } from '@/server/db/entities/EventPayment';

/**
 * POST /api/admin/events/[eventId]/payments/approve
 * Approve payment (2차 승인) (APPROVER only)
 *
 * Request Body:
 * - userId: User UUID
 * - amount: Payment amount
 * - transactionHash: Blockchain transaction hash
 *
 * Response:
 * - payment: EventPayment object
 */
export async function POST(request: NextRequest, { params }: { params: { eventId: string } }) {
  const authCheck = await requireEventRole(params.eventId, EventRole.APPROVER);
  if (authCheck) return authCheck;

  try {
    const body = await request.json();

    if (!body.userId || !body.amount || !body.transactionHash) {
      return apiError('Missing required fields: userId, amount, transactionHash', 400, 'VALIDATION_ERROR');
    }

    const session = await getSession();

    // TODO: Blockchain Integration - Execute Token Transfer
    // 설계서 요구사항 (system-design.md:2960-2977):
    // Request 원본:
    //   - checkinIds: array (승인할 체크인 ID 목록)
    // Response 원본:
    //   - paymentTxHash: 지급 트랜잭션 해시 (2차 승인)
    //   - status: COMPLETED
    //
    // 현재 구현: 데이터베이스에 payment 레코드만 생성
    // 구현 필요:
    //   1. Blockchain Service 연동
    //   2. checkinIds 기반으로 일괄 지급 처리
    //   3. 실제 USDC/토큰 블록체인 전송 (Event Contract 호출)
    //   4. 트랜잭션 해시를 payment 레코드에 저장
    //   5. DID 서명을 통한 부인 방지 (Approver의 개인키 서명)

    // Create payment record with COMPLETED status
    // Note: Using BANK_TRANSFER for blockchain payments in MVP
    const payment = await adminService.createPayment({
      eventId: params.eventId,
      userId: body.userId,
      amount: body.amount,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      transactionId: body.transactionHash,
    });

    // Immediately verify it
    const verifiedPayment = await adminService.verifyPayment(payment.id, session.adminId);

    return apiOk({ payment: verifiedPayment }, 201);
  } catch (error) {
    console.error('Error in POST /api/admin/events/[eventId]/payments/approve:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
