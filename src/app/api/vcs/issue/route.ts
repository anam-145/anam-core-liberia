import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getVCDatabaseService } from '@/services/vc.db.service';

/**
 * POST /api/vcs/issue
 * DID 등록 + KYC VC 발급 통합 엔드포인트
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
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.walletAddress || !body.publicKeyHex || !body.vcType || !body.data) {
      return NextResponse.json(
        { error: 'Missing required fields: walletAddress, publicKeyHex, vcType, data' },
        { status: 400 },
      );
    }

    // Validate vcType
    if (body.vcType !== 'KYC' && body.vcType !== 'ADMIN') {
      return NextResponse.json({ error: 'Invalid vcType. Must be "KYC" or "ADMIN"' }, { status: 400 });
    }

    // Validate data is an object
    if (typeof body.data !== 'object' || Array.isArray(body.data)) {
      return NextResponse.json({ error: 'data must be an object' }, { status: 400 });
    }

    const vcService = getVCDatabaseService();

    // Issue VC (통합 프로세스: DID 등록 + VC 발급)
    const result = await vcService.issueVC({
      walletAddress: body.walletAddress,
      publicKeyHex: body.publicKeyHex,
      vcType: body.vcType,
      data: body.data,
    });

    return NextResponse.json(
      {
        did: result.did,
        vc: result.vc,
        vcHash: result.vcHash,
        txHashes: result.txHashes,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error in POST /api/vcs/issue:', error);

    // Handle validation errors
    if (error instanceof Error && error.message.includes('Invalid')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
