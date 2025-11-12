import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireRole } from '@/lib/auth-middleware';
import { apiOk, apiError } from '@/lib/api-response';
import { AdminRole } from '@/server/db/entities/Admin';
import type { KycStatus } from '@/server/db/entities/User';

/**
 * PUT /api/admin/users/[id]/kyc
 * Update user KYC information (SYSTEM_ADMIN, APPROVER, VERIFIER)
 *
 * Request Body:
 * - kycType?: string
 * - kycDocumentNumber?: string
 * - kycDocumentPath?: string
 * - kycFacePath?: string
 * - kycStatus?: 'PENDING' | 'APPROVED' | 'REJECTED'
 *
 * Response:
 * - user: Updated user object
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const authCheck = await requireRole([AdminRole.SYSTEM_ADMIN, AdminRole.APPROVER, AdminRole.VERIFIER]);
  if (authCheck) return authCheck;

  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return apiError('Invalid user ID', 400, 'VALIDATION_ERROR');
    }

    const body = await request.json();

    const user = await adminService.updateUserKyc(id, {
      kycType: body.kycType,
      kycDocumentNumber: body.kycDocumentNumber,
      kycDocumentPath: body.kycDocumentPath,
      kycFacePath: body.kycFacePath,
      kycStatus: body.kycStatus as KycStatus,
    });

    if (!user) {
      return apiError('User not found', 404, 'NOT_FOUND');
    }

    return apiOk({ user });
  } catch (error) {
    console.error('Error in PUT /api/admin/users/[id]/kyc:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
