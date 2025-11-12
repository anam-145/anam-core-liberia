import { getSession } from '@/lib/auth';
import { apiOk, apiError } from '@/lib/api-response';

/**
 * GET /api/admin/auth/session
 * Get current admin session
 *
 * Response:
 * - isLoggedIn: boolean
 * - adminId?: number
 * - username?: string
 * - role?: string
 */
export async function GET() {
  try {
    const session = await getSession();

    if (!session.isLoggedIn) {
      return apiOk({
        isLoggedIn: false,
      });
    }

    return apiOk({
      isLoggedIn: true,
      adminId: session.adminId,
      username: session.username,
      role: session.role,
    });
  } catch (error) {
    console.error('Error in GET /api/admin/auth/session:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
