import type { NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth-middleware';
import { AdminRole } from '@/server/db/entities/Admin';
import { apiOk, apiError } from '@/lib/api-response';
import { generateWallet } from '@/utils/crypto/wallet';
import { getSystemAdminWallet } from '@/services/system-init.service';
import { getVCDatabaseService } from '@/services/vc.db.service';
import { adminService } from '@/services/admin.service';
import { encryptVault } from '@/utils/crypto/vault';
import { custodyService } from '@/services/custody.db.service';

/**
 * POST /api/admin/admins/onboard
 * SYSTEM_ADMIN 전용: 관리자 온보딩 (지갑/DID/ADMIN VC/볼트/Custody/Admin 레코드 생성 단일 플로우)
 *
 * Request:
 * - username: string
 * - password: string (로그인/볼트 동일 비밀번호 사용)
 * - fullName: string
 * - email?: string
 * - role?: 'STAFF' | 'SYSTEM_ADMIN' (기본: STAFF)
 *
 * Response(201):
 * { admin: {...}, did: string, custodyId: string, vcId: string }
 */
export async function POST(request: NextRequest) {
  const authCheck = await requireRole(AdminRole.SYSTEM_ADMIN);
  if (authCheck) return authCheck;

  try {
    const body = await request.json();
    const { username, password, fullName, email } = body as {
      username: string;
      password: string;
      fullName: string;
      email?: string;
      role?: 'SYSTEM_ADMIN' | 'STAFF';
    };

    if (!username || !password || !fullName) {
      return apiError('Missing required fields: username, password, fullName', 400, 'VALIDATION_ERROR');
    }

    const role: AdminRole = (body.role as AdminRole) || AdminRole.STAFF;

    // 1) Generate wallet (mnemonic based)
    const wallet = generateWallet();

    // 2) Issue ADMIN VC (includes DID registration + on-chain)
    const vcService = getVCDatabaseService();
    const issuerWallet = getSystemAdminWallet();
    const issued = await vcService.issueVC({
      walletAddress: wallet.address,
      publicKeyHex: wallet.publicKey,
      vcType: 'ADMIN',
      data: { username, fullName },
      issuerPrivateKey: issuerWallet.privateKey,
    });

    const did = issued.did;
    const signedVC = issued.vc;

    // 3) Create vaults using SAME password
    const walletVault = encryptVault(wallet.mnemonic, password);
    // NOTE: 현재 스키마는 Custody.vc에 평문 VC(JSON)를 저장합니다.
    // 추후 스키마 변경 시 암호문(vcVault)을 저장하도록 마이그레이션 예정.
    // const vcVault = encryptVault(JSON.stringify(signedVC), password);

    // 4) Create Admin record (role: STAFF by default, did/walletAddress set)
    const admin = await adminService.createAdmin({
      username,
      password,
      fullName,
      email: email || '',
      role,
      did,
      walletAddress: wallet.address,
    });

    // 5) Custody: store wallet vault and VC together (single call)
    const custody = await custodyService.createCustody({
      userId: admin.adminId,
      walletType: 'ANAMWALLET',
      vault: walletVault,
      isBackup: false,
      vc: signedVC,
    });

    return apiOk(
      {
        admin: {
          id: admin.id,
          adminId: admin.adminId,
          username: admin.username,
          fullName: admin.fullName,
          email: admin.email,
          role: admin.role,
          did: admin.did,
          walletAddress: admin.walletAddress,
          createdAt: admin.createdAt,
        },
        did,
        custodyId: custody.custodyId,
        vcId: signedVC.id,
      },
      201,
    );
  } catch (error) {
    console.error('Error in POST /api/admin/admins/onboard:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
