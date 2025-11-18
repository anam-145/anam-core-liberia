import type { NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth-middleware';
import { apiError } from '@/lib/api-response';
import { AdminRole } from '@/server/db/entities/Admin';
import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

/**
 * GET /api/admin/files
 * Download KYC files (SYSTEM_ADMIN, STAFF)
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
