import type { NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth-middleware';
import { apiError, apiOk } from '@/lib/api-response';
import { AdminRole } from '@/server/db/entities/Admin';
import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

/**
 * GET /api/admin/files
 * Access: SYSTEM_ADMIN, STAFF (all STAFF can download all files)
 * Download KYC files
 *
 * Note: Currently all STAFF members can download any KYC file.
 * Future enhancement: Restrict to event-assigned participants only.
 *
 * Query Parameters:
 * - path: string (file path from database, e.g., /uploads/kyc-documents/user_xxx/...)
 *
 * Response:
 * - File stream with appropriate Content-Type and Content-Disposition headers
 */
export async function GET(request: NextRequest) {
  const authCheck = await requireRole([AdminRole.SYSTEM_ADMIN, AdminRole.STAFF]);
  if (authCheck) return authCheck;

  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');

    // Validate file path
    if (!filePath) {
      return apiError('File path is required', 400, 'VALIDATION_ERROR');
    }

    // Security: Only allow files from uploads directory
    if (!filePath.startsWith('/uploads/')) {
      return apiError('Invalid file path', 403, 'FORBIDDEN');
    }

    // Remove leading slash and construct absolute path
    const relativePath = filePath.substring(1); // Remove leading '/'
    const absolutePath = path.join(process.cwd(), relativePath);

    // Security: Prevent directory traversal
    const normalizedPath = path.normalize(absolutePath);
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!normalizedPath.startsWith(uploadsDir)) {
      return apiError('Invalid file path', 403, 'FORBIDDEN');
    }

    // Check if file exists
    try {
      await fs.access(absolutePath);
    } catch {
      return apiError('File not found', 404, 'NOT_FOUND');
    }

    // Read file
    const fileBuffer = await fs.readFile(absolutePath);

    // Determine content type from file extension
    const ext = path.extname(absolutePath).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.heic': 'image/heic',
      '.heif': 'image/heif',
      '.webp': 'image/webp',
    };
    const contentType = contentTypeMap[ext] || 'application/octet-stream';

    // Extract filename for download
    const filename = path.basename(absolutePath);

    // Return file with inline display for images, download for others
    const isImage = contentType.startsWith('image/');
    const disposition = isImage ? 'inline' : `attachment; filename="${filename}"`;

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': disposition,
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error in GET /api/admin/files:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}

/**
 * POST /api/admin/files
 * Access: PUBLIC (테스트용 - 인증 제거됨)
 * Upload file (for testing AnamWallet camera API)
 *
 * ⚠️ WARNING: 이 엔드포인트는 테스트용으로 인증이 제거되어 있습니다.
 * ⚠️ 프로덕션 배포 전 반드시 인증을 다시 활성화해야 합니다!
 *
 * Request Body (multipart/form-data):
 * - file: File (or any field name from AnamWallet API)
 *
 * Response:
 * - success: true
 * - url: string (file URL)
 * - path: string (file path)
 * - filename: string
 * - fileSize: number
 */
export async function POST(request: NextRequest) {
  // 🔓 테스트용: 인증 임시 제거
  // const authCheck = await requireRole([AdminRole.SYSTEM_ADMIN, AdminRole.STAFF]);
  // if (authCheck) return authCheck;

  try {
    console.log('📥 [POST /api/admin/files] 파일 업로드 요청 받음');

    const formData = await request.formData();

    // 파일 찾기 (field name이 'file', 'photo', 또는 다른 이름일 수 있음)
    let uploadedFile: File | null = null;
    let fieldName = '';

    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        uploadedFile = value;
        fieldName = key;
        console.log(`📁 파일 발견: field="${fieldName}", name="${uploadedFile.name}", size=${uploadedFile.size}`);
        break;
      }
    }

    if (!uploadedFile) {
      console.error('❌ 파일이 없습니다');
      return apiError('No file uploaded', 400, 'VALIDATION_ERROR');
    }

    // 파일 정보
    const fileSize = uploadedFile.size;
    const originalName = uploadedFile.name;
    const ext = path.extname(originalName).toLowerCase();

    // 파일 타입 검증
    const allowedTypes = ['.jpg', '.jpeg', '.png', '.pdf', '.heic', '.heif', '.webp'];
    if (!allowedTypes.includes(ext)) {
      console.error(`❌ 허용되지 않은 파일 타입: ${ext}`);
      return apiError(`Invalid file type: ${ext}. Allowed: ${allowedTypes.join(', ')}`, 400, 'VALIDATION_ERROR');
    }

    // 파일 크기 검증 (10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (fileSize > maxSize) {
      console.error(`❌ 파일 크기 초과: ${fileSize} bytes`);
      return apiError('File size exceeds 10MB', 400, 'VALIDATION_ERROR');
    }

    // 저장 경로 생성
    const uploadDir = path.join(process.cwd(), 'uploads', 'temp-uploads');
    await fs.mkdir(uploadDir, { recursive: true });

    // 고유 파일명 생성
    const uniqueFilename = `${randomUUID()}${ext}`;
    const filePath = path.join(uploadDir, uniqueFilename);

    // 파일 저장
    const buffer = Buffer.from(await uploadedFile.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    // 파일 URL (상대 경로)
    const relativePath = `/uploads/temp-uploads/${uniqueFilename}`;
    const fullUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}${relativePath}`;

    console.log(`✅ 파일 업로드 성공: ${relativePath}`);

    // AnamWallet API 응답 형식
    return apiOk(
      {
        success: true,
        url: fullUrl,
        path: relativePath,
        filename: uniqueFilename,
        originalName,
        fileSize,
        uploadedAt: new Date().toISOString(),
      },
      201,
    );
  } catch (error) {
    console.error('❌ Error in POST /api/admin/files:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
