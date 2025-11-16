import type { NextRequest } from 'next/server';
import { getDIDDatabaseService } from '@/services/did.db.service';
import { apiOk, apiError } from '@/lib/api-response';
import { getSystemAdminWallet } from '@/services/system-init.service';
import { requireRole } from '@/lib/auth-middleware';
import { AdminRole } from '@/server/db/entities/Admin';

/**
 * POST /api/dids/register
 * DID 생성 및 블록체인 등록 (참가자용)
 *
 * Authentication: Requires SYSTEM_ADMIN or STAFF role
 * (전역 작업: 참가자 DID 등록은 시스템 관리자와 스태프가 수행)
 *
 * Note: System Admin의 privateKey를 사용하여 블록체인에 등록합니다.
 * - 보안: 외부에서 privateKey를 받지 않고 ENV에서 가져옴
 * - 권한: 블록체인 레벨에서 System Admin만 등록 가능
 * - 제한: 이 API로는 user DID만 생성 가능 (issuer DID는 시스템 초기화에서만)
 *
 * Request Body:
 * - walletAddress: string (required) - 지갑 주소
 * - publicKeyHex: string (required) - 공개키 (65바이트 hex)
 *
 * Response:
 * - did: string - 생성된 DID (항상 did:anam:user:0x...)
 * - documentHash: string - DID Document 해시
 * - txHash: string - 블록체인 트랜잭션 해시
 * - blockNumber: number - 블록 번호
 */
export async function POST(request: NextRequest) {
  // 🔒 Authentication: SYSTEM_ADMIN or STAFF can register participant DIDs
  const authCheck = await requireRole([AdminRole.SYSTEM_ADMIN, AdminRole.STAFF]);
  if (authCheck) return authCheck;

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.walletAddress || !body.publicKeyHex) {
      return apiError('Missing required fields: walletAddress, publicKeyHex', 400, 'VALIDATION_ERROR');
    }

    const didService = getDIDDatabaseService();

    // Get System Admin wallet for blockchain registration
    const issuerWallet = getSystemAdminWallet();

    // Create and register DID (on-chain)
    // Force type to 'user' - issuer DIDs can only be created during system initialization
    const result = await didService.createAndRegisterDID({
      walletAddress: body.walletAddress,
      publicKeyHex: body.publicKeyHex,
      type: 'user', // 항상 user DID 생성 (참가자, Approver, Verifier)
      privateKey: issuerWallet.privateKey,
    });

    return apiOk(
      {
        did: result.did,
        documentHash: result.documentHash,
        txHash: result.txHash,
        blockNumber: result.blockNumber,
        onChainRegistered: result.onChainRegistered,
      },
      201,
    );
  } catch (error) {
    console.error('Error in POST /api/dids/register:', error);

    // Handle duplicate DID error
    if (error instanceof Error && error.message.includes('already has a DID')) {
      return apiError(error.message, 409, 'CONFLICT');
    }

    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
