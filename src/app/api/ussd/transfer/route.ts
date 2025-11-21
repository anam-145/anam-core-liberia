import type { NextRequest } from 'next/server';
import { apiOk, apiError } from '@/lib/api-response';
import { AppDataSource } from '@/server/db/datasource';
import { User, USSDStatus } from '@/server/db/entities/User';
import { custodyService } from '@/services/custody.db.service';
import { decryptVault } from '@/utils/crypto/vault';
import { createWalletFromMnemonic } from '@/utils/crypto/wallet';
import { Contract, JsonRpcProvider, Wallet } from 'ethers';

/**
 * POST /api/ussd/transfer
 * Transfer USDC from USSD user to another user
 *
 * Request Body:
 * - phoneNumber: string (sender phone number)
 * - pin: string (4-6 digits)
 * - toPhoneNumber: string (recipient phone number)
 * - amount: string (USDC amount, e.g., "10.00")
 *
 * Response:
 * - success: boolean
 * - txHash: string
 * - from: string
 * - to: string
 * - amount: string
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber, pin, toPhoneNumber, amount } = body;

    // Validation
    if (!phoneNumber) {
      return apiError('Phone number is required', 400, 'VALIDATION_ERROR');
    }
    if (!pin) {
      return apiError('PIN is required', 400, 'VALIDATION_ERROR');
    }
    if (!/^\d{4,6}$/.test(pin)) {
      return apiError('PIN must be 4-6 digits', 400, 'VALIDATION_ERROR');
    }
    if (!toPhoneNumber) {
      return apiError('Recipient phone number is required', 400, 'VALIDATION_ERROR');
    }
    if (!amount) {
      return apiError('Amount is required', 400, 'VALIDATION_ERROR');
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return apiError('Invalid amount', 400, 'VALIDATION_ERROR');
    }

    // Initialize database
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const userRepository = AppDataSource.getRepository(User);

    // Find sender
    const sender = await userRepository.findOne({
      where: { phoneNumber },
    });

    if (!sender) {
      return apiError('Sender not found', 404, 'NOT_FOUND');
    }

    if (sender.ussdStatus !== USSDStatus.ACTIVE) {
      return apiError('Sender is not active', 400, 'VALIDATION_ERROR');
    }

    // Find recipient
    const recipient = await userRepository.findOne({
      where: { phoneNumber: toPhoneNumber },
    });

    if (!recipient) {
      return apiError('Recipient not found', 404, 'NOT_FOUND');
    }

    if (!recipient.walletAddress) {
      return apiError('Recipient wallet not found', 404, 'NOT_FOUND');
    }

    // Get sender custody wallet
    const custody = await custodyService.getCustodyByUserId(sender.userId);

    if (!custody) {
      return apiError('Sender custody wallet not found', 404, 'NOT_FOUND');
    }

    // Verify PIN and decrypt vault
    let mnemonic: string;
    try {
      mnemonic = decryptVault(custody.vault, pin);
    } catch {
      return apiError('Invalid PIN', 401, 'UNAUTHORIZED');
    }

    // Get private key from mnemonic
    const wallet = createWalletFromMnemonic(mnemonic);
    const privateKey = wallet.privateKey;

    // Blockchain config
    const rpcUrl = process.env.BASE_RPC_URL;
    const usdcAddress = process.env.BASE_USDC_ADDRESS;
    const chainId = process.env.BASE_CHAIN_ID;

    if (!rpcUrl || !usdcAddress || !chainId) {
      return apiError('Blockchain configuration missing', 500, 'INTERNAL_ERROR');
    }

    // Create provider and signer
    const provider = new JsonRpcProvider(rpcUrl, parseInt(chainId, 10));
    const signer = new Wallet(privateKey, provider);

    // USDC contract
    const ERC20_ABI = [
      'function transfer(address to, uint256 amount) external returns (bool)',
      'function balanceOf(address owner) external view returns (uint256)',
    ];
    const usdcContract = new Contract(usdcAddress, ERC20_ABI, signer);

    // Convert amount to base units (6 decimals for USDC)
    const amountBaseUnits = BigInt(Math.floor(amountNum * 1_000_000));

    // Check sender balance
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const balance = (await (usdcContract as any).balanceOf(sender.walletAddress)) as bigint;
    if (balance < amountBaseUnits) {
      return apiError('Insufficient USDC balance', 400, 'VALIDATION_ERROR');
    }

    // Execute transfer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tx = await (usdcContract as any).transfer(recipient.walletAddress, amountBaseUnits);
    const receipt = await tx.wait();

    if (!receipt) {
      return apiError('Transaction failed', 500, 'INTERNAL_ERROR');
    }

    return apiOk({
      success: true,
      txHash: tx.hash,
      from: sender.walletAddress,
      to: recipient.walletAddress,
      amount: amount,
    });
  } catch (error) {
    console.error('Error in POST /api/ussd/transfer:', error);

    if (error instanceof Error) {
      if (error.message.includes('insufficient funds')) {
        return apiError('Insufficient ETH for gas', 400, 'VALIDATION_ERROR');
      }
    }

    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
