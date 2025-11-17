import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireRole } from '@/lib/auth-middleware';
import { getSession } from '@/lib/auth';
import { apiOk, apiError } from '@/lib/api-response';
import type { KycStatus, USSDStatus } from '@/server/db/entities/User';
import { AdminRole } from '@/server/db/entities/Admin';

/**
 * GET /api/admin/users
 * List users with pagination and filters (SYSTEM_ADMIN, STAFF)
 *
 * Query Parameters:
 * - kycStatus?: 'PENDING' | 'APPROVED' | 'REJECTED'
 * - ussdStatus?: 'NOT_APPLICABLE' | 'PENDING' | 'ACTIVE'
 * - limit?: number
 * - offset?: number
 *
 * Response:
 * - users: User[]
 * - total: number
 */
export async function GET(request: NextRequest) {
  const authCheck = await requireRole([AdminRole.SYSTEM_ADMIN, AdminRole.STAFF]);
  if (authCheck) return authCheck;

  try {
    const { searchParams } = new URL(request.url);

    const kycStatus = searchParams.get('kycStatus') as KycStatus | undefined;
    const ussdStatus = searchParams.get('ussdStatus') as USSDStatus | undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined;

    const { users, total } = await adminService.getUsers({
      kycStatus,
      ussdStatus,
      limit,
      offset,
    });

    return apiOk({ users, total });
  } catch (error) {
    console.error('Error in GET /api/admin/users:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}

/**
 * POST /api/admin/users
 * Register new user (SYSTEM_ADMIN, STAFF)
 *
 * Request Body:
 * - name: string
 * - phoneNumber: string
 * - email?: string
 * - gender?: string
 * - dateOfBirth?: Date
 * - nationality?: string
 * - address?: string
 * - useUSSD: boolean - Whether this user will use USSD service
 * - kycType?: string
 * - kycDocumentNumber?: string
 *
 * Response:
 * - user: User object
 */
export async function POST(request: NextRequest) {
  const authCheck = await requireRole([AdminRole.SYSTEM_ADMIN, AdminRole.STAFF]);
  if (authCheck) return authCheck;

  try {
    const body = await request.json();

    if (!body.name || !body.phoneNumber || body.useUSSD === undefined) {
      return apiError('Missing required fields: name, phoneNumber, useUSSD', 400, 'VALIDATION_ERROR');
    }

    const session = await getSession();

    const user = await adminService.createUser(
      {
        name: body.name,
        phoneNumber: body.phoneNumber,
        email: body.email,
        gender: body.gender,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
        nationality: body.nationality,
        address: body.address,
        useUSSD: body.useUSSD,
        kycType: body.kycType,
        kycDocumentNumber: body.kycDocumentNumber,
      },
      session.adminId,
    );

    return apiOk({ user }, 201);
  } catch (error) {
    console.error('Error in POST /api/admin/users:', error);
    if (error instanceof Error && error.message.includes('already exists')) {
      return apiError(error.message, 409, 'CONFLICT');
    }
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
