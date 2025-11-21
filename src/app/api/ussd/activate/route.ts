import type { NextRequest } from 'next/server';
import { apiOk, apiError } from '@/lib/api-response';
import { adminService } from '@/services/admin.service';

/**
 * POST /api/ussd/activate
 * Activate USSD user with PIN (External USSD Service)
 *
 * Request Body:
 * - phoneNumber: string (required)
 * - pin: string (required, 4-6 digits)
 *
 * Response:
 * - success: boolean
 * - walletAddress: string
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber, pin } = body;

    // Validation
    if (!phoneNumber) {
      return apiError('Phone number is required', 400, 'VALIDATION_ERROR');
    }

    if (!pin) {
      return apiError('PIN is required', 400, 'VALIDATION_ERROR');
    }

    // PIN format validation: 4-6 digits only
    if (!/^\d{4,6}$/.test(pin)) {
      return apiError('PIN must be 4-6 digits', 400, 'VALIDATION_ERROR');
    }

    // Activate USSD user with PIN
    const result = await adminService.activateUssdUserWithPin(phoneNumber, pin);

    return apiOk({
      success: true,
      walletAddress: result.walletAddress,
    });
  } catch (error) {
    console.error('Error in POST /api/ussd/activate:', error);

    if (error instanceof Error) {
      // Known error cases
      if (error.message.includes('not found')) {
        return apiError(error.message, 404, 'NOT_FOUND');
      }
      if (error.message.includes('not a USSD') || error.message.includes('not PENDING')) {
        return apiError(error.message, 400, 'VALIDATION_ERROR');
      }
      if (error.message.includes('already active')) {
        return apiError(error.message, 409, 'CONFLICT');
      }
    }

    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
