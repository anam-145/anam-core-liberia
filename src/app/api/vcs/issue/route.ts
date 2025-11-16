import type { NextRequest } from 'next/server';
import { getVCDatabaseService } from '@/services/vc.db.service';
import { apiOk, apiError } from '@/lib/api-response';
import { getSystemAdminWallet } from '@/services/system-init.service';
import { requireRole } from '@/lib/auth-middleware';
import { AdminRole } from '@/server/db/entities/Admin';

/**
 * POST /api/vcs/issue
 * DID 등록 + KYC VC 발급 통합 엔드포인트
 *
 * Authentication: Requires SYSTEM_ADMIN or STAFF role
 * (전역 작업: 시스템 관리자는 물론, 스태프도 VC 발급 가능)
 *
 * Request Body:
 * - walletAddress: string (required) - 지갑 주소
 * - publicKeyHex: string (required) - 공개키 (65바이트 hex)
 * - vcType: 'KYC' | 'ADMIN' (required) - VC 타입
 * - data: object (required) - VC credentialSubject에 들어갈 데이터
 *   예시: { name: "John Doe", role: "participant" }
 *
 * Response:
 * - did: string - 생성된 또는 기존 DID
 * - vc: object - 발급된 VC (전체 JSON)
 * - vcHash: string - VC 해시값
 * - txHashes: object - 트랜잭션 해시들
 *   - didRegistry: string - DID 등록 tx (또는 "existing")
 *   - vcRegistry: string - VC 등록 tx
 */
export async function POST(request: NextRequest) {
  // 🔒 Authentication: SYSTEM_ADMIN or STAFF can issue VCs
  const authCheck = await requireRole([AdminRole.SYSTEM_ADMIN, AdminRole.STAFF]);
  if (authCheck) return authCheck;

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.walletAddress || !body.publicKeyHex || !body.vcType || !body.data) {
      return apiError('Missing required fields: walletAddress, publicKeyHex, vcType, data', 400, 'VALIDATION_ERROR');
    }

    // Validate vcType
    if (body.vcType !== 'KYC' && body.vcType !== 'ADMIN') {
      return apiError('Invalid vcType. Must be "KYC" or "ADMIN"', 400, 'VALIDATION_ERROR');
    }

    // Validate data is an object
    if (typeof body.data !== 'object' || Array.isArray(body.data)) {
      return apiError('data must be an object', 400, 'VALIDATION_ERROR');
    }

    const vcService = getVCDatabaseService();

    // Get System Admin wallet for issuer private key
    const issuerWallet = getSystemAdminWallet();

    // Issue VC (통합 프로세스: DID 등록 + VC 발급)
    const result = await vcService.issueVC({
      walletAddress: body.walletAddress,
      publicKeyHex: body.publicKeyHex,
      vcType: body.vcType,
      data: body.data,
      issuerPrivateKey: issuerWallet.privateKey,
    });

    return apiOk(
      {
        did: result.did,
        vc: result.vc,
        vcHash: result.vcHash,
        txHashes: result.txHashes,
      },
      201,
    );
  } catch (error) {
    console.error('Error in POST /api/vcs/issue:', error);

    // Handle validation errors
    if (error instanceof Error && error.message.includes('Invalid')) {
      return apiError(error.message, 400, 'VALIDATION_ERROR');
    }

    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
