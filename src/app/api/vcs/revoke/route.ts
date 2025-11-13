import type { NextRequest } from 'next/server';
import { getVCDatabaseService } from '@/services/vc.db.service';
import { apiOk, apiError } from '@/lib/api-response';
import { getSystemAdminWallet } from '@/services/system-init.service';
import { requireRole } from '@/lib/auth-middleware';
import { AdminRole } from '@/server/db/entities/Admin';

/**
 * POST /api/vcs/revoke
 * VC 온체인 폐기
 *
 * Authentication: Requires SYSTEM_ADMIN role (폐기는 민감한 작업이므로 최고 권한만)
 *
 * Request Body:
 * - vcId: string (required) - 폐기할 VC ID
 * - reason: string (optional) - 폐기 사유
 *
 * Response:
 * - vcId: string - 폐기된 VC ID
 * - status: string - "REVOKED"
 * - txHash: string - 블록체인 트랜잭션 해시
 * - revokedAt: string - 폐기 시각 (ISO 8601)
 */
export async function POST(request: NextRequest) {
  // 🔒 Authentication: Only SYSTEM_ADMIN can revoke VCs
  // (VC 폐기는 민감한 작업이므로 최고 권한만 허용)
  const authCheck = await requireRole(AdminRole.SYSTEM_ADMIN);
  if (authCheck) return authCheck;

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.vcId) {
      return apiError('Missing required field: vcId', 400, 'VALIDATION_ERROR');
    }

    const vcService = getVCDatabaseService();

    // Get System Admin wallet for issuer private key
    const issuerWallet = getSystemAdminWallet();

    // Revoke VC
    const result = await vcService.revokeVC({
      vcId: body.vcId,
      reason: body.reason,
      issuerPrivateKey: issuerWallet.privateKey,
    });

    return apiOk(result);
  } catch (error) {
    console.error('Error in POST /api/vcs/revoke:', error);

    // Handle not found error
    if (error instanceof Error && error.message.includes('not found')) {
      return apiError(error.message, 404, 'NOT_FOUND');
    }

    // Handle already revoked error
    if (error instanceof Error && error.message.includes('already revoked')) {
      return apiError(error.message, 409, 'CONFLICT');
    }

    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
