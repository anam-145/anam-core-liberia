import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireRole } from '@/lib/auth-middleware';
import { getSession } from '@/lib/auth';
import { apiOk, apiError } from '@/lib/api-response';
import type { USSDStatus } from '@/server/db/entities/User';
import { AdminRole } from '@/server/db/entities/Admin';
import { saveKycFile, deleteAllKycFiles } from '@/lib/file-upload';
import { randomUUID } from 'crypto';
import { AppDataSource } from '@/server/db/datasource';
import { User } from '@/server/db/entities/User';
import { EventParticipant } from '@/server/db/entities/EventParticipant';

/**
 * GET /api/admin/users
 * List users with pagination and filters (SYSTEM_ADMIN, STAFF)
 *
 * Query Parameters:
 * - ussdStatus?: 'NOT_APPLICABLE' | 'PENDING' | 'ACTIVE'
 * - eligibleForEvent?: string (eventId) - Filter users eligible for event registration
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
    const eligibleForEvent = searchParams.get('eligibleForEvent');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined;

    // If filtering for eligibility to register to a specific event
    if (eligibleForEvent) {
      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
      }
      const repo = AppDataSource.getRepository(User);
      // Build query: only active users, not already registered to this event
      const qb = repo
        .createQueryBuilder('u')
        .leftJoin(EventParticipant, 'p', 'p.event_id = :eventId AND p.user_id = u.user_id', {
          eventId: eligibleForEvent,
        })
        .where('u.is_active = true')
        .andWhere('p.id IS NULL') // Not registered to this event yet
        .orderBy('u.name', 'ASC');

      const list = await qb.getMany();
      return apiOk({ users: list, total: list.length });
    }

    // Default: return all users with filters
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
 * Request Body (multipart/form-data):
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
 * - kycDocument: File (PDF, JPG, PNG)
 * - kycFace: File (JPG, PNG)
 *
 * Response:
 * - user: User object
 * - message?: string
 */
export async function POST(request: NextRequest) {
  const authCheck = await requireRole([AdminRole.SYSTEM_ADMIN, AdminRole.STAFF]);
  if (authCheck) return authCheck;

  // 파일 경로 저장용 (에러 시 cleanup)
  let userId: string | null = null; // For cleanup

  try {
    const formData = await request.formData();

    // Extract form fields
    const name = String(formData.get('name') ?? '');
    const phoneNumber = formData.get('phoneNumber') ? String(formData.get('phoneNumber')) : undefined;
    const email = formData.get('email') ? String(formData.get('email')) : undefined;
    const gender = formData.get('gender') ? String(formData.get('gender')) : undefined;
    const dateOfBirth = formData.get('dateOfBirth') ? String(formData.get('dateOfBirth')) : undefined;
    const nationality = formData.get('nationality') ? String(formData.get('nationality')) : undefined;
    const address = formData.get('address') ? String(formData.get('address')) : undefined;
    const registrationType = String(formData.get('registrationType') ?? '') as 'USSD' | 'ANAMWALLET' | 'PAPERVOUCHER';
    const walletAddress = formData.get('walletAddress') ? String(formData.get('walletAddress')) : undefined;
    const password = formData.get('password') ? String(formData.get('password')) : undefined;
    const kycType = formData.get('kycType') ? String(formData.get('kycType')) : undefined;

    // Extract files
    const kycDocument = formData.get('kycDocument');
    const kycFace = formData.get('kycFace');

    const body = {
      name,
      phoneNumber,
      email,
      gender,
      dateOfBirth,
      nationality,
      address,
      registrationType,
      walletAddress,
      password,
      kycType,
    };

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

    // File validation
    if (!(kycDocument instanceof File)) {
      return apiError('KYC document file is required', 400, 'VALIDATION_ERROR');
    }
    if (!(kycFace instanceof File)) {
      return apiError('KYC face photo is required', 400, 'VALIDATION_ERROR');
    }

    // Generate userId for file storage
    userId = `user_${randomUUID()}`;

    // Save files
    let kycDocumentPath: string;
    let kycFacePath: string;

    try {
      const docResult = await saveKycFile({
        file: kycDocument,
        type: 'document',
        userId,
      });
      kycDocumentPath = docResult.path;

      const faceResult = await saveKycFile({
        file: kycFace,
        type: 'face',
        userId,
      });
      kycFacePath = faceResult.path;
    } catch (error) {
      // Cleanup any saved files and folders
      if (userId) {
        await deleteAllKycFiles(userId);
      }

      return apiError(error instanceof Error ? error.message : 'File upload failed', 400, 'VALIDATION_ERROR');
    }

    // Common user data preparation
    const userData = {
      userId, // Use generated userId
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
      kycDocumentPath, // Add file paths
      kycFacePath,
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

    // Cleanup uploaded files and folders on error
    if (userId) {
      await deleteAllKycFiles(userId);
    }

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
