import type { NextRequest } from 'next/server';
import { apiError, apiOk } from '@/lib/api-response';
import { getVPSessionService } from '@/services/vp-session.memory.service';

/**
 * GET /api/mobile/vp-sessions/:sessionId/status
 *
 * VP 세션 상태 조회 (Polling용)
 * 앱에서 5초마다 호출하여 체크인 완료 여부를 확인합니다.
 *
 * Response (200):
 * {
 *   "status": "pending" | "verified" | "failed" | "expired",
 *   "verifiedAt"?: "2025-11-20T10:20:30.000Z",
 *   "checkinData"?: {
 *     "eventName": "Workshop on Climate Change",
 *     "userName": "John Doe",
 *     "userDID": "did:anam:user:0x..."
 *   },
 *   "expiresAt": "2025-11-20T10:18:00.000Z"
 * }
 *
 * Response (404):
 * {
 *   "error": "Session not found or expired",
 *   "code": "NOT_FOUND"
 * }
 */
export async function GET(request: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    const { sessionId } = params;

    if (!sessionId || typeof sessionId !== 'string') {
      return apiError('Invalid session ID', 400, 'VALIDATION_ERROR');
    }

    const vpSessionService = getVPSessionService();
    const sessionInfo = vpSessionService.getStatus(sessionId);

    if (!sessionInfo) {
      return apiError('Session not found or expired', 404, 'NOT_FOUND');
    }

    console.log('[GET /api/mobile/vp-sessions/:sessionId/status] Status retrieved', {
      sessionId,
      status: sessionInfo.status,
    });

    return apiOk({
      status: sessionInfo.status,
      verifiedAt: sessionInfo.verifiedAt?.toISOString(),
      checkinData: sessionInfo.checkinData,
      expiresAt: sessionInfo.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Error in GET /api/mobile/vp-sessions/:sessionId/status:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
