import type { NextRequest } from 'next/server';
import { custodyService } from '@/services/custody.db.service';
import { apiOk, apiError } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth-middleware';

/**
 * PUT /api/custody/wallets/[custodyId]/vc
 * Add or update VC for existing custody
 *
 * Authentication: Requires authentication (모든 로그인한 Admin 가능)
 *
 * Request Body:
 * - vc: Encrypted VC vault (required)
 *   {
 *     id: string,               // VC ID (plain)
 *     ciphertext: string,       // base64
 *     iv: string,               // base64
 *     salt: string,             // base64
 *     authTag: string           // base64
 *   }
 *
 * Response:
 * - success: boolean
 * - custodyId: string
 */
export async function PUT(request: NextRequest, { params }: { params: { custodyId: string } }) {
  // 🔒 Authentication: Internal API - requires authentication
  const authCheck = await requireAuth(request);
  if (authCheck) return authCheck;

  try {
    const { custodyId } = params;
    const body = await request.json();

    // Validate required fields
    if (!body.vc) {
      return apiError('Missing required field: vc', 400, 'VALIDATION_ERROR');
    }

    // Validate encrypted VC structure
    const vc = body.vc as {
      id?: string;
      ciphertext?: string;
      iv?: string;
      salt?: string;
      authTag?: string;
    };
    const b64 = /^[A-Za-z0-9+/=]+$/;
    if (
      !vc.id ||
      !vc.ciphertext ||
      !b64.test(vc.ciphertext) ||
      !vc.iv ||
      !b64.test(vc.iv) ||
      !vc.salt ||
      !b64.test(vc.salt) ||
      !vc.authTag ||
      !b64.test(vc.authTag)
    ) {
      return apiError(
        'Invalid vc structure. Required: { id, ciphertext, iv, salt, authTag } (base64 fields)',
        400,
        'VALIDATION_ERROR',
      );
    }

    // Update VC
    await custodyService.updateVC(custodyId, { vc: body.vc });

    return apiOk({ custodyId });
  } catch (error) {
    console.error('Error in PUT /api/custody/wallets/[custodyId]/vc:', error);

    // Handle not found error
    if (error instanceof Error && error.message.includes('not found')) {
      return apiError(error.message, 404, 'NOT_FOUND');
    }

    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
