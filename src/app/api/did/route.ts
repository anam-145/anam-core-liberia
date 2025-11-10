import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// GET /api/did - Get DID info/Resolve DID
export async function GET(_request: NextRequest) {
  // TODO: Implement DID resolution
  return NextResponse.json({ message: 'Not implemented' }, { status: 501 });
}

// POST /api/did - Create DID
export async function POST(_request: NextRequest) {
  // TODO: Implement DID creation
  return NextResponse.json({ message: 'Not implemented' }, { status: 501 });
}
