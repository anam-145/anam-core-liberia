import type { NextRequest } from 'next/server';
import { custodyService } from '@/services/custody.db.service';
import { apiOk, apiError } from '@/lib/api-response';

/**
 * GET /api/custody/wallets/[custodyId]
 * Retrieve custody by custody ID
 */
export async function GET(request: NextRequest, { params }: { params: { custodyId: string } }) {
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
 */
export async function DELETE(_request: NextRequest, { params }: { params: { custodyId: string } }) {
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
