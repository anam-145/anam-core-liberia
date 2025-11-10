import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// GET /api/wallet - Get wallet info
export async function GET(_request: NextRequest) {
  // TODO: Implement wallet info retrieval
  return NextResponse.json({ message: 'Not implemented' }, { status: 501 });
}

// POST /api/wallet - Create/Sign transaction
export async function POST(_request: NextRequest) {
  // TODO: Implement transaction signing
  return NextResponse.json({ message: 'Not implemented' }, { status: 501 });
}
