import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireRole } from '@/lib/auth-middleware';
import { apiOk, apiError } from '@/lib/api-response';
import { AdminRole } from '@/server/db/entities/Admin';
import { AppDataSource } from '@/server/db/datasource';
import { Admin } from '@/server/db/entities/Admin';
import { EventStaff } from '@/server/db/entities/EventStaff';
import { blockchainService } from '@/services/blockchain.service';
import { getSystemAdminWallet } from '@/services/system-init.service';

/**
 * DELETE /api/admin/events/[eventId]/staff/[adminId]
 * Remove staff from event (SYSTEM_ADMIN only)
 *
 * Response:
 * - success: true
 */
export async function DELETE(_request: NextRequest, { params }: { params: { eventId: string; adminId: string } }) {
  const authCheck = await requireRole(AdminRole.SYSTEM_ADMIN);
  if (authCheck) return authCheck;

  try {
    // 0) DB 선검사: 이벤트/관리자/배정 확인
    const event = await adminService.getEventByEventId(params.eventId);
    if (!event) return apiError('Event not found', 404, 'NOT_FOUND');
    if (!event.eventContractAddress) return apiError('Event contract not deployed', 409, 'CONFLICT');

    if (!AppDataSource.isInitialized) await AppDataSource.initialize();
    const adminRepo = AppDataSource.getRepository(Admin);
    const staffRepo = AppDataSource.getRepository(EventStaff);

    const admin = await adminRepo.findOne({ where: { adminId: params.adminId } });
    if (!admin) return apiError('Admin not found', 404, 'NOT_FOUND');
    if (!admin.walletAddress)
      return apiError('Admin is not activated (missing walletAddress)', 400, 'VALIDATION_ERROR');

    const staff = await staffRepo.findOne({ where: { eventId: params.eventId, adminId: params.adminId } });
    if (!staff) return apiError('Staff assignment not found', 404, 'NOT_FOUND');

    // 1) 온체인 역할 해제 (revokeRole). 실패 시 DB는 변경하지 않음
    const wallet = getSystemAdminWallet();
    const roleKey = staff.eventRole === 'APPROVER' ? 'APPROVER' : 'VERIFIER';
    const txHash = await blockchainService.revokeEventRole(
      event.eventContractAddress,
      roleKey,
      admin.walletAddress,
      wallet.privateKey,
    );

    // 2) 온체인 성공 후 DB 삭제
    const removed = await adminService.removeStaff(params.eventId, params.adminId);
    if (!removed) return apiError('Failed to remove staff assignment', 500, 'INTERNAL_ERROR');

    return apiOk({ success: true, onChainTxHash: txHash });
  } catch (error) {
    console.error('Error in DELETE /api/admin/events/[eventId]/staff/[adminId]:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}

// PATCH 제거됨: 역할 변경은 지원하지 않음(드롭다운 UI 삭제)
