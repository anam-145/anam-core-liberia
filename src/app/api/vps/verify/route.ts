import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getChallengeService } from '@/services/challenge.memory.service';
import { getVCDatabaseService } from '@/services/vc.db.service';
import { getDIDDatabaseService } from '@/services/did.db.service';
import {
  verifyVCSignature,
  verifyVPSignature,
  extractAddressFromDIDDocument,
  type VerifiablePresentation,
} from '@/utils/crypto/did';

/**
 * POST /api/vps/verify
 * VP 종합 검증 엔드포인트
 *
 * Request Body:
 * - vp: object (required) - 검증할 VP (VerifiablePresentation)
 * - challenge: string (required) - 예상 challenge (GET /vps/challenge로 받은 값)
 *
 * Response (성공):
 * - valid: true
 * - checks: object - 상세 검증 결과
 *   - isHolderSignatureValid: boolean - VP 서명 유효성
 *   - isChallengeMatched: boolean - Challenge 일치 여부
 *   - isNotExpired: boolean - VC 만료 확인
 *   - isActiveOnChain: boolean - 온체인 상태 (ACTIVE)
 * - credentialSubject: object - VC 내용 (검증 성공 시)
 *
 * Response (실패):
 * - valid: false
 * - checks: object - 상세 검증 결과
 * - reason: string - 실패 사유
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.vp || !body.challenge) {
      return NextResponse.json({ error: 'Missing required fields: vp, challenge' }, { status: 400 });
    }

    const vp = body.vp as VerifiablePresentation;
    const challenge = body.challenge as string;

    // 검증 결과 객체
    const checks = {
      isStructureValid: false,
      isChallengeMatched: false,
      isHolderSignatureValid: false,
      isIssuerSignatureValid: false,
      isNotExpired: false,
      isActiveOnChain: false,
    };

    let reason = '';

    // Step 1: VP 구조 검증
    if (
      !vp['@context'] ||
      !vp.type ||
      !vp.holder ||
      !vp.verifiableCredential ||
      !Array.isArray(vp.verifiableCredential) ||
      vp.verifiableCredential.length === 0
    ) {
      return NextResponse.json(
        {
          valid: false,
          checks,
          reason: 'Invalid VP structure',
        },
        { status: 400 },
      );
    }
    checks.isStructureValid = true;

    // Extract VC from VP
    const vc = vp.verifiableCredential[0];

    if (!vc) {
      return NextResponse.json(
        {
          valid: false,
          checks,
          reason: 'No VC found in VP',
        },
        { status: 400 },
      );
    }

    // Step 2: Challenge 검증 (일회성 확인 + 매칭)
    const challengeService = getChallengeService();
    try {
      challengeService.verify(challenge); // 일회성 확인 (사용 후 자동으로 used=true)
      checks.isChallengeMatched = vp.proof?.challenge === challenge;

      if (!checks.isChallengeMatched) {
        reason = 'Challenge mismatch';
      }
    } catch (error) {
      // Challenge 검증 실패 (invalid, expired, already used)
      reason = error instanceof Error ? error.message : 'Challenge verification failed';
    }

    if (!checks.isChallengeMatched) {
      return NextResponse.json(
        {
          valid: false,
          checks,
          reason,
        },
        { status: 400 },
      );
    }

    // Step 3: VP holder 서명 검증
    const didService = getDIDDatabaseService();
    const holderDocument = await didService.getDIDDocument(vp.holder);

    if (!holderDocument) {
      return NextResponse.json(
        {
          valid: false,
          checks,
          reason: 'Holder DID not found',
        },
        { status: 404 },
      );
    }

    // Holder의 wallet address 추출 (blockchainAccountId에서)
    const holderWalletAddress = extractAddressFromDIDDocument(holderDocument);

    if (!holderWalletAddress) {
      return NextResponse.json(
        {
          valid: false,
          checks,
          reason: 'Holder wallet address not found in DID document',
        },
        { status: 400 },
      );
    }

    // VP 서명 검증
    checks.isHolderSignatureValid = verifyVPSignature(vp, holderWalletAddress);

    if (!checks.isHolderSignatureValid) {
      return NextResponse.json(
        {
          valid: false,
          checks,
          reason: 'Invalid VP holder signature',
        },
        { status: 400 },
      );
    }

    // Step 4: VC issuer 서명 검증
    const issuerDid = typeof vc.issuer === 'string' ? vc.issuer : vc.issuer.id;
    const issuerDocument = await didService.getDIDDocument(issuerDid);

    if (!issuerDocument) {
      return NextResponse.json(
        {
          valid: false,
          checks,
          reason: 'Issuer DID not found',
        },
        { status: 404 },
      );
    }

    // Issuer의 wallet address 추출 (blockchainAccountId에서)
    const issuerWalletAddress = extractAddressFromDIDDocument(issuerDocument);

    if (!issuerWalletAddress) {
      return NextResponse.json(
        {
          valid: false,
          checks,
          reason: 'Issuer wallet address not found in DID document',
        },
        { status: 400 },
      );
    }

    // VC 서명 검증
    checks.isIssuerSignatureValid = verifyVCSignature(vc, issuerWalletAddress);

    if (!checks.isIssuerSignatureValid) {
      return NextResponse.json(
        {
          valid: false,
          checks,
          reason: 'Invalid VC issuer signature',
        },
        { status: 400 },
      );
    }

    // Step 5: VC 만료 확인
    const now = new Date();
    const expirationDate = vc.expirationDate ? new Date(vc.expirationDate) : null;

    checks.isNotExpired = !expirationDate || now < expirationDate;

    if (!checks.isNotExpired) {
      return NextResponse.json(
        {
          valid: false,
          checks,
          reason: `VC expired at ${expirationDate?.toISOString()}`,
        },
        { status: 400 },
      );
    }

    // Step 6: VC 온체인 상태 확인
    const vcService = getVCDatabaseService();
    const vcId = vc.id;

    checks.isActiveOnChain = await vcService.verifyVCOnChain(vcId);

    if (!checks.isActiveOnChain) {
      const status = await vcService.getVCStatus(vcId);
      return NextResponse.json(
        {
          valid: false,
          checks,
          reason: status === 'REVOKED' ? 'VC has been revoked' : 'VC not found or inactive on-chain',
        },
        { status: 400 },
      );
    }

    // All checks passed
    return NextResponse.json(
      {
        valid: true,
        checks,
        credentialSubject: vc.credentialSubject,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error in POST /api/vps/verify:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
