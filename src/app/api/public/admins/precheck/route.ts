import type { NextRequest } from 'next/server';
import { apiOk, apiError } from '@/lib/api-response';
import AppDataSource from '@/server/db/datasource';
import { Admin, OnboardingStatus } from '@/server/db/entities/Admin';
import { ensureDataSource } from '@/server/db/ensureDataSource';

/**
 * POST /api/public/admins/precheck
 * Body: { username: string }
 * Response: { needsActivation: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = (body?.username || '').trim();
    if (!username) {
      return apiError('Missing required field: username', 400, 'VALIDATION_ERROR');
    }

    await ensureDataSource();
    const repo = AppDataSource.getRepository(Admin);
    const admin = await repo.findOne({ where: { username } });

    if (!admin) {
      // Unknown user; do not leak existence. Return false to proceed normally.
      return apiOk({ needsActivation: false });
    }

    const needsActivation = admin.onboardingStatus === OnboardingStatus.APPROVED && admin.isActive === false;
    return apiOk({ needsActivation });
  } catch (error) {
    console.error('Error in POST /api/public/admins/precheck:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
