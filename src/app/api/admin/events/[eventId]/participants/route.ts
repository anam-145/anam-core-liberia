import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireEventRole } from '@/lib/auth-middleware';
import { apiOk, apiError } from '@/lib/api-response';
import { EventRole } from '@/server/db/entities/EventStaff';
import { getSession } from '@/lib/auth';
import { AppDataSource } from '@/server/db/datasource';
import { User } from '@/server/db/entities/User';
import { Admin } from '@/server/db/entities/Admin';
import { EventParticipant } from '@/server/db/entities/EventParticipant';
import { DidDocument, DIDType } from '@/server/db/entities/DidDocument';
import { blockchainService } from '@/services/blockchain.service';
import { getSystemAdminWallet } from '@/services/system-init.service';

/**
 * POST /api/admin/events/[eventId]/participants
 * Register participant for event (SYSTEM_ADMIN, APPROVER, VERIFIER)
 *
 * Request Body:
 * - userId: User UUID
 *
 * Response:
 * - participant: EventParticipant object
 */
export async function POST(request: NextRequest, { params }: { params: { eventId: string } }) {
  const authCheck = await requireEventRole(params.eventId, [EventRole.APPROVER, EventRole.VERIFIER]);
  if (authCheck) return authCheck;

  try {
    // 현재 로그인한 관리자 정보 (누가 참가자를 등록했는지 추적용)
    const session = await getSession();
    console.log('[API] POST /api/admin/events/[eventId]/participants called', {
      eventId: params.eventId,
      adminId: session.adminId,
      role: session.role,
    });
    const body = await request.json();

    if (!body.userId) {
      return apiError('Missing required field: userId', 400, 'VALIDATION_ERROR');
    }
    console.log('[API] Participant registration request body', {
      userId: body.userId,
    });

    // 1) 이벤트 정보 로드 (온체인 컨트랙트 주소 필요)
    const event = await adminService.getEventByEventId(params.eventId);
    if (!event) {
      return apiError('Event not found', 404, 'NOT_FOUND');
    }
    if (!event.eventContractAddress) {
      return apiError('Event contract not deployed', 409, 'CONFLICT');
    }
    console.log('[API] Loaded event for participant registration', {
      eventId: params.eventId,
      eventContractAddress: event.eventContractAddress,
    });

    // 2) User 로드 및 참가자 후보 검증
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { userId: body.userId } });
    if (!user) {
      return apiError('User not found', 404, 'NOT_FOUND');
    }
    if (!user.isActive) {
      return apiError('User is not active', 409, 'CONFLICT');
    }
    if (!user.walletAddress) {
      return apiError('User does not have a wallet address', 400, 'VALIDATION_ERROR');
    }
    console.log('[API] Loaded user for participant registration', {
      userId: user.userId,
      walletAddress: user.walletAddress,
      isActive: user.isActive,
    });

    // 3-a) Check max participants constraint before calling blockchain
    const participantRepo = AppDataSource.getRepository(EventParticipant);
    const currentCount = await participantRepo.count({ where: { eventId: params.eventId } });
    if (currentCount >= event.maxParticipants) {
      return apiError('이벤트의 최대 참가자 수를 초과했습니다.', 409, 'CONFLICT');
    }

    // 3) 관리자 지갑을 참가자로 등록하지 않도록 방지
    //    (컨트랙트의 보안 규칙과 동일한 제약을 API 레벨에서도 미리 걸어줌)
    const adminRepo = AppDataSource.getRepository(Admin);
    const adminWithSameWallet = await adminRepo.findOne({ where: { walletAddress: user.walletAddress } });
    if (adminWithSameWallet) {
      return apiError('Admins cannot be registered as participants', 400, 'VALIDATION_ERROR');
    }

    // 4) 온체인 참가자 등록 (LiberiaEvent.registerParticipant)
    if (!blockchainService.isAvailable()) {
      return apiError('Blockchain unavailable. Cannot register participant on-chain.', 500, 'INTERNAL_ERROR');
    }

    const issuer = getSystemAdminWallet();
    const onChainTxHash = await blockchainService.registerEventParticipant(
      event.eventContractAddress,
      user.walletAddress,
      issuer.privateKey,
    );
    console.log('[API] On-chain participant registration success', {
      eventAddress: event.eventContractAddress,
      participantWallet: user.walletAddress,
      onChainTxHash,
    });

    // 5) 온체인 성공 후에만 DB에 참가자 등록
    const participant = await adminService.registerParticipant({
      eventId: params.eventId,
      userId: body.userId,
      assignedByAdminId: session.adminId,
    });

    return apiOk({ participant, onChainTxHash }, 201);
  } catch (error) {
    console.error('Error in POST /api/admin/events/[eventId]/participants:', error);
    if (error instanceof Error && error.message.includes('already registered')) {
      return apiError(error.message, 409, 'CONFLICT');
    }
    if (error instanceof Error && error.message.includes('Max participants reached')) {
      return apiError('이벤트의 최대 참가자 수를 초과했습니다.', 409, 'CONFLICT');
    }
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}

/**
 * GET /api/admin/events/[eventId]/participants
 * Get event participants list (SYSTEM_ADMIN, APPROVER, VERIFIER)
 *
 * Response:
 * - participants: Array<{
 *     id: number;
 *     eventId: string;
 *     userId: string;
 *     assignedAt: string;
 *     assignedByAdminId: string | null;
 *     name: string;
 *     walletAddress: string | null;
 *     isActive: boolean;
 *     userDid: string | null;
 *     adminDid: string | null;
 *   }>
 */
export async function GET(_request: NextRequest, { params }: { params: { eventId: string } }) {
  const authCheck = await requireEventRole(params.eventId, [EventRole.APPROVER, EventRole.VERIFIER]);
  if (authCheck) return authCheck;

  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const repo = AppDataSource.getRepository(EventParticipant);

    const rows = await repo
      .createQueryBuilder('p')
      .leftJoin(User, 'u', 'u.user_id = p.user_id')
      .leftJoin(DidDocument, 'd', 'd.wallet_address = u.wallet_address AND d.did_type = :didType', {
        didType: DIDType.USER,
      })
      .leftJoin(Admin, 'a', 'a.admin_id = p.assigned_by_admin_id')
      .select([
        'p.id AS id',
        'p.event_id AS eventId',
        'p.user_id AS userId',
        'p.assigned_at AS assignedAt',
        'p.assigned_by_admin_id AS assignedByAdminId',
        'u.name AS name',
        'u.wallet_address AS walletAddress',
        'u.is_active AS isActive',
        'd.did AS userDid',
        'a.did AS adminDid',
      ])
      .where('p.event_id = :eventId', { eventId: params.eventId })
      .orderBy('p.assigned_at', 'DESC')
      .getRawMany();

    return apiOk({ participants: rows });
  } catch (error) {
    console.error('Error in GET /api/admin/events/[eventId]/participants:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
