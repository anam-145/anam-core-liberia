import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// GET /api/admin/payments - List payments
export async function GET(_request: NextRequest) {
  // TODO: Implement payment list
  return NextResponse.json({ message: 'Not implemented' }, { status: 501 });
}

// POST /api/admin/payments - Approve/Reject payment
export async function POST(_request: NextRequest) {
  // TODO: Implement payment approval/rejection with Idempotency-Key
  return NextResponse.json({ message: 'Not implemented' }, { status: 501 });
}
