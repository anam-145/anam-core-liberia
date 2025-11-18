import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireRole } from '@/lib/auth-middleware';
import { getSession } from '@/lib/auth';
import { apiOk, apiError } from '@/lib/api-response';
import type { USSDStatus } from '@/server/db/entities/User';
import { AdminRole } from '@/server/db/entities/Admin';

/**
 * GET /api/admin/users
 * List users with pagination and filters (SYSTEM_ADMIN, STAFF)
 *
 * Query Parameters:
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

    const ussdStatus = searchParams.get('ussdStatus') as USSDStatus | undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined;

    const { users, total } = await adminService.getUsers({
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
 * - phoneNumber?: string (required for USSD)
 * - email?: string
 * - gender?: string
 * - dateOfBirth?: Date
 * - nationality?: string
 * - address?: string
 * - registrationType: 'ANAMWALLET' | 'USSD' | 'PAPERVOUCHER'
 * - walletAddress?: string (required for AnamWallet)
 * - kycType?: string
 *
 * Response:
 * - user: User object
 * - message?: string
 */
export async function POST(request: NextRequest) {
  const authCheck = await requireRole([AdminRole.SYSTEM_ADMIN, AdminRole.STAFF]);
  if (authCheck) return authCheck;

  try {
    const body = await request.json();

    // Basic validation
    if (!body.name || !body.registrationType) {
      return apiError('Missing required fields: name, registrationType', 400, 'VALIDATION_ERROR');
    }

    // Registration type specific validation
    if (body.registrationType === 'USSD' && !body.phoneNumber) {
      return apiError('Phone number is required for USSD wallet', 400, 'VALIDATION_ERROR');
    }

    if (body.registrationType === 'ANAMWALLET' && !body.walletAddress) {
      return apiError('Wallet address is required for AnamWallet', 400, 'VALIDATION_ERROR');
    }

    const session = await getSession();

    // Map registration type to appropriate message
    const registrationMessages: Record<string, string> = {
      ANAMWALLET: '사용자가 등록되었습니다. 앱에서 활성화를 진행해주세요.',
      USSD: 'USSD 사용자가 등록되었습니다. PIN 설정을 기다리고 있습니다.',
      PAPERVOUCHER: '종이 바우처 사용자가 등록되었습니다.',
    };

    // Paper Voucher requires password
    if (body.registrationType === 'PAPERVOUCHER' && !body.password) {
      return apiError('Password is required for Paper Voucher', 400, 'VALIDATION_ERROR');
    }

    // Common user data preparation
    const userData = {
      name: body.name,
      phoneNumber: body.phoneNumber,
      email: body.email,
      gender: body.gender,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
      nationality: body.nationality,
      address: body.address,
      // USSD and Paper Voucher don't have wallet address initially
      walletAddress: body.registrationType === 'ANAMWALLET' ? body.walletAddress : undefined,
      password: body.registrationType === 'PAPERVOUCHER' ? body.password : undefined,
      registrationType: body.registrationType,
      kycType: body.kycType,
    };

    // Create user with appropriate registration type
    const result = await adminService.createUserWithRegistrationType(userData, session.adminId);

    // Paper Voucher returns additional QR data
    if (body.registrationType === 'PAPERVOUCHER' && 'qrData' in result) {
      return apiOk(
        {
          user: result,
          qrData: result.qrData,
          message: '종이 바우처 사용자가 등록되었습니다. QR 코드를 인쇄하여 전달하세요.',
        },
        201,
      );
    }

    return apiOk(
      {
        user: result,
        message: registrationMessages[body.registrationType] || '사용자가 등록되었습니다.',
      },
      201,
    );
  } catch (error) {
    console.error('Error in POST /api/admin/users:', error);

    // Handle duplicate errors with user-friendly messages
    if (error instanceof Error) {
      // Phone number duplicate
      if (error.message.includes('Phone number already exists')) {
        return apiError('이미 등록된 전화번호입니다.', 409, 'CONFLICT', { field: 'phoneNumber' });
      }

      // Wallet address duplicate
      if (error.message.includes('Wallet address already exists')) {
        return apiError('이미 등록된 지갑 주소입니다.', 409, 'CONFLICT', { field: 'walletAddress' });
      }

      // Database unique constraint errors (TypeORM)
      if (error.message.includes('Duplicate entry') || error.message.includes('Duplicate key')) {
        if (error.message.includes('phone_number')) {
          return apiError('이미 등록된 전화번호입니다.', 409, 'CONFLICT', { field: 'phoneNumber' });
        }
        if (error.message.includes('wallet_address')) {
          return apiError('이미 등록된 지갑 주소입니다.', 409, 'CONFLICT', { field: 'walletAddress' });
        }
        return apiError('중복된 정보가 있습니다. 입력 정보를 확인해주세요.', 409, 'CONFLICT');
      }

      // Other known errors
      if (error.message.includes('already exists')) {
        return apiError(error.message, 409, 'CONFLICT');
      }
    }

    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
