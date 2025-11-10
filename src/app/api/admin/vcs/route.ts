import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// GET /api/admin/vcs - List VCs
export async function GET(_request: NextRequest) {
  // TODO: Implement VC list
  return NextResponse.json({ message: 'Not implemented' }, { status: 501 });
}

// POST /api/admin/vcs - Issue VC
export async function POST(_request: NextRequest) {
  // TODO: Implement VC issuance
  return NextResponse.json({ message: 'Not implemented' }, { status: 501 });
}

// DELETE /api/admin/vcs - Revoke VC
export async function DELETE(_request: NextRequest) {
  // TODO: Implement VC revocation
  return NextResponse.json({ message: 'Not implemented' }, { status: 501 });
}
