import type { NextRequest } from 'next/server';
import { custodyService } from '@/services/custody.db.service';
import { apiOk, apiError } from '@/lib/api-response';
import { requireRole } from '@/lib/auth-middleware';
import { AdminRole } from '@/server/db/entities/Admin';

/**
 * GET /api/custody/wallets/phone/[phoneNumber]
 * Retrieve custody by phone number (for USSD users)
 *
 * Authentication: Requires SYSTEM_ADMIN role (민감한 정보 조회)
 */
export async function GET(request: NextRequest, { params }: { params: { phoneNumber: string } }) {
  // 🔒 Authentication: Only SYSTEM_ADMIN can view custody data
  const authCheck = await requireRole(AdminRole.SYSTEM_ADMIN);
  if (authCheck) return authCheck;

  try {
    const { phoneNumber } = params;

    // Decode URL-encoded phone number (e.g., %2B231... → +231...)
    const decodedPhone = decodeURIComponent(phoneNumber);

    const custody = await custodyService.getCustodyByPhone(decodedPhone);

    if (!custody) {
      return apiError('Custody not found for this phone number', 404, 'NOT_FOUND');
    }

    return apiOk(custody);
  } catch (error) {
    console.error('Error in GET /api/custody/wallets/phone/[phoneNumber]:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
