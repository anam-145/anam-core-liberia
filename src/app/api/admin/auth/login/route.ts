import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { systemInitService } from '@/services/system-init.service';
import { getSession } from '@/lib/auth';
import { apiOk, apiError } from '@/lib/api-response';

/**
 * POST /api/admin/auth/login
 * Admin login
 *
 * Request Body:
 * - username: string (required)
 * - password: string (required)
 *
 * Response:
 * - adminId: number
 * - username: string
 * - role: string
 */
export async function POST(request: NextRequest) {
  try {
    // Initialize system if needed (first-time setup)
    await systemInitService.initializeSystemIfNeeded();

    const body = await request.json();

    // Validate required fields
    if (!body.username || !body.password) {
      return apiError('Missing required fields: username, password', 400, 'VALIDATION_ERROR');
    }

    // Authenticate admin
    const admin = await adminService.authenticateAdmin(body.username, body.password);

    if (!admin) {
      return apiError('Invalid username or password', 401, 'UNAUTHORIZED');
    }

    // Create session
    const session = await getSession();
    session.adminId = admin.adminId;
    session.username = admin.username;
    session.role = admin.role;
    session.isLoggedIn = true;
    await session.save();

    return apiOk({
      adminId: admin.adminId,
      username: admin.username,
      role: admin.role,
    });
  } catch (error) {
    console.error('Error in POST /api/admin/auth/login:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
