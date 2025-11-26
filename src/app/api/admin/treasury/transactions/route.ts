import { apiOk, apiError } from '@/lib/api-response';
import { getSession } from '@/lib/auth';
import { getSystemAdminWallet } from '@/services/system-init.service';
import { ethers } from 'ethers';
import type { EtherscanTokenTransfer, TreasuryTransaction } from '@/types/treasury';

/**
 * Simple in-memory cache for Etherscan API responses
 * Reduces rate limit issues by caching for 30 seconds
 */
interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * GET /api/admin/treasury/transactions
 * Get USDC token transfer history for System Admin wallet
 *
 * Query params:
 * - limit: number of transactions to return (default 10, max 50)
 *
 * Response:
 * - transactions: Array of USDC transfer events
 */
export async function GET(request: Request) {
  try {
    // Check session - System Admin only
    const session = await getSession();
    if (!session.isLoggedIn) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED');
    }
    if (session.role !== 'SYSTEM_ADMIN') {
      return apiError('Forbidden: System Admin only', 403, 'FORBIDDEN');
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);

    // Get system admin wallet
    const systemWallet = getSystemAdminWallet();
    const walletAddress = systemWallet.address;

    // Note: Provider initialization removed as we're using Etherscan API instead of RPC
    // const provider = new ethers.JsonRpcProvider(...);

    const USDC_ADDRESS = process.env.BASE_USDC_ADDRESS;
    if (!USDC_ADDRESS) {
      return apiError('USDC address not configured', 500, 'INTERNAL_ERROR');
    }

    // USDC Contract ABI (only Transfer event) - kept for reference
    // const USDC_ABI = [
    //   'event Transfer(address indexed from, address indexed to, uint256 value)',
    // ];
    // Note: RPC-based contract interaction removed due to free tier limitations

    // Use Etherscan V2 API for fetching transaction history
    // Supports both Base Mainnet and Base Sepolia
    const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
    const chainId = process.env.BASE_CHAIN_ID || '84532';

    // API key is required
    if (!ETHERSCAN_API_KEY) {
      return apiError(
        'Etherscan API key not configured. Please set ETHERSCAN_API_KEY in environment variables.',
        500,
        'INTERNAL_ERROR',
      );
    }

    try {
      const networkName = chainId === '8453' ? 'Base Mainnet' : 'Base Sepolia';

      // Check cache first to avoid rate limiting
      const cacheKey = `treasury:${walletAddress}:${chainId}`;
      const cachedData = getCached<EtherscanTokenTransfer[]>(cacheKey);

      if (cachedData) {
        console.log('[Treasury] Returning cached data');
        const transactions: TreasuryTransaction[] = cachedData.slice(0, limit).map((tx) => ({
          txHash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: ethers.formatUnits(tx.value, 6),
          gasUsed: tx.gasUsed,
          gasPrice: tx.gasPrice ? ethers.formatUnits(tx.gasPrice, 'gwei') : '0',
          timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
          blockNumber: tx.blockNumber,
        }));

        return apiOk({
          walletAddress,
          transactions,
          network: networkName,
          usdcContract: USDC_ADDRESS,
          source: 'etherscan_v2',
          cached: true,
        });
      }

      // Etherscan V2 API - supports all EVM chains including Base
      const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=tokentx&contractaddress=${USDC_ADDRESS}&address=${walletAddress}&startblock=0&endblock=99999999&sort=desc&apikey=${ETHERSCAN_API_KEY}`;

      console.log('[Treasury] Fetching from Etherscan V2 API...');
      console.log('[Treasury] Wallet:', walletAddress);
      console.log('[Treasury] USDC Contract:', USDC_ADDRESS);
      console.log('[Treasury] Chain ID:', chainId);

      const response = await fetch(url);
      const data = await response.json();

      console.log('[Treasury] Etherscan response status:', data.status);
      console.log('[Treasury] Etherscan message:', data.message);

      // Check if result is an array (success) or string (error message)
      const isResultArray = Array.isArray(data.result);
      console.log('[Treasury] Result type:', isResultArray ? 'array' : typeof data.result);
      console.log('[Treasury] Result count:', isResultArray ? data.result.length : 'N/A (error)');

      // Handle "No transactions found" case (status="0", message="No transactions found", result=[])
      if (
        data.status === '0' &&
        data.message === 'No transactions found' &&
        isResultArray &&
        data.result.length === 0
      ) {
        console.log('[Treasury] No transactions found for this wallet');
        return apiOk({
          walletAddress,
          transactions: [],
          network: networkName,
          usdcContract: USDC_ADDRESS,
          source: 'etherscan_v2',
        });
      }

      // Handle rate limit or other API errors
      if (data.status !== '1' || !isResultArray) {
        const errorMessage = typeof data.result === 'string' ? data.result : data.message;
        console.warn('[Treasury] Etherscan API error:', errorMessage);

        // Check for rate limit error
        if (errorMessage?.toLowerCase().includes('rate limit')) {
          return apiError('Rate limit exceeded. Please try again in a few seconds.', 429, 'RATE_LIMIT');
        }

        // Return empty result for other errors
        return apiOk({
          walletAddress,
          transactions: [],
          network: networkName,
          usdcContract: USDC_ADDRESS,
          message: errorMessage || 'No USDC transactions found',
        });
      }

      // Cache the raw Etherscan data for future requests
      setCache(cacheKey, data.result);

      // Transform Etherscan data to our format
      const transactions: TreasuryTransaction[] = data.result.slice(0, limit).map((tx: EtherscanTokenTransfer) => ({
        txHash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: ethers.formatUnits(tx.value, 6), // USDC has 6 decimals
        gasUsed: tx.gasUsed,
        gasPrice: tx.gasPrice ? ethers.formatUnits(tx.gasPrice, 'gwei') : '0',
        timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
        blockNumber: tx.blockNumber,
      }));

      return apiOk({
        walletAddress,
        transactions,
        network: networkName,
        usdcContract: USDC_ADDRESS,
        source: 'etherscan_v2',
      });
    } catch (error) {
      console.error('[Treasury] Etherscan API error:', error);
      return apiError('Failed to fetch transaction history from blockchain', 500, 'INTERNAL_ERROR', {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  } catch (error) {
    console.error('Error in GET /api/admin/treasury/transactions:', error);
    return apiError(error instanceof Error ? error.message : 'Failed to fetch transactions', 500, 'INTERNAL_ERROR');
  }
}
