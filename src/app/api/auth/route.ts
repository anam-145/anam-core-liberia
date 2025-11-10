import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// POST /api/auth - Login
export async function POST(_request: NextRequest) {
  // TODO: Implement login
  return NextResponse.json({ message: 'Not implemented' }, { status: 501 });
}

// DELETE /api/auth - Logout
export async function DELETE(_request: NextRequest) {
  // TODO: Implement logout
  return NextResponse.json({ message: 'Not implemented' }, { status: 501 });
}
