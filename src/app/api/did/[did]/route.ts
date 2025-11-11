import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getDIDDatabaseService } from '@/services/did.db.service';

interface Params {
  params: {
    did: string;
  };
}

// GET /api/did/[did] - Get specific DID Document
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const did = decodeURIComponent(params.did);

    const didService = getDIDDatabaseService();

    const document = await didService.getDIDDocument(did);

    if (!document) {
      return NextResponse.json({ error: 'DID Document not found' }, { status: 404 });
    }

    // Mock blockchain verification
    const isVerified = await didService.verifyOnChain(did);

    return NextResponse.json({
      document,
      verified: isVerified,
      // Additional metadata
      metadata: {
        did,
        retrievedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error in GET /api/did/[did]:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
