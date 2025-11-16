import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireRole } from '@/lib/auth-middleware';
import { apiOk, apiError } from '@/lib/api-response';
import { AdminRole } from '@/server/db/entities/Admin';

/**
 * POST /api/admin/admins
 * Create a new admin (SYSTEM_ADMIN only)
 *
 * Request Body:
 * - username: string (required)
 * - password: string (required)
 * - fullName: string (required)
 * - email: string (required)
 * - role: 'SYSTEM_ADMIN' | 'STAFF' (required)
 *
 * Response:
 * - admin: Admin object (without passwordHash)
 */
export async function POST(request: NextRequest) {
  const authCheck = await requireRole(AdminRole.SYSTEM_ADMIN);
  if (authCheck) return authCheck;

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.username || !body.password || !body.fullName || !body.email || !body.role) {
      return apiError('Missing required fields: username, password, fullName, email, role', 400, 'VALIDATION_ERROR');
    }

    // Validate role
    if (!['SYSTEM_ADMIN', 'STAFF'].includes(body.role)) {
      return apiError('Invalid role. Must be SYSTEM_ADMIN or STAFF', 400, 'VALIDATION_ERROR');
    }

    // Note: Audit trail omitted in MVP

    // Create admin
    const admin = await adminService.createAdmin({
      username: body.username,
      password: body.password,
      fullName: body.fullName,
      email: body.email,
      role: body.role,
    });

    // Remove passwordHash from response
    const { passwordHash: _passwordHash, ...adminData } = admin;

    return apiOk({ admin: adminData }, 201);
  } catch (error) {
    console.error('Error in POST /api/admin/admins:', error);

    // Handle duplicate errors
    if (
      error instanceof Error &&
      (error.message.includes('already exists') || error.message.includes('already registered'))
    ) {
      return apiError(error.message, 409, 'CONFLICT');
    }

    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}

/**
 * GET /api/admin/admins
 * List all admins (SYSTEM_ADMIN only)
 *
 * Response:
 * - admins: Admin[] (without passwordHash)
 */
export async function GET(_request: NextRequest) {
  const authCheck = await requireRole(AdminRole.SYSTEM_ADMIN);
  if (authCheck) return authCheck;

  try {
    const admins = await adminService.getAllAdmins();

    // Remove passwordHash from response
    const adminsData = admins.map(({ passwordHash: _passwordHash, ...admin }) => admin);

    return apiOk({ admins: adminsData });
  } catch (error) {
    console.error('Error in GET /api/admin/admins:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
