import type { NextRequest } from 'next/server';
import { apiOk, apiError } from '@/lib/api-response';
import { decryptVault } from '@/utils/crypto/vault';
import { createWalletFromMnemonic } from '@/utils/crypto/wallet';
import { Contract, JsonRpcProvider, Wallet } from 'ethers';

interface VaultPayload {
  ciphertext: string;
  iv: string;
  salt: string;
  authTag: string;
}

interface RedeemPayload {
  address: string;
  vault: VaultPayload;
}

/**
 * POST /api/withdraw/redeem
 * Redeem Paper Voucher - Transfer USDC to withdraw service wallet
 *
 * Request Body:
 * - payload: { address: string, vault: VaultPayload }
 * - password: string
 * - amount: string (USDC amount, e.g., "10.00")
 *
 * Response:
 * - success: boolean
 * - txHash: string
 * - from: string (voucher wallet)
 * - to: string (service wallet)
 * - amount: string
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { payload, password, amount } = body as {
      payload?: RedeemPayload;
      password?: string;
      amount?: string;
    };

    // 1. Input validation
    if (!payload || typeof payload !== 'object') {
      return apiError('Missing or invalid payload', 400, 'VALIDATION_ERROR');
    }

    if (!payload.address || typeof payload.address !== 'string') {
      return apiError('Missing required field: payload.address', 400, 'VALIDATION_ERROR');
    }

    if (
      !payload.vault ||
      !payload.vault.ciphertext ||
      !payload.vault.iv ||
      !payload.vault.salt ||
      !payload.vault.authTag
    ) {
      return apiError('Invalid vault structure', 400, 'VALIDATION_ERROR');
    }

    if (!password || typeof password !== 'string') {
      return apiError('Missing required field: password', 400, 'VALIDATION_ERROR');
    }

    if (!amount || typeof amount !== 'string') {
      return apiError('Missing required field: amount', 400, 'VALIDATION_ERROR');
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return apiError('Invalid amount', 400, 'VALIDATION_ERROR');
    }

    // 2. Decrypt vault to get mnemonic
    let mnemonic: string;
    try {
      mnemonic = decryptVault(payload.vault, password);
    } catch {
      return apiError('Invalid password', 401, 'UNAUTHORIZED');
    }

    // 3. Create wallet from mnemonic
    const wallet = createWalletFromMnemonic(mnemonic);
    const derivedAddress = wallet.address;

    // 4. Verify wallet address matches payload
    if (derivedAddress.toLowerCase() !== payload.address.toLowerCase()) {
      return apiError('Wallet address mismatch', 400, 'VALIDATION_ERROR');
    }

    // 5. Get blockchain config
    const rpcUrl = process.env.BASE_RPC_URL;
    const usdcAddress = process.env.BASE_USDC_ADDRESS;
    const chainId = process.env.BASE_CHAIN_ID;
    const withdrawServiceWallet = process.env.WITHDRAW_SERVICE_WALLET;

    if (!rpcUrl || !usdcAddress || !chainId) {
      return apiError('Blockchain configuration missing', 500, 'INTERNAL_ERROR');
    }

    if (!withdrawServiceWallet) {
      return apiError('Withdraw service not configured', 500, 'INTERNAL_ERROR');
    }

    // 6. Create provider and signer
    const provider = new JsonRpcProvider(rpcUrl, parseInt(chainId, 10));
    const signer = new Wallet(wallet.privateKey, provider);

    // 7. USDC contract
    const ERC20_ABI = [
      'function transfer(address to, uint256 amount) external returns (bool)',
      'function balanceOf(address owner) external view returns (uint256)',
    ];
    const usdcContract = new Contract(usdcAddress, ERC20_ABI, signer);

    // 8. Convert amount to base units (6 decimals for USDC)
    const amountBaseUnits = BigInt(Math.floor(amountNum * 1_000_000));

    // 9. Check balance
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const balance = (await (usdcContract as any).balanceOf(derivedAddress)) as bigint;
    if (balance < amountBaseUnits) {
      const balanceFormatted = (Number(balance) / 1_000_000).toFixed(2);
      return apiError(`Insufficient USDC balance. Available: ${balanceFormatted} USDC`, 400, 'VALIDATION_ERROR');
    }

    // 10. Execute transfer to withdraw service wallet
    console.log(`📤 Withdraw redeem: ${derivedAddress} → ${withdrawServiceWallet} (${amount} USDC)`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tx = await (usdcContract as any).transfer(withdrawServiceWallet, amountBaseUnits);
    const receipt = await tx.wait();

    if (!receipt) {
      return apiError('Transaction failed', 500, 'INTERNAL_ERROR');
    }

    console.log(
      `✅ Withdraw redeem completed: ${derivedAddress} → ${withdrawServiceWallet} (${amount} USDC, tx: ${tx.hash})`,
    );

    return apiOk({
      success: true,
      txHash: tx.hash,
      from: derivedAddress,
      to: withdrawServiceWallet,
      amount: amount,
    });
  } catch (error) {
    console.error('Error in POST /api/withdraw/redeem:', error);

    if (error instanceof Error) {
      // Handle specific blockchain errors
      if (error.message.includes('insufficient funds')) {
        return apiError('Insufficient ETH for gas fee', 400, 'VALIDATION_ERROR');
      }
      if (error.message.includes('nonce')) {
        return apiError('Transaction conflict. Please try again.', 409, 'CONFLICT');
      }
    }

    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
