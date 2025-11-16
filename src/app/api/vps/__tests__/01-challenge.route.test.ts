/** @jest-environment node */

import { GET } from '../challenge/route';
import type { NextRequest } from 'next/server';
import { resetChallengeService } from '@/services/challenge.memory.service';

/**
 * 시나리오(챌린지 발급)
 * - 일회성 challenge와 만료 시간이 반환되어야 한다
 */
describe('GET /api/vps/challenge', () => {
  afterAll(() => {
    resetChallengeService();
  });

  it('challenge와 expiresAt을 반환한다', async () => {
    const res = await GET({} as unknown as NextRequest);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { challenge: string; expiresAt: string };
    expect(data.challenge).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(new Date(data.expiresAt).toString()).not.toBe('Invalid Date');
  });
});
