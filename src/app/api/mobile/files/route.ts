import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-response';
import path from 'path';
import { promises as fs } from 'fs';

/**
 * GET /api/mobile/files?path=/uploads/...
 * Mobile-safe file reader (MVP: 토큰 인증 제거)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');

    console.log('[mobile/files] Incoming request', { path: filePath });

    if (!filePath) return apiError('File path is required', 400, 'VALIDATION_ERROR');
    if (!filePath.startsWith('/uploads/')) return apiError('Invalid file path', 403, 'FORBIDDEN');

    const relativePath = filePath.substring(1); // drop leading slash
    const absolutePath = path.join(process.cwd(), relativePath);
    const normalized = path.normalize(absolutePath);
    const uploadsRoot = path.join(process.cwd(), 'uploads');

    if (!normalized.startsWith(uploadsRoot)) {
      return apiError('Invalid file path', 403, 'FORBIDDEN');
    }

    try {
      await fs.access(normalized);
    } catch {
      return apiError('File not found', 404, 'NOT_FOUND');
    }

    const fileBuffer = await fs.readFile(normalized);
    const ext = path.extname(normalized).toLowerCase();
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
    const filename = path.basename(normalized);
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
    console.error('Error in GET /api/mobile/files:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
