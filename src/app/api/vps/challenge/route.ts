import type { NextRequest } from 'next/server';
import { getChallengeService } from '@/services/challenge.memory.service';
import { apiOk, apiError } from '@/lib/api-response';

/**
 * GET /api/vps/challenge
 * VP용 일회성 challenge 생성
 *
 * Response:
 * - challenge: string - 일회용 난수 (32바이트 hex, 0x 접두사 포함)
 * - expiresAt: string - 만료 시각 (ISO 8601, 기본 5분 후)
 *
 * 참고:
 * - Challenge는 재사용 공격(replay attack) 방지를 위해 일회성으로 사용됨
 * - 만료 시간은 환경변수 CHALLENGE_EXPIRY_MINUTES로 설정 가능 (기본 5분)
 * - Challenge는 메모리에 저장되며, 1분마다 자동으로 만료된 challenge를 정리함
 */
export async function GET(_request: NextRequest) {
  try {
    const challengeService = getChallengeService();

    // Generate new challenge
    const challenge = challengeService.create();

    // Get challenge info
    const info = challengeService.getInfo(challenge);

    if (!info) {
      throw new Error('Failed to create challenge');
    }

    return apiOk({
      challenge,
      expiresAt: info.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Error in GET /api/vps/challenge:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
