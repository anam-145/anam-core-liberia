import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// GET /api/admin/events - List events
export async function GET(_request: NextRequest) {
  // TODO: Implement event list
  return NextResponse.json({ message: 'Not implemented' }, { status: 501 });
}

// POST /api/admin/events - Create event
export async function POST(_request: NextRequest) {
  // TODO: Implement event creation
  return NextResponse.json({ message: 'Not implemented' }, { status: 501 });
}
