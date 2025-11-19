import type { NextRequest } from 'next/server';
import { apiError } from '@/lib/api-response';

// GET /api/wallet - Get wallet info
export async function GET(_request: NextRequest) {
  return apiError('Not implemented', 501, 'INTERNAL_ERROR');
}

// POST /api/wallet - Create/Sign transaction
export async function POST(_request: NextRequest) {
  return apiError('Not implemented', 501, 'INTERNAL_ERROR');
}
