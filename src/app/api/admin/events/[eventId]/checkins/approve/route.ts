import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireEventRole } from '@/lib/auth-middleware';
import { getSession } from '@/lib/auth';
import { apiOk, apiError } from '@/lib/api-response';
import { EventRole } from '@/server/db/entities/EventStaff';
import { AppDataSource } from '@/server/db/datasource';
import { Event } from '@/server/db/entities/Event';
import { User } from '@/server/db/entities/User';
import { Admin, AdminRole } from '@/server/db/entities/Admin';
import { blockchainService } from '@/services/blockchain.service';
import { getSystemAdminWallet } from '@/services/system-init.service';
import { getVPSessionService } from '@/services/vp-session.memory.service';
import { createDID } from '@/utils/crypto/did';

/**
 * POST /api/admin/events/[eventId]/checkins/approve
 * Approve check-in (VERIFIER only)
 *
 * Request Body:
 * - userId: User UUID
 * - sessionId?: string (optional, for AnamWallet check-in polling)
 *
 * Response:
 * - checkin: EventCheckin object
 * - onChainTxHash?: string
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

    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const eventRepository = AppDataSource.getRepository(Event);
    const userRepository = AppDataSource.getRepository(User);
    const adminRepository = AppDataSource.getRepository(Admin);

    // 1) 이벤트 로드 및 컨트랙트 주소 확인
    const event = await eventRepository.findOne({ where: { eventId: params.eventId } });
    if (!event) {
      return apiError('Event not found', 404, 'NOT_FOUND');
    }

    if (!event.eventContractAddress) {
      return apiError('Event contract not deployed', 409, 'CONFLICT');
    }

    // 2) 사용자 로드 및 지갑 주소 확인
    const user = await userRepository.findOne({ where: { userId: body.userId } });
    if (!user) {
      return apiError('User not found', 404, 'NOT_FOUND');
    }

    if (!user.walletAddress) {
      return apiError('User does not have a wallet address', 400, 'VALIDATION_ERROR');
    }

    // 3) Verifier 주소 결정 (SYSTEM_ADMIN → 시스템 어드민 지갑, STAFF → 본인 지갑)
    const admin = await adminRepository.findOne({ where: { adminId: session.adminId } });
    if (!admin) {
      return apiError('Admin not found', 404, 'NOT_FOUND');
    }

    const systemAdminWallet = getSystemAdminWallet();
    const verifierAddress =
      admin.role === AdminRole.SYSTEM_ADMIN
        ? systemAdminWallet.address
        : (admin.walletAddress ?? systemAdminWallet.address);

    if (admin.role !== AdminRole.SYSTEM_ADMIN && !admin.walletAddress) {
      return apiError('Verifier admin does not have an on-chain wallet address', 409, 'CONFLICT');
    }

    // 4) 온체인 체크인 기록 (LiberiaEvent.verifyCheckIn)
    let onChainTxHash: string | null = null;
    if (!blockchainService.isAvailable()) {
      return apiError('Blockchain unavailable. Cannot record check-in on-chain.', 500, 'INTERNAL_ERROR');
    }

    try {
      onChainTxHash = await blockchainService.verifyEventCheckIn(
        event.eventContractAddress,
        user.walletAddress,
        verifierAddress,
        systemAdminWallet.privateKey,
      );
    } catch (chainError) {
      console.error('Error recording check-in on-chain:', chainError);
      return apiError(
        chainError instanceof Error ? chainError.message : 'Failed to record check-in on-chain',
        500,
        'INTERNAL_ERROR',
      );
    }

    // 5) 온체인 성공 후에만 DB 체크인 기록
    const checkin = await adminService.checkInParticipant({
      eventId: params.eventId,
      userId: body.userId,
      checkedInByAdminId: session.adminId,
      checkinTxHash: onChainTxHash,
    });

    // 6) AnamWallet 체크인인 경우 VP 세션 상태 업데이트 (polling용)
    if (body.sessionId && typeof body.sessionId === 'string') {
      try {
        const vpSessionService = getVPSessionService();
        const userDID = user.walletAddress ? createDID('user', user.walletAddress) : '';
        vpSessionService.updateStatus(body.sessionId, 'verified', {
          eventName: event.name,
          userName: user.name,
          userDID,
        });
        console.log('[checkins/approve] VP session status updated to verified', {
          sessionId: body.sessionId,
          userId: body.userId,
        });
      } catch (sessionError) {
        // Non-critical error - session might have expired or been consumed
        console.warn('[checkins/approve] Failed to update VP session status', {
          sessionId: body.sessionId,
          error: sessionError instanceof Error ? sessionError.message : 'Unknown error',
        });
      }
    }

    return apiOk({ checkin, onChainTxHash }, 201);
  } catch (error) {
    console.error('Error in POST /api/admin/events/[eventId]/checkins/approve:', error);
    if (error instanceof Error && error.message.includes('already checked in')) {
      return apiError(error.message, 409, 'CONFLICT');
    }
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
