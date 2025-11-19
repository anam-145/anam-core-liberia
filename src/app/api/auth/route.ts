import type { NextRequest } from 'next/server';
import { apiError } from '@/lib/api-response';

// POST /api/auth - Login
export async function POST(_request: NextRequest) {
  return apiError('Not implemented', 501, 'INTERNAL_ERROR');
}

// DELETE /api/auth - Logout
export async function DELETE(_request: NextRequest) {
  return apiError('Not implemented', 501, 'INTERNAL_ERROR');
}
