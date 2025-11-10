import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// GET /api/custody - Get custody wallet info
export async function GET(_request: NextRequest) {
  // TODO: Implement custody wallet retrieval
  return NextResponse.json({ message: 'Not implemented' }, { status: 501 });
}

// POST /api/custody - Create custody wallet
export async function POST(_request: NextRequest) {
  // TODO: Implement custody wallet creation
  return NextResponse.json({ message: 'Not implemented' }, { status: 501 });
}
