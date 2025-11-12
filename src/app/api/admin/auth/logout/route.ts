import type { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { apiOk, apiError } from '@/lib/api-response';

/**
 * POST /api/admin/auth/logout
 * Admin logout
 *
 * Response:
 * - success: boolean
 */
export async function POST(_request: NextRequest) {
  try {
    const session = await getSession();
    session.destroy();

    return apiOk({ success: true });
  } catch (error) {
    console.error('Error in POST /api/admin/auth/logout:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
