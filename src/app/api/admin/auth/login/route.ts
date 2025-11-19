import type { NextRequest } from 'next/server';
import { getVCDatabaseService } from '@/services/vc.db.service';
import { custodyService } from '@/services/custody.db.service';
import { getSystemAdminWallet, systemInitService } from '@/services/system-init.service';
import { getSession } from '@/lib/auth';
import { apiOk, apiError } from '@/lib/api-response';
import { generateWallet } from '@/utils/crypto/wallet';
import { encryptVault } from '@/utils/crypto/vault';
import AppDataSource from '@/server/db/datasource';
import { Admin, OnboardingStatus } from '@/server/db/entities/Admin';
import { compare } from 'bcryptjs';

/**
 * POST /api/admin/auth/login
 * Admin login
 *
 * Request Body:
 * - username: string (required)
 * - password: string (required)
 *
 * Response:
 * - adminId: number
 * - username: string
 * - role: string
 */
export async function POST(request: NextRequest) {
  try {
    // Initialize system if needed (first-time setup)
    await systemInitService.initializeSystemIfNeeded();

    const body = await request.json();

    // Validate required fields
    if (!body.username || !body.password) {
      return apiError('Missing required fields: username, password', 400, 'VALIDATION_ERROR');
    }

    // Authenticate admin (allow APPROVED + inactive)
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    const repo = AppDataSource.getRepository(Admin);
    const admin = await repo.findOne({ where: { username: body.username } });
    if (!admin) return apiError('Invalid username or password', 401, 'UNAUTHORIZED');
    const ok = await compare(body.password, admin.passwordHash);
    if (!ok) return apiError('Invalid username or password', 401, 'UNAUTHORIZED');

    // Handle onboarding status branches
    if (admin.onboardingStatus === OnboardingStatus.PENDING_REVIEW) {
      return apiError('Your signup is pending review', 403, 'FORBIDDEN');
    }
    if (admin.onboardingStatus === OnboardingStatus.REJECTED) {
      return apiError('Your signup has been rejected', 403, 'FORBIDDEN');
    }

    // Conditional activation on login (no separate setup route)
    let activated = false;
    let did = admin.did;
    let walletAddress = admin.walletAddress;

    if (admin.onboardingStatus === OnboardingStatus.APPROVED && admin.isActive === false) {
      // 1) Generate wallet from scratch
      const wallet = generateWallet();

      // 2) Issue ADMIN VC (this will also register DID on-chain if absent)
      const vcService = getVCDatabaseService();
      const issuer = getSystemAdminWallet();
      const issued = await vcService.issueVC({
        walletAddress: wallet.address,
        publicKeyHex: wallet.publicKey,
        vcType: 'ADMIN',
        data: { username: admin.username, fullName: admin.fullName },
        issuerPrivateKey: issuer.privateKey,
      });

      // 3) Encrypt wallet mnemonic and VC JSON into vaults
      const walletVault = encryptVault(wallet.mnemonic, body.password);
      const vcVault = encryptVault(JSON.stringify(issued.vc), body.password);

      // 4) Store custody with both vaults
      await custodyService.createCustody({
        adminId: admin.adminId,
        vault: walletVault,
        vc: { id: issued.vc.id, ...vcVault },
      });

      // 5) Update admin record
      // Save updates
      admin.did = issued.did;
      admin.walletAddress = wallet.address;
      admin.isActive = true;
      admin.onboardingStatus = OnboardingStatus.ACTIVE;
      await repo.save(admin);

      did = admin.did;
      walletAddress = admin.walletAddress;
      activated = true;
    }

    // Create session
    const session = await getSession();
    session.adminId = admin.adminId;
    session.username = admin.username;
    session.role = admin.role;
    session.isLoggedIn = true;
    await session.save();

    return apiOk({
      adminId: admin.adminId,
      username: admin.username,
      role: admin.role,
      onboardingStatus: admin.onboardingStatus,
      isActive: admin.isActive,
      did,
      walletAddress,
      activated,
    });
  } catch (error) {
    console.error('Error in POST /api/admin/auth/login:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
