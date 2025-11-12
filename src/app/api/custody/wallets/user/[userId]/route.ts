import type { NextRequest } from 'next/server';
import { custodyService } from '@/services/custody.db.service';
import { apiOk, apiError } from '@/lib/api-response';

/**
 * GET /api/custody/wallets/user/[userId]
 * Retrieve custody by user ID
 */
export async function GET(request: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const { userId } = params;

    const custody = await custodyService.getCustodyByUserId(userId);

    if (!custody) {
      return apiError('Custody not found for this user', 404, 'NOT_FOUND');
    }

    return apiOk(custody);
  } catch (error) {
    console.error('Error in GET /api/custody/wallets/user/[userId]:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
