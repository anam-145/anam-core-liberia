import type { NextRequest } from 'next/server';
import { apiOk, apiError } from '@/lib/api-response';
import { AppDataSource } from '@/server/db/datasource';
import { User, USSDStatus } from '@/server/db/entities/User';
import { Contract, JsonRpcProvider } from 'ethers';

/**
 * GET /api/ussd/balance
 * Get USDC balance for USSD user
 *
 * Query Parameters:
 * - phoneNumber: string (required)
 *
 * Response:
 * - balance: string (USDC amount, e.g., "100.50")
 * - walletAddress: string
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

    if (!user) {
      return apiError('User not found', 404, 'NOT_FOUND');
    }

    // Check if user is USSD ACTIVE
    if (user.ussdStatus !== USSDStatus.ACTIVE) {
      return apiError('User is not active', 400, 'VALIDATION_ERROR');
    }

    if (!user.walletAddress) {
      return apiError('User wallet not found', 404, 'NOT_FOUND');
    }

    // Get USDC balance from blockchain
    const rpcUrl = process.env.BASE_RPC_URL;
    const usdcAddress = process.env.BASE_USDC_ADDRESS;

    if (!rpcUrl || !usdcAddress) {
      return apiError('Blockchain configuration missing', 500, 'INTERNAL_ERROR');
    }

    const provider = new JsonRpcProvider(rpcUrl);
    const ERC20_ABI = ['function balanceOf(address owner) external view returns (uint256)'];
    const usdcContract = new Contract(usdcAddress, ERC20_ABI, provider);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const balanceRaw = (await (usdcContract as any).balanceOf(user.walletAddress)) as bigint;

    // Convert from 6 decimals to human readable
    const balance = (Number(balanceRaw) / 1_000_000).toFixed(2);

    console.log(`✅ Balance checked: ${phoneNumber} → ${user.walletAddress} (${balance} USDC)`);

    return apiOk({
      success: true,
      balance,
      walletAddress: user.walletAddress,
    });
  } catch (error) {
    console.error('Error in GET /api/ussd/balance:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
