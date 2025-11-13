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
 * - vc: VerifiableCredential (required) - Verifiable Credential object
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
