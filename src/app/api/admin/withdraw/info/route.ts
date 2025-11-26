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

    // Format phone number for display (e.g., +231886145145 → 886-145-145)
    const rawPhone = process.env.WITHDRAW_SERVICE_PHONE || '+231886145145';
    const displayPhone = rawPhone.replace('+231', '').replace(/(\d{3})(\d{3})(\d{3})/, '$1-$2-$3');

    const cashOutInfo = {
      phoneNumber: displayPhone,
      walletAddress: process.env.WITHDRAW_SERVICE_WALLET || '0x7e18A2F632c3ea170706922548586C5899183d79',
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
