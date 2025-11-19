import type { NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth-middleware';
import { apiOk, apiError } from '@/lib/api-response';
import AppDataSource from '@/server/db/datasource';
import { Admin, OnboardingStatus, AdminRole } from '@/server/db/entities/Admin';

/**
 * POST /api/admin/admins/[id]/reject
 * Reject pending/approved admin (SYSTEM_ADMIN only)
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const authCheck = await requireRole(AdminRole.SYSTEM_ADMIN);
  if (authCheck) return authCheck;

  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return apiError('Invalid admin ID', 400, 'VALIDATION_ERROR');
    }

    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    const repo = AppDataSource.getRepository(Admin);
    const admin = await repo.findOne({ where: { id } });
    if (!admin) {
      return apiError('Admin not found', 404, 'NOT_FOUND');
    }

    admin.onboardingStatus = OnboardingStatus.REJECTED;
    admin.isActive = false;
    await repo.save(admin);

    const adminData = {
      id: admin.id,
      adminId: admin.adminId,
      username: admin.username,
      fullName: admin.fullName,
      email: admin.email,
      role: admin.role,
      isActive: admin.isActive,
      onboardingStatus: admin.onboardingStatus,
      did: admin.did,
      walletAddress: admin.walletAddress,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    };
    return apiOk({ admin: adminData });
  } catch (error) {
    console.error('Error in POST /api/admin/admins/[id]/reject:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
