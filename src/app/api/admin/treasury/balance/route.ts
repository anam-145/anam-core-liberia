import { apiOk, apiError } from '@/lib/api-response';
import { getSession } from '@/lib/auth';
import { getSystemAdminWallet } from '@/services/system-init.service';
import { ethers } from 'ethers';

/**
 * GET /api/admin/treasury/balance
 * Get System Admin wallet balances (USDC and ETH)
 *
 * Response:
 * - walletAddress: string
 * - usdcBalance: string (formatted with decimals)
 * - usdcBalanceRaw: string (raw value)
 * - ethBalance: string (formatted)
 * - ethBalanceRaw: string (raw wei value)
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

    // Get system admin wallet
    const systemWallet = getSystemAdminWallet();
    const walletAddress = systemWallet.address;

    // Initialize provider
    const provider = new ethers.JsonRpcProvider(
      process.env.BASE_RPC_URL,
      parseInt(process.env.BASE_CHAIN_ID || '84532'),
    );

    // Get ETH balance
    const ethBalanceWei = await provider.getBalance(walletAddress);
    const ethBalance = ethers.formatEther(ethBalanceWei);

    // Get USDC balance
    const USDC_ADDRESS = process.env.BASE_USDC_ADDRESS;
    if (!USDC_ADDRESS) {
      return apiError('USDC address not configured', 500, 'INTERNAL_ERROR');
    }

    const USDC_ABI = [
      'function balanceOf(address account) view returns (uint256)',
      'function decimals() view returns (uint8)',
    ];

    const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);

    // Get USDC balance (6 decimals)
    const usdcBalanceRaw = await usdcContract.balanceOf!(walletAddress);
    const usdcBalance = ethers.formatUnits(usdcBalanceRaw, 6);

    return apiOk({
      walletAddress,
      usdcBalance,
      usdcBalanceRaw: usdcBalanceRaw.toString(),
      ethBalance,
      ethBalanceRaw: ethBalanceWei.toString(),
      network: process.env.BASE_CHAIN_ID === '84532' ? 'Base Sepolia' : 'Base Mainnet',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in GET /api/admin/treasury/balance:', error);
    return apiError(error instanceof Error ? error.message : 'Failed to fetch balance', 500, 'INTERNAL_ERROR');
  }
}
