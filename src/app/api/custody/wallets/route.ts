import type { NextRequest } from 'next/server';
import { custodyService } from '@/services/custody.db.service';
import { apiOk, apiError } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth-middleware';

/**
 * POST /api/custody/wallets
 * Create and store custody wallet
 *
 * Authentication: Requires authentication (모든 로그인한 Admin 가능)
 *
 * Request Body:
 * - userId?: string - 사용자 ID (선택)
 * - adminId?: string - 관리자 ID (선택)
 *   → 둘 중 하나는 반드시 포함되어야 함
 * - walletType: 'ANAMWALLET' | 'USSD' | 'PAPER_VOUCHER' (required)
 * - vault: Vault (required) - Encrypted vault object
 *
 * Response:
 * - custodyId: string - Generated custody ID
 */
export async function POST(request: NextRequest) {
  // 🔒 Authentication: Internal API - requires authentication
  const authCheck = await requireAuth(request);
  if (authCheck) return authCheck;

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.userId && !body.adminId) {
      return apiError('Either userId or adminId is required', 400, 'VALIDATION_ERROR');
    }
    if (!body.walletType || !body.vault) {
      return apiError('Missing required fields: walletType, vault', 400, 'VALIDATION_ERROR');
    }

    // Validate wallet type
    if (!['ANAMWALLET', 'USSD', 'PAPER_VOUCHER'].includes(body.walletType)) {
      return apiError('Invalid walletType. Must be ANAMWALLET, USSD, or PAPER_VOUCHER', 400, 'VALIDATION_ERROR');
    }

    // Validate vault structure
    if (!body.vault.ciphertext || !body.vault.iv || !body.vault.salt || !body.vault.authTag) {
      return apiError(
        'Invalid vault structure. Required fields: ciphertext, iv, salt, authTag',
        400,
        'VALIDATION_ERROR',
      );
    }

    // Create custody
    const result = await custodyService.createCustody({
      userId: body.userId,
      adminId: body.adminId,
      walletType: body.walletType,
      vault: body.vault,
    });

    return apiOk({ custodyId: result.custodyId }, 201);
  } catch (error) {
    console.error('Error in POST /api/custody/wallets:', error);

    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
