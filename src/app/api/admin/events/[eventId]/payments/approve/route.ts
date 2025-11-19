import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireEventRole } from '@/lib/auth-middleware';
import { getSession } from '@/lib/auth';
import { apiOk, apiError } from '@/lib/api-response';
import { EventRole } from '@/server/db/entities/EventStaff';
import { AppDataSource } from '@/server/db/datasource';
import { Event } from '@/server/db/entities/Event';
import { EventCheckin } from '@/server/db/entities/EventCheckin';
import { User } from '@/server/db/entities/User';
import { Admin } from '@/server/db/entities/Admin';
import { blockchainService } from '@/services/blockchain.service';
import { getSystemAdminWallet } from '@/services/system-init.service';

/**
 * POST /api/admin/events/[eventId]/payments/approve
 * Approve payment (2차 승인) (APPROVER only)
 *
 * Request Body:
 * - checkinId: Check-in UUID (event_checkins.checkin_id)
 *
 * Response:
 * - payment: EventPayment object
 */
export async function POST(request: NextRequest, { params }: { params: { eventId: string } }) {
  const authCheck = await requireEventRole(params.eventId, EventRole.APPROVER);
  if (authCheck) return authCheck;

  try {
    const body = await request.json();

    if (!body.checkinId || typeof body.checkinId !== 'string') {
      return apiError('Missing required field: checkinId', 400, 'VALIDATION_ERROR');
    }

    const session = await getSession();

    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const eventRepo = AppDataSource.getRepository(Event);
    const checkinRepo = AppDataSource.getRepository(EventCheckin);
    const userRepo = AppDataSource.getRepository(User);
    const adminRepo = AppDataSource.getRepository(Admin);

    // 1) 이벤트 로드 및 컨트랙트 주소 확인
    const event = await eventRepo.findOne({ where: { eventId: params.eventId } });
    if (!event) {
      return apiError('Event not found', 404, 'NOT_FOUND');
    }
    if (!event.eventContractAddress) {
      return apiError('Event contract not deployed', 409, 'CONFLICT');
    }

    // 2) 체크인 로드 (해당 이벤트의 체크인인지 확인)
    const checkin = await checkinRepo.findOne({
      where: { eventId: params.eventId, checkinId: body.checkinId },
    });
    if (!checkin) {
      return apiError('Check-in not found for this event', 404, 'NOT_FOUND');
    }

    // 3) 이미 지급된 체크인인지 확인 (idempotency)
    const existingPayments = await adminService.getEventPayments(params.eventId);
    const alreadyPaid = existingPayments.some((p) => p.checkinId === body.checkinId);
    if (alreadyPaid) {
      return apiError('Payment already recorded for this check-in', 409, 'CONFLICT');
    }

    // 4) 참가자 로드 및 지갑 주소 확인
    const user = await userRepo.findOne({ where: { userId: checkin.userId } });
    if (!user) {
      return apiError('User not found', 404, 'NOT_FOUND');
    }
    if (!user.walletAddress) {
      return apiError('User does not have a wallet address', 400, 'VALIDATION_ERROR');
    }

    // 5) Approver 관리자 로드 (on-chain approver 주소 결정)
    const admin = await adminRepo.findOne({ where: { adminId: session.adminId } });
    if (!admin) {
      return apiError('Admin not found', 404, 'NOT_FOUND');
    }
    if (!admin.walletAddress) {
      return apiError('Approver admin does not have an on-chain wallet address', 409, 'CONFLICT');
    }

    // 6) 온체인 결제 승인 (LiberiaEvent.approvePayment)
    if (!blockchainService.isAvailable()) {
      return apiError('Blockchain unavailable. Cannot approve payment on-chain.', 500, 'INTERNAL_ERROR');
    }

    const systemAdminWallet = getSystemAdminWallet();
    let paymentTxHash: string;
    try {
      paymentTxHash = await blockchainService.approveEventPayment(
        event.eventContractAddress,
        user.walletAddress,
        admin.walletAddress,
        systemAdminWallet.privateKey,
      );
    } catch (chainError) {
      console.error('Error approving payment on-chain:', chainError);
      return apiError(
        chainError instanceof Error ? chainError.message : 'Failed to approve payment on-chain',
        500,
        'INTERNAL_ERROR',
      );
    }

    // 7) 온체인 성공 후에만 DB 결제 기록
    const amount = String(event.amountPerDay ?? '0');
    const payment = await adminService.createPayment({
      eventId: params.eventId,
      userId: checkin.userId,
      checkinId: checkin.checkinId,
      amount,
      paymentTxHash,
      paidByAdminId: session.adminId,
    });

    return apiOk({ payment }, 201);
  } catch (error) {
    console.error('Error in POST /api/admin/events/[eventId]/payments/approve:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
