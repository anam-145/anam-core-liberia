import type { NextRequest } from 'next/server';
import { custodyService } from '@/services/custody.db.service';
import { apiOk, apiError } from '@/lib/api-response';

/**
 * GET /api/custody/wallets/phone/[phoneNumber]
 * Retrieve custody by phone number (for USSD users)
 */
export async function GET(request: NextRequest, { params }: { params: { phoneNumber: string } }) {
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
