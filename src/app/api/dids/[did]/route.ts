import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getDIDDatabaseService } from '@/services/did.db.service';

interface Params {
  params: {
    did: string;
  };
}

/**
 * GET /api/dids/{did}
 * DID Document 조회 및 검증
 *
 * Path Parameters:
 * - did: string - 조회할 DID (URL encoded)
 *
 * Response:
 * - @context: string - DID 컨텍스트
 * - id: string - DID
 * - type: string - DID 타입 (USER/ISSUER)
 * - controller: string - 제어자 DID
 * - verificationMethod: array - 공개키 정보
 * - created: string - 생성 시각
 * - updated: string - 수정 시각
 */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    // Decode DID from URL
    const did = decodeURIComponent(params.did);

    const didService = getDIDDatabaseService();

    // Get DID Document
    const document = await didService.getDIDDocument(did);

    if (!document) {
      return NextResponse.json({ error: 'DID Document not found' }, { status: 404 });
    }

    // Verify on-chain status (Mock)
    const isVerified = await didService.verifyOnChain(did);

    // Return DID Document with verification status
    return NextResponse.json({
      ...document,
      verified: isVerified, // 온체인 검증 결과
      metadata: {
        retrievedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error in GET /api/dids/[did]:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
