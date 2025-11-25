import { apiOk, apiError } from '@/lib/api-response';
import { getSession } from '@/lib/auth';

/**
 * GET /api/admin/cashout/info
 * Get cash-out service information for mobile money exchange
 *
 * Response:
 * - phoneNumber: Service phone number for receiving USDC
 * - walletAddress: Blockchain wallet address
 * - exchangeRate: Current USDC to LRD rate
 * - serviceFee: Service fee percentage
 * - minimumAmount: Minimum USDC amount
 * - maximumAmount: Maximum USDC amount
 * - supportedProviders: List of supported mobile money providers
 */
export async function GET() {
  try {
    // Check session - System Admin only
    const session = await getSession();
    if (!session.isLoggedIn) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED');
    }
    if (session.role !== 'SYSTEM_ADMIN') {
      return apiError('Forbidden: System Admin only', 403, 'FORBIDDEN');
    }

    // In production, these values would come from:
    // 1. Database configuration
    // 2. Real-time exchange rate API
    // 3. Partner API for service availability

    const cashOutInfo = {
      phoneNumber: process.env.CASHOUT_PHONE_NUMBER || '0886-123-456',
      walletAddress: process.env.CASHOUT_WALLET_ADDRESS || '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
      exchangeRate: 195.5, // 1 USDC = 195.50 LRD (would fetch from oracle/API)
      serviceFee: 2.5, // 2.5% fee
      minimumAmount: 5, // 5 USDC minimum
      maximumAmount: 500, // 500 USDC maximum per transaction
      supportedProviders: [
        {
          name: 'Orange Money',
          code: 'ORANGE',
          ussdCode: '*144#',
          active: true,
        },
        {
          name: 'MTN MoMo',
          code: 'MTN',
          ussdCode: '*156#',
          active: true,
        },
      ],
      serviceStatus: 'active', // active, maintenance, suspended
      lastUpdated: new Date().toISOString(),
    };

    return apiOk(cashOutInfo);
  } catch (error) {
    console.error('Error in GET /api/admin/cashout/info:', error);
    return apiError(error instanceof Error ? error.message : 'Failed to fetch cash-out info', 500, 'INTERNAL_ERROR');
  }
}
