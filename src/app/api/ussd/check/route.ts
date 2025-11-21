import type { NextRequest } from 'next/server';
import { apiOk, apiError } from '@/lib/api-response';
import { AppDataSource } from '@/server/db/datasource';
import { User, USSDStatus } from '@/server/db/entities/User';

/**
 * GET /api/ussd/check
 * Check if phone number is registered (First Time User check)
 *
 * Query Parameters:
 * - phoneNumber: string (required)
 *
 * Response:
 * - registered: boolean
 * - status?: 'PENDING' | 'ACTIVE' (if registered)
 * - name?: string (if registered)
 * - walletAddress?: string (if ACTIVE)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phoneNumber = searchParams.get('phoneNumber');

    // Validation
    if (!phoneNumber) {
      return apiError('Phone number is required', 400, 'VALIDATION_ERROR');
    }

    // Initialize database
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const userRepository = AppDataSource.getRepository(User);

    // Find user by phone number
    const user = await userRepository.findOne({
      where: { phoneNumber },
    });

    // Not registered
    if (!user) {
      return apiOk({ registered: false });
    }

    // Registered - check USSD status
    if (user.ussdStatus === USSDStatus.ACTIVE) {
      return apiOk({
        registered: true,
        status: 'ACTIVE',
        name: user.name,
        walletAddress: user.walletAddress,
      });
    }

    // Registered but PENDING
    if (user.ussdStatus === USSDStatus.PENDING) {
      return apiOk({
        registered: true,
        status: 'PENDING',
        name: user.name,
      });
    }

    // Registered but not USSD type (e.g., AnamWallet, Paper Voucher)
    return apiOk({
      registered: true,
      status: 'NOT_USSD',
      name: user.name,
    });
  } catch (error) {
    console.error('Error in GET /api/ussd/check:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
