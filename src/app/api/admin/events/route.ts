import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireAuth, requireRole } from '@/lib/auth-middleware';
import { getSession } from '@/lib/auth';
import { apiOk, apiError } from '@/lib/api-response';
import type { EventType, EventStatus } from '@/server/db/entities/Event';
import { AdminRole } from '@/server/db/entities/Admin';
import { randomUUID } from 'crypto';

/**
 * POST /api/admin/events
 * Create a new event (SYSTEM_ADMIN only)
 */
export async function POST(request: NextRequest) {
  const authCheck = await requireRole(AdminRole.SYSTEM_ADMIN);
  if (authCheck) return authCheck;

  try {
    const body = await request.json();

    // Validate required fields (MVP: tokenType/tokenAddress/amountPerDay required for blockchain)
    if (!body.name || !body.startDate || !body.endDate || !body.tokenType || !body.tokenAddress || !body.amountPerDay) {
      return apiError(
        'Missing required fields: name, startDate, endDate, tokenType, tokenAddress, amountPerDay',
        400,
        'VALIDATION_ERROR',
      );
    }

    const session = await getSession();

    const event = await adminService.createEvent(
      {
        eventId: randomUUID(),
        name: body.name,
        description: body.description,
        eventType: body.eventType as EventType,
        location: body.location,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        tokenType: body.tokenType,
        tokenAddress: body.tokenAddress,
        amountPerDay: body.amountPerDay,
        maxParticipants: body.maxParticipants,
        registrationDeadline: body.registrationDeadline ? new Date(body.registrationDeadline) : undefined,
        paymentRequired: body.paymentRequired || false,
        paymentAmount: body.paymentAmount,
      },
      session.adminId,
    );

    // TODO: Blockchain Integration - Deploy Event Smart Contract
    // 설계서 요구사항 (system-design.md:2448-2470):
    // 1. 이벤트 생성 시 스마트 컨트랙트를 블록체인에 배포
    // 2. Response에 다음 필드 추가 필요:
    //    - eventContractAddress: 배포된 컨트랙트 주소
    //    - deploymentTxHash: 배포 트랜잭션 해시
    // 구현 필요:
    //    - Blockchain Service 연동
    //    - Event 컨트랙트 배포 로직
    //    - 배포 결과를 event 레코드에 업데이트 (eventContractAddress, deploymentTxHash)

    return apiOk({ event }, 201);
  } catch (error) {
    console.error('Error in POST /api/admin/events:', error);
    if (error instanceof Error && error.message.includes('already exists')) {
      return apiError(error.message, 409, 'CONFLICT');
    }
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}

/**
 * GET /api/admin/events
 * List events with pagination and filters
 */
export async function GET(request: NextRequest) {
  const authCheck = await requireAuth(request);
  if (authCheck) return authCheck;

  try {
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status') as EventStatus | undefined;
    const eventType = searchParams.get('eventType') as EventType | undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined;

    const { events, total } = await adminService.getEvents({
      status,
      eventType,
      limit,
      offset,
    });

    return apiOk({ events, total });
  } catch (error) {
    console.error('Error in GET /api/admin/events:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
