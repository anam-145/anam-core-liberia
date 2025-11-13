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
 * - userId: string (required) - User ID
 * - walletType: 'ANAMWALLET' | 'USSD' | 'PAPER_VOUCHER' (required)
 * - phoneNumber: string (optional, required for USSD)
 * - vault: Vault (required) - Encrypted vault object
 * - isBackup: boolean (required) - Backup flag
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
    if (!body.userId || !body.walletType || !body.vault || body.isBackup === undefined) {
      return apiError('Missing required fields: userId, walletType, vault, isBackup', 400, 'VALIDATION_ERROR');
    }

    // Validate wallet type
    if (!['ANAMWALLET', 'USSD', 'PAPER_VOUCHER'].includes(body.walletType)) {
      return apiError('Invalid walletType. Must be ANAMWALLET, USSD, or PAPER_VOUCHER', 400, 'VALIDATION_ERROR');
    }

    // Validate USSD requirements
    if (body.walletType === 'USSD' && !body.phoneNumber) {
      return apiError('phoneNumber is required for USSD wallet type', 400, 'VALIDATION_ERROR');
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
      walletType: body.walletType,
      phoneNumber: body.phoneNumber,
      vault: body.vault,
      isBackup: body.isBackup,
    });

    return apiOk({ custodyId: result.custodyId }, 201);
  } catch (error) {
    console.error('Error in POST /api/custody/wallets:', error);

    // Handle duplicate phone number
    if (error instanceof Error && error.message.includes('already registered')) {
      return apiError(error.message, 409, 'CONFLICT');
    }

    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
