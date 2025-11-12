import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getVCDatabaseService } from '@/services/vc.db.service';

/**
 * POST /api/vcs/revoke
 * VC 온체인 폐기
 *
 * Request Body:
 * - vcId: string (required) - 폐기할 VC ID
 * - reason: string (optional) - 폐기 사유
 *
 * Response:
 * - vcId: string - 폐기된 VC ID
 * - status: string - "REVOKED"
 * - txHash: string - 블록체인 트랜잭션 해시
 * - revokedAt: string - 폐기 시각 (ISO 8601)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.vcId) {
      return NextResponse.json({ error: 'Missing required field: vcId' }, { status: 400 });
    }

    const vcService = getVCDatabaseService();

    // Revoke VC
    const result = await vcService.revokeVC({
      vcId: body.vcId,
      reason: body.reason,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error in POST /api/vcs/revoke:', error);

    // Handle not found error
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    // Handle already revoked error
    if (error instanceof Error && error.message.includes('already revoked')) {
      return NextResponse.json({ error: error.message }, { status: 409 }); // Conflict
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
