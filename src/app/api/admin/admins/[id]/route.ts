import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireRole } from '@/lib/auth-middleware';
import { apiOk, apiError } from '@/lib/api-response';
import { AdminRole } from '@/server/db/entities/Admin';

/**
 * GET /api/admin/admins/[id]
 * Get admin by ID (SYSTEM_ADMIN only)
 *
 * Response:
 * - admin: Admin object (without passwordHash)
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const authCheck = await requireRole(AdminRole.SYSTEM_ADMIN);
  if (authCheck) return authCheck;

  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return apiError('Invalid admin ID', 400, 'VALIDATION_ERROR');
    }

    const admin = await adminService.getAdminById(id);

    if (!admin) {
      return apiError('Admin not found', 404, 'NOT_FOUND');
    }

    // Remove passwordHash from response
    const { passwordHash: _passwordHash, ...adminData } = admin;

    return apiOk({ admin: adminData });
  } catch (error) {
    console.error('Error in GET /api/admin/admins/[id]:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}

/**
 * PATCH /api/admin/admins/[id]
 * Update admin (SYSTEM_ADMIN only)
 *
 * Request Body:
 * - fullName?: string
 * - email?: string
 * - isActive?: boolean
 *
 * Response:
 * - admin: Admin object (without passwordHash)
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const authCheck = await requireRole(AdminRole.SYSTEM_ADMIN);
  if (authCheck) return authCheck;

  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return apiError('Invalid admin ID', 400, 'VALIDATION_ERROR');
    }

    const body = await request.json();

    const admin = await adminService.updateAdmin(id, {
      fullName: body.fullName,
      email: body.email,
      isActive: body.isActive,
    });

    if (!admin) {
      return apiError('Admin not found', 404, 'NOT_FOUND');
    }

    // Remove passwordHash from response
    const { passwordHash: _passwordHash, ...adminData } = admin;

    return apiOk({ admin: adminData });
  } catch (error) {
    console.error('Error in PATCH /api/admin/admins/[id]:', error);

    // Handle duplicate errors
    if (error instanceof Error && error.message.includes('already exists')) {
      return apiError(error.message, 409, 'CONFLICT');
    }

    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}

/**
 * DELETE /api/admin/admins/[id]
 * Deactivate admin account (SYSTEM_ADMIN only)
 *
 * Response:
 * - success: true
 */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const authCheck = await requireRole(AdminRole.SYSTEM_ADMIN);
  if (authCheck) return authCheck;

  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return apiError('Invalid admin ID', 400, 'VALIDATION_ERROR');
    }

    const admin = await adminService.updateAdmin(id, {
      isActive: false,
    });

    if (!admin) {
      return apiError('Admin not found', 404, 'NOT_FOUND');
    }

    return apiOk({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/admin/admins/[id]:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
