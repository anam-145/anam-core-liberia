import type { NextRequest } from 'next/server';
import { custodyService } from '@/services/custody.db.service';
import { apiOk, apiError } from '@/lib/api-response';
import { requireRole } from '@/lib/auth-middleware';
import { AdminRole } from '@/server/db/entities/Admin';

/**
 * GET /api/custody/wallets/[custodyId]
 * Retrieve custody by custody ID
 *
 * Authentication: Requires SYSTEM_ADMIN role (민감한 정보 조회)
 */
export async function GET(request: NextRequest, { params }: { params: { custodyId: string } }) {
  // 🔒 Authentication: Only SYSTEM_ADMIN can view custody data
  const authCheck = await requireRole(AdminRole.SYSTEM_ADMIN);
  if (authCheck) return authCheck;

  try {
    const { custodyId } = params;

    const custody = await custodyService.getCustodyById(custodyId);

    if (!custody) {
      return apiError('Custody not found', 404, 'NOT_FOUND');
    }

    return apiOk(custody);
  } catch (error) {
    console.error('Error in GET /api/custody/wallets/[custodyId]:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}

/**
 * DELETE /api/custody/wallets/[custodyId]
 * Delete custody by custody ID
 *
 * Authentication: Requires SYSTEM_ADMIN role (민감한 작업)
 */
export async function DELETE(request: NextRequest, { params }: { params: { custodyId: string } }) {
  // 🔒 Authentication: Only SYSTEM_ADMIN can delete custody
  const authCheck = await requireRole(AdminRole.SYSTEM_ADMIN);
  if (authCheck) return authCheck;

  try {
    const { custodyId } = params;

    await custodyService.deleteCustody(custodyId);

    return apiOk({ message: 'Custody deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/custody/wallets/[custodyId]:', error);

    // Handle not found error
    if (error instanceof Error && error.message.includes('not found')) {
      return apiError(error.message, 404, 'NOT_FOUND');
    }

    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
