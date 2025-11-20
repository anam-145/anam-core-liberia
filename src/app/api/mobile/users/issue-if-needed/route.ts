import type { NextRequest } from 'next/server';
import { apiError, apiOk } from '@/lib/api-response';
import { ensureDataSource } from '@/server/db/ensureDataSource';
import { User } from '@/server/db/entities/User';
import { VcRegistry, VCStatus } from '@/server/db/entities/VcRegistry';
import { getDIDDatabaseService } from '@/services/did.db.service';
import { getVCDatabaseService } from '@/services/vc.db.service';
import { getSystemAdminWallet } from '@/services/system-init.service';
import { getAddress, isAddress } from 'ethers';
import { AppDataSource } from '@/server/db/datasource';

/**
 * POST /api/mobile/users/issue-if-needed
 *
 * Idempotent mobile endpoint:
 * - BODY: { walletAddress, publicKeyHex }
 * - If ACTIVE KYC VC already exists for the address → return metadata with alreadyIssued=true
 * - Else create DID + KYC VC and return credentials
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, publicKeyHex } = body;

    // Basic validation
    if (!walletAddress || !publicKeyHex) {
      console.warn('[mobile/issue-if-needed] Missing required fields');
      return apiError('Missing required fields: walletAddress, publicKeyHex', 400, 'VALIDATION_ERROR');
    }
    if (!isAddress(walletAddress)) {
      console.warn('[mobile/issue-if-needed] Invalid wallet address format', { walletAddress });
      return apiError('Invalid wallet address format', 400, 'VALIDATION_ERROR');
    }
    if (!/^0x04[a-fA-F0-9]{128}$/.test(publicKeyHex)) {
      console.warn('[mobile/issue-if-needed] Invalid publicKeyHex format');
      return apiError('Invalid publicKeyHex. Expected uncompressed 65-byte key (0x04...)', 400, 'VALIDATION_ERROR');
    }

    await ensureDataSource();
    const userRepo = AppDataSource.getRepository(User);
    const vcRepo = AppDataSource.getRepository(VcRegistry);

    const checksumAddress = getAddress(walletAddress);
    console.log('[mobile/issue-if-needed] Incoming request', { walletAddress: checksumAddress });
    const user = await userRepo.findOne({ where: { walletAddress: checksumAddress } });
    if (!user) {
      console.warn('[mobile/issue-if-needed] User not found for wallet', { walletAddress: checksumAddress });
      return apiError('User not found for this wallet address', 404, 'NOT_FOUND');
    }
    const ensureUserActive = async () => {
      if (!user.isActive) {
        user.isActive = true; // AnamWallet 활성화 (custody는 사용하지 않음)
        await userRepo.save(user);
        console.log('[mobile/issue-if-needed] User activated', { userId: user.userId, walletAddress: checksumAddress });
      }
    };

    const didService = getDIDDatabaseService();

    // Reuse existing DID or create/register
    let did = await didService.getDIDByAddress(checksumAddress);
    if (!did) {
      console.log('[mobile/issue-if-needed] DID not found, creating', { walletAddress: checksumAddress });
      const issuerWallet = getSystemAdminWallet();
      const created = await didService.createAndRegisterDID({
        walletAddress: checksumAddress,
        publicKeyHex,
        type: 'user',
        privateKey: issuerWallet.privateKey,
      });
      did = created.did;
      console.log('[mobile/issue-if-needed] DID created', { did });
    } else {
      console.log('[mobile/issue-if-needed] DID exists', { did });
    }

    // Check existing KYC VC (latest by issuedAt)
    const existingVC = await vcRepo.findOne({
      where: { userDid: did, vcType: 'UndpKycCredential' },
      order: { issuedAt: 'DESC' },
    });

    if (existingVC) {
      console.log('[mobile/issue-if-needed] Existing VC found', { vcId: existingVC.vcId, status: existingVC.status });
      if (existingVC.status === VCStatus.ACTIVE) {
        await ensureUserActive();
        console.log('[mobile/issue-if-needed] Returning existing VC', {
          did,
          vcId: existingVC.vcId,
          status: existingVC.status,
          expiresAt: existingVC.expiresAt ? existingVC.expiresAt.toISOString() : null,
        });
        return apiOk({
          alreadyIssued: true,
          did,
          vcId: existingVC.vcId,
          status: existingVC.status,
          expiresAt: existingVC.expiresAt ? existingVC.expiresAt.toISOString() : null,
          photoPath: user.kycFacePath ?? null,
          subject: {
            name: user.name,
            userId: user.userId,
          },
        });
      }

      return apiError(`VC is ${existingVC.status.toLowerCase()}`, 409, 'CONFLICT', {
        vcId: existingVC.vcId,
        status: existingVC.status,
        photoPath: user.kycFacePath ?? null,
        expiresAt: existingVC.expiresAt ? existingVC.expiresAt.toISOString() : null,
      });
    }

    console.log('[mobile/issue-if-needed] Issuing new VC', { did });
    // Issue new KYC VC
    const vcService = getVCDatabaseService();
    const issuerWallet = getSystemAdminWallet();
    const credentialData: Record<string, unknown> = {
      name: user.name,
      phoneNumber: user.phoneNumber,
      registrationType: user.registrationType,
      userId: user.userId,
    };

    const issued = await vcService.issueVC({
      walletAddress: checksumAddress,
      publicKeyHex,
      vcType: 'KYC',
      data: credentialData,
      issuerPrivateKey: issuerWallet.privateKey,
    });

    await ensureUserActive();

    // VC 발급 디버그 로그 (issuer 서명 확인용)
    import('@/utils/crypto/did')
      .then(({ canonicalStringify }) => {
        const vcCopy = { ...issued.vc };
        delete (vcCopy as Record<string, unknown>).proof;
        const canonical = canonicalStringify(vcCopy);

        console.log('[VC ISSUE] Canonical Length:', canonical.length);
        console.log('[VC ISSUE] Canonical FULL:', canonical);

        console.log('[VC ISSUE] Response VC:', JSON.stringify(issued.vc, null, 2));

        console.log('[mobile/issue-if-needed] VC issued details', {
          did: issued.did,
          vcId: issued.vc.id,
          issuerDid: issued.vc.issuer?.id ?? null,
          issuerProofMethod: issued.vc.proof?.verificationMethod,
          issuerProofJwsPrefix: issued.vc.proof?.jws?.slice(0, 20),
          holderDid: issued.vc.credentialSubject?.id,
          canonicalLen: canonical.length,
          canonicalPreview: canonical.slice(0, 160),
        });
      })
      .catch((e) => {
        console.warn('[mobile/issue-if-needed] VC issued log failed', e);
      });

    console.log('[mobile/issue-if-needed] Returning new VC payload', {
      did: issued.did,
      vcId: issued.vc.id,
      status: VCStatus.ACTIVE,
      expiresAt: issued.vc.validUntil ?? null,
    });

    return apiOk(
      {
        alreadyIssued: false,
        did: issued.did,
        vc: issued.vc,
        vcHash: issued.vcHash,
        txHashes: issued.txHashes,
        status: VCStatus.ACTIVE,
        expiresAt: issued.vc.validUntil ?? null,
        photoPath: user.kycFacePath ?? null,
      },
      201,
    );
  } catch (error) {
    console.error('Error in POST /api/mobile/users/issue-if-needed:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
