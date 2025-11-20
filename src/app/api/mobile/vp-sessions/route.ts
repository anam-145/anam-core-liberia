import type { NextRequest } from 'next/server';
import { apiError, apiOk } from '@/lib/api-response';
import { getVPSessionService } from '@/services/vp-session.memory.service';
import type { VerifiablePresentation } from '@/utils/crypto/did';

/**
 * POST /api/mobile/vp-sessions
 *
 * 앱에서 생성한 VP를 서버에 임시 저장하고 sessionId를 반환합니다.
 * 이 sessionId를 QR 코드로 생성하여 체크인 시 스캔합니다.
 *
 * Request Body:
 * {
 *   "vp": { ...VerifiablePresentation },
 *   "challenge": "0x..."
 * }
 *
 * Response (201):
 * {
 *   "sessionId": "abc123def456...",
 *   "expiresAt": "2025-11-20T10:18:00.000Z",
 *   "expiresIn": 300
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body?.vp || !body?.challenge) {
      return apiError('Missing required fields: vp, challenge', 400, 'VALIDATION_ERROR');
    }

    const vp = body.vp as VerifiablePresentation;
    const challenge = body.challenge as string;

    // Basic VP structure validation
    if (
      !vp['@context'] ||
      !vp.type ||
      !vp.holder ||
      !vp.verifiableCredential ||
      !Array.isArray(vp.verifiableCredential) ||
      vp.verifiableCredential.length === 0 ||
      !vp.proof
    ) {
      return apiError('Invalid VP structure', 400, 'VALIDATION_ERROR');
    }

    // Check if VP proof contains the challenge
    if (vp.proof?.challenge !== challenge) {
      return apiError('VP proof challenge does not match provided challenge', 400, 'VALIDATION_ERROR');
    }

    // Store VP session
    const vpSessionService = getVPSessionService();
    const sessionId = vpSessionService.create(vp, challenge);
    const sessionInfo = vpSessionService.getInfo(sessionId);

    if (!sessionInfo) {
      return apiError('Failed to create VP session', 500, 'INTERNAL_ERROR');
    }

    console.log('[POST /api/mobile/vp-sessions] VP session created', {
      sessionId,
      holder: vp.holder,
      challenge: challenge.slice(0, 20) + '...',
      expiresAt: sessionInfo.expiresAt.toISOString(),
    });

    return apiOk(
      {
        sessionId,
        expiresAt: sessionInfo.expiresAt.toISOString(),
        expiresIn: Math.floor((sessionInfo.expiresAt.getTime() - Date.now()) / 1000), // seconds
      },
      201,
    );
  } catch (error) {
    console.error('Error in POST /api/mobile/vp-sessions:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
