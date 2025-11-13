import type { NextRequest } from 'next/server';
import { getDIDDatabaseService } from '@/services/did.db.service';
import { apiOk, apiError } from '@/lib/api-response';

/**
 * POST /api/dids/register
 * DID 생성 및 DB 등록 (오프체인)
 *
 * Note: 온체인 등록은 내부 서비스에서만 수행됩니다 (보안상 privateKey를 외부에서 받지 않음)
 * - System Admin 초기화 시: system-init.service.ts
 * - VC 발급 시: vc.db.service.ts
 *
 * Request Body:
 * - walletAddress: string (required) - 지갑 주소
 * - publicKeyHex: string (required) - 공개키 (65바이트 hex)
 * - type: 'user' | 'issuer' (required) - DID 타입
 *
 * Response:
 * - did: string - 생성된 DID
 * - documentHash: string - DID Document 해시
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.walletAddress || !body.publicKeyHex || !body.type) {
      return apiError('Missing required fields: walletAddress, publicKeyHex, type', 400, 'VALIDATION_ERROR');
    }

    // Validate type field
    if (body.type !== 'user' && body.type !== 'issuer') {
      return apiError('Invalid type. Must be "user" or "issuer"', 400, 'VALIDATION_ERROR');
    }

    const didService = getDIDDatabaseService();

    // Create and register DID
    const result = await didService.createAndRegisterDID({
      walletAddress: body.walletAddress,
      publicKeyHex: body.publicKeyHex,
      type: body.type,
    });

    return apiOk(
      {
        did: result.did,
        documentHash: result.documentHash,
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
