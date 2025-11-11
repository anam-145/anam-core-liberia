import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getDIDDatabaseService } from '@/services/did.db.service';

// GET /api/did?address=0x... - Get DID by wallet address
// GET /api/did?did=did:anam:... - Get DID Document
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');
    const did = searchParams.get('did');

    const didService = getDIDDatabaseService();

    if (address) {
      // Get DID by wallet address
      const foundDid = await didService.getDIDByAddress(address);
      if (!foundDid) {
        return NextResponse.json({ error: 'No DID found for this address' }, { status: 404 });
      }
      return NextResponse.json({ did: foundDid });
    }

    if (did) {
      // Get DID Document
      const document = await didService.getDIDDocument(did);
      if (!document) {
        return NextResponse.json({ error: 'DID Document not found' }, { status: 404 });
      }
      return NextResponse.json(document);
    }

    // List all DIDs (for development)
    const type = searchParams.get('type') as 'user' | 'issuer' | null;
    const dids = await didService.listDIDs(type || undefined);
    return NextResponse.json({ dids });
  } catch (error) {
    console.error('Error in GET /api/did:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

// POST /api/did - Create and register DID
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.walletAddress || !body.publicKeyHex || !body.type) {
      return NextResponse.json(
        { error: 'Missing required fields: walletAddress, publicKeyHex, type' },
        { status: 400 },
      );
    }

    if (body.type !== 'user' && body.type !== 'issuer') {
      return NextResponse.json({ error: 'Invalid type. Must be "user" or "issuer"' }, { status: 400 });
    }

    const didService = getDIDDatabaseService();

    const result = await didService.createAndRegisterDID({
      walletAddress: body.walletAddress,
      publicKeyHex: body.publicKeyHex,
      type: body.type,
    });

    return NextResponse.json(
      {
        success: true,
        did: result.did,
        document: result.document,
        documentHash: result.documentHash,
        txHash: result.mockTxHash,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error in POST /api/did:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
