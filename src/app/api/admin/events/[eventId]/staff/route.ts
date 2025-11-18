import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireRole, requireEventRole } from '@/lib/auth-middleware';
import { EventRole as EventRoleEnum } from '@/server/db/entities/EventStaff';
import { apiOk, apiError } from '@/lib/api-response';
import { AdminRole } from '@/server/db/entities/Admin';
import { EventRole } from '@/server/db/entities/EventStaff';
import { blockchainService } from '@/services/blockchain.service';
import { getSystemAdminWallet } from '@/services/system-init.service';
import { AppDataSource } from '@/server/db/datasource';
import { Admin } from '@/server/db/entities/Admin';
import { EventStaff as EventStaffEntity } from '@/server/db/entities/EventStaff';

/**
 * POST /api/admin/events/[eventId]/staff
 * Assign staff to event (SYSTEM_ADMIN only)
 *
 * Request Body:
 * - adminId: Admin UUID
 * - eventRole: 'APPROVER' | 'VERIFIER'
 *
 * Response:
 * - staff: EventStaff object
 */
export async function POST(request: NextRequest, { params }: { params: { eventId: string } }) {
  const authCheck = await requireRole(AdminRole.SYSTEM_ADMIN);
  if (authCheck) return authCheck;

  try {
    const body = await request.json();

    if (!body.adminId || !body.eventRole) {
      return apiError('Missing required fields: adminId, eventRole', 400, 'VALIDATION_ERROR');
    }

    // Validate eventRole
    if (!Object.values(EventRole).includes(body.eventRole)) {
      return apiError('Invalid eventRole. Must be APPROVER or VERIFIER', 400, 'VALIDATION_ERROR');
    }

    // 0) Fast DB pre-check to avoid unnecessary on-chain calls
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    const staffRepo = AppDataSource.getRepository(EventStaffEntity);
    const exists = await staffRepo.findOne({ where: { eventId: params.eventId, adminId: body.adminId } });
    if (exists) {
      return apiError('Admin already assigned to this event', 409, 'CONFLICT');
    }

    // 1) Load event to get deployed contract address
    const event = await adminService.getEventByEventId(params.eventId);
    if (!event) {
      return apiError('Event not found', 404, 'NOT_FOUND');
    }
    if (!event.eventContractAddress) {
      return apiError('Event contract not deployed', 409, 'CONFLICT');
    }

    // 2) Load admin to obtain wallet address to grant role to
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    const adminRepo = AppDataSource.getRepository(Admin);
    const admin = await adminRepo.findOne({ where: { adminId: body.adminId } });
    if (!admin) {
      return apiError('Admin not found', 404, 'NOT_FOUND');
    }
    if (!admin.walletAddress) {
      return apiError('Admin is not activated (missing walletAddress)', 400, 'VALIDATION_ERROR');
    }

    // 3) Grant on-chain role first (must succeed before DB assignment)
    const issuer = getSystemAdminWallet();
    const roleKey = body.eventRole === EventRole.APPROVER ? 'APPROVER' : 'VERIFIER';
    const txHash = await blockchainService.grantEventRole(
      event.eventContractAddress,
      roleKey,
      admin.walletAddress,
      issuer.privateKey,
    );

    // 4) Persist staff assignment in DB only after successful on-chain grant
    const staff = await adminService.assignStaff({
      eventId: params.eventId,
      adminId: body.adminId,
      eventRole: body.eventRole,
    });

    return apiOk({ staff, onChainTxHash: txHash }, 201);
  } catch (error) {
    console.error('Error in POST /api/admin/events/[eventId]/staff:', error);
    if (error instanceof Error && error.message.includes('already assigned')) {
      return apiError(error.message, 409, 'CONFLICT');
    }
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}

/**
 * GET /api/admin/events/[eventId]/staff
 * Access: APPROVER only (event-scoped)
 * Get event staff list
 *
 * Note: Only APPROVER can view staff assignments for an event.
 * VERIFIER cannot view staff list.
 *
 * Response:
 * - staff: EventStaff[]
 */
export async function GET(_request: NextRequest, { params }: { params: { eventId: string } }) {
  const authCheck = await requireEventRole(params.eventId, EventRoleEnum.APPROVER);
  if (authCheck) return authCheck;

  try {
    const staff = await adminService.getEventStaff(params.eventId);
    return apiOk({ staff });
  } catch (error) {
    console.error('Error in GET /api/admin/events/[eventId]/staff:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
