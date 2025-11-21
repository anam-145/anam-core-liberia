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
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Helper: Copy temp file to KYC storage
 * /uploads/temp-uploads/abc.jpg → /uploads/kyc-documents/user_xxx/document_abc.jpg
 */
async function copyTempFileToKyc(tempPath: string, type: 'document' | 'face', userId: string): Promise<string> {
  // 임시 파일 경로 검증
  if (!tempPath.startsWith('/uploads/temp-uploads/')) {
    throw new Error('Invalid temp file path');
  }

  // 절대 경로 변환
  const tempAbsolutePath = path.join(process.cwd(), tempPath.substring(1)); // Remove leading /

  // 파일 존재 확인
  try {
    await fs.access(tempAbsolutePath);
  } catch {
    throw new Error(`Temp file not found: ${tempPath}`);
  }

  // KYC 저장 경로 생성
  const kycDir = path.join(process.cwd(), 'uploads', 'kyc-documents', userId);
  await fs.mkdir(kycDir, { recursive: true });

  // 파일 확장자 추출
  const ext = path.extname(tempPath);
  const targetFilename = `${type}_${randomUUID()}${ext}`;
  const targetPath = path.join(kycDir, targetFilename);

  // 파일 복사
  await fs.copyFile(tempAbsolutePath, targetPath);

  // 상대 경로 반환 (DB 저장용)
  const relativePath = `/uploads/kyc-documents/${userId}/${targetFilename}`;

  console.log(`📋 임시 파일 복사 완료: ${tempPath} → ${relativePath}`);

  return relativePath;
}

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

    /**
     * Extract files or paths (카메라 업로드)
     *
     * 두 가지 방식 지원:
     * 1. kycDocument / kycFace: File 객체 (파일 선택)
     * 2. kycDocumentPath / kycFacePath: string (카메라 촬영 → 임시 경로)
     *
     * 우선순위: 경로 > 파일 (최신 선택이 우선)
     */
    const kycDocument = formData.get('kycDocument');
    const kycFace = formData.get('kycFace');
    const kycDocumentPath = formData.get('kycDocumentPath') ? String(formData.get('kycDocumentPath')) : undefined;
    const kycFacePath = formData.get('kycFacePath') ? String(formData.get('kycFacePath')) : undefined;

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
      ANAMWALLET: 'User registered. Please proceed with activation in the app.',
      USSD: 'USSD user registered. Waiting for PIN setup.',
      PAPERVOUCHER: 'Paper voucher user registered.',
    };

    // Paper Voucher requires password
    if (body.registrationType === 'PAPERVOUCHER' && !body.password) {
      return apiError('Password is required for Paper Voucher', 400, 'VALIDATION_ERROR');
    }

    // File validation (파일 또는 경로 중 하나는 필수)
    if (!(kycDocument instanceof File) && !kycDocumentPath) {
      return apiError('KYC document file is required', 400, 'VALIDATION_ERROR');
    }
    if (!(kycFace instanceof File) && !kycFacePath) {
      return apiError('KYC face photo is required', 400, 'VALIDATION_ERROR');
    }

    // Generate userId for file storage
    userId = `user_${randomUUID()}`;

    /**
     * Save files
     *
     * 파일 처리 방식:
     * 1. kycDocumentPath 있음 → copyTempFileToKyc (임시 파일 복사)
     * 2. kycDocument 있음 → saveKycFile (직접 저장)
     * 3. 둘 다 없음 → 에러
     *
     * 최종 경로: /uploads/kyc-documents/user_xxx/document_yyy.jpg
     */
    let finalKycDocumentPath: string;
    let finalKycFacePath: string;

    try {
      // ID Document 처리
      if (kycDocumentPath) {
        // 카메라로 촬영된 파일 복사 (temp → kyc)
        finalKycDocumentPath = await copyTempFileToKyc(kycDocumentPath, 'document', userId);
      } else if (kycDocument instanceof File) {
        // 파일 선택으로 직접 업로드
        const docResult = await saveKycFile({
          file: kycDocument,
          type: 'document',
          userId,
        });
        finalKycDocumentPath = docResult.path;
      } else {
        throw new Error('No KYC document provided');
      }

      // Face Photo 처리
      if (kycFacePath) {
        // 카메라로 촬영된 파일 복사 (temp → kyc)
        finalKycFacePath = await copyTempFileToKyc(kycFacePath, 'face', userId);
      } else if (kycFace instanceof File) {
        // 파일 선택으로 직접 업로드
        const faceResult = await saveKycFile({
          file: kycFace,
          type: 'face',
          userId,
        });
        finalKycFacePath = faceResult.path;
      } else {
        throw new Error('No KYC face photo provided');
      }
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
      kycDocumentPath: finalKycDocumentPath, // 최종 파일 경로
      kycFacePath: finalKycFacePath, // 최종 파일 경로
    };

    // Create user with appropriate registration type
    const result = await adminService.createUserWithRegistrationType(userData, session.adminId);

    // Paper Voucher returns additional QR data
    if (body.registrationType === 'PAPERVOUCHER' && 'qrData' in result) {
      return apiOk(
        {
          user: result,
          qrData: result.qrData,
          message: 'Paper voucher user registered. Please print the QR code and deliver it.',
        },
        201,
      );
    }

    return apiOk(
      {
        user: result,
        message: registrationMessages[body.registrationType] || 'User registered.',
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
        return apiError('Phone number already registered.', 409, 'CONFLICT', { field: 'phoneNumber' });
      }

      // Wallet address duplicate
      if (error.message.includes('Wallet address already exists')) {
        return apiError('Wallet address already registered.', 409, 'CONFLICT', { field: 'walletAddress' });
      }

      // Database unique constraint errors (TypeORM)
      if (error.message.includes('Duplicate entry') || error.message.includes('Duplicate key')) {
        if (error.message.includes('phone_number')) {
          return apiError('Phone number already registered.', 409, 'CONFLICT', { field: 'phoneNumber' });
        }
        if (error.message.includes('wallet_address')) {
          return apiError('Wallet address already registered.', 409, 'CONFLICT', { field: 'walletAddress' });
        }
        return apiError('Duplicate information found. Please check your input.', 409, 'CONFLICT');
      }

      // Other known errors
      if (error.message.includes('already exists')) {
        return apiError(error.message, 409, 'CONFLICT');
      }
    }

    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
