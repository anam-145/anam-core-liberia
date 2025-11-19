import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireRole } from '@/lib/auth-middleware';
import { apiOk, apiError } from '@/lib/api-response';
import { Admin, AdminRole, OnboardingStatus } from '@/server/db/entities/Admin';
import { AppDataSource } from '@/server/db/datasource';
import { VcRegistry, VCStatus } from '@/server/db/entities/VcRegistry';
import { EventStaff } from '@/server/db/entities/EventStaff';

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
export async function GET(request: NextRequest) {
  const authCheck = await requireRole(AdminRole.SYSTEM_ADMIN);
  if (authCheck) return authCheck;

  try {
    const url = new URL(request.url);
    const eligibleForEvent = url.searchParams.get('eligibleForEvent');

    // If filtering for eligibility to assign to a specific event
    if (eligibleForEvent) {
      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
      }
      const repo = AppDataSource.getRepository(Admin);
      // Build query: only STAFF, active, onboarding ACTIVE, has DID/wallet, has ACTIVE ADMIN VC, not already assigned to this event
      const qb = repo
        .createQueryBuilder('a')
        .leftJoin(VcRegistry, 'v', 'v.user_did = a.did AND v.vc_type = :vcType AND v.status = :vStatus', {
          vcType: 'UndpAdminCredential',
          vStatus: VCStatus.ACTIVE,
        })
        .leftJoin(EventStaff, 's', 's.event_id = :eventId AND s.admin_id = a.admin_id', { eventId: eligibleForEvent })
        .where('a.role = :role', { role: AdminRole.STAFF })
        .andWhere('a.is_active = true')
        .andWhere('a.onboarding_status = :os', { os: OnboardingStatus.ACTIVE })
        .andWhere('a.did IS NOT NULL')
        .andWhere('a.wallet_address IS NOT NULL')
        .andWhere('v.id IS NOT NULL') // Has active ADMIN VC
        .andWhere('s.id IS NULL') // Not assigned to this event yet
        .orderBy('a.full_name', 'ASC');

      const list = await qb.getMany();
      const adminsData = list.map(({ passwordHash: _passwordHash, ...admin }) => admin);
      return apiOk({ admins: adminsData });
    }

    // Default: return all admins (existing behavior)
    const admins = await adminService.getAllAdmins();
    const adminsData = admins.map(({ passwordHash: _passwordHash, ...admin }) => admin);
    return apiOk({ admins: adminsData });
  } catch (error) {
    console.error('Error in GET /api/admin/admins:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
