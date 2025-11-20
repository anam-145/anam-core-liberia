import type { NextRequest } from 'next/server';
import { apiError, apiOk } from '@/lib/api-response';
import { getChallengeService } from '@/services/challenge.memory.service';
import { getVCDatabaseService } from '@/services/vc.db.service';
import { getDIDDatabaseService } from '@/services/did.db.service';
import {
  verifyVCSignature,
  verifyVPSignature,
  extractAddressFromDIDDocument,
  type VerifiablePresentation,
} from '@/utils/crypto/did';
import { ethers } from 'ethers';

/**
 * POST /api/mobile/vps/verify
 * 테스트용 VP 검증 API (상세 로그 포함)
 *
 * Request Body:
 * {
 *   "vp": { ...VerifiablePresentation },
 *   "challenge": "0x..."
 * }
 *
 * Response (성공/실패 모두 200 OK, 형식 오류는 4xx):
 * {
 *   "valid": boolean,
 *   "checks": { ... },
 *   "credentialSubject": { ... }?,   // valid:true 인 경우
 *   "reason": "string"?,             // valid:false 인 경우
 *   "debug": ["step 1 ...", "..."]   // 수행된 단계 로그
 * }
 */
export async function POST(request: NextRequest) {
  const debug: string[] = [];
  const checks = {
    isStructureValid: false,
    isChallengeMatched: false,
    isHolderSignatureValid: false,
    isIssuerSignatureValid: false,
    isWithinValidity: false,
    isActiveOnChain: false,
    isSubjectMatchesHolder: false,
  };
  let vpId: string | undefined;

  try {
    const body = await request.json();

    if (!body?.vp || !body?.challenge) {
      return apiError('Missing required fields: vp, challenge', 400, 'VALIDATION_ERROR');
    }

    const vp = body.vp as VerifiablePresentation;
    const challenge = body.challenge as string;
    vpId = (vp as { id?: string }).id;

    console.log('[mobile/vps/verify] start', { vpId, holder: vp?.holder, challenge });
    debug.push('start');

    // Step 1: 구조 검증
    if (
      !vp['@context'] ||
      !vp.type ||
      !vp.holder ||
      !vp.verifiableCredential ||
      !Array.isArray(vp.verifiableCredential) ||
      vp.verifiableCredential.length === 0
    ) {
      debug.push('structure invalid');
      return apiOk({ valid: false, checks, reason: 'Invalid VP structure', debug });
    }
    checks.isStructureValid = true;
    debug.push('structure ok');

    const vc = vp.verifiableCredential[0];
    if (!vc) {
      debug.push('no VC found in VP');
      return apiOk({ valid: false, checks, reason: 'No VC found in VP', debug });
    }

    // Step 2: Challenge 검증 (일회용)
    const challengeService = getChallengeService();
    try {
      challengeService.verify(challenge);
      checks.isChallengeMatched = vp.proof?.challenge === challenge;
      if (!checks.isChallengeMatched) {
        debug.push('challenge mismatch');
        console.warn('[mobile/vps/verify] Challenge mismatch', {
          vpId,
          provided: challenge,
          proofChallenge: vp.proof?.challenge,
        });
        return apiOk({ valid: false, checks, reason: 'Challenge mismatch', debug });
      }
      debug.push('challenge ok');
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Challenge verification failed';
      debug.push(`challenge failed: ${reason}`);
      console.warn('[mobile/vps/verify] Challenge verify failed', { vpId, reason, challenge });
      return apiOk({ valid: false, checks, reason, debug });
    }

    // Step 3: Holder DID 조회 + VP 서명 검증
    const didService = getDIDDatabaseService();
    const holderDocument = await didService.getDIDDocument(vp.holder);
    if (!holderDocument) {
      debug.push('holder DID not found');
      return apiError('Holder DID not found', 404, 'NOT_FOUND');
    }
    const holderWalletAddress = extractAddressFromDIDDocument(holderDocument);
    if (!holderWalletAddress) {
      debug.push('holder wallet missing in DID document');
      return apiError('Holder wallet address not found in DID document', 400, 'VALIDATION_ERROR');
    }
    // Canonical 문자열을 재구성해 로컬 검증용 데이터 확인
    try {
      const vpForVerification = {
        ...vp,
        proof: vp.proof ? { ...vp.proof } : undefined,
      };
      if (vpForVerification.proof) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete vpForVerification.proof.jws;
      }
      const { canonicalStringify } = await import('@/utils/crypto/did');
      const canonical = canonicalStringify(vpForVerification);
      console.log('[mobile/vps/verify] Received VP (raw):', JSON.stringify(vp, null, 2));
      console.log('[mobile/vps/verify] VP Canonical FULL (server recalculated):', canonical);
      console.log('[mobile/vps/verify] holder verification input', {
        vpId,
        holderDid: vp.holder,
        holderWalletAddress,
        canonicalLen: canonical.length,
        canonicalPreview: canonical.slice(0, 180),
      });
    } catch (e) {
      console.warn('[mobile/vps/verify] canonical debug failed', { vpId, error: e });
    }
    const holderSigValid = verifyVPSignature(vp, holderWalletAddress);
    checks.isHolderSignatureValid = holderSigValid;
    if (!checks.isHolderSignatureValid) {
      debug.push('holder signature invalid');
      console.warn('[mobile/vps/verify] Holder signature invalid', {
        vpId,
        holderDid: vp.holder,
        holderWalletAddress,
      });
      return apiOk({ valid: false, checks, reason: 'Invalid VP holder signature', debug });
    }
    debug.push('holder signature ok');

    // Step 4: Issuer DID 조회 + VC 서명 검증
    const issuerDid = typeof vc.issuer === 'string' ? vc.issuer : vc.issuer.id;
    const issuerDocument = await didService.getDIDDocument(issuerDid);
    if (!issuerDocument) {
      debug.push('issuer DID not found');
      return apiError('Issuer DID not found', 404, 'NOT_FOUND');
    }
    const issuerWalletAddress = extractAddressFromDIDDocument(issuerDocument);
    if (!issuerWalletAddress) {
      debug.push('issuer wallet missing in DID document');
      return apiError('Issuer wallet address not found in DID document', 400, 'VALIDATION_ERROR');
    }
    checks.isIssuerSignatureValid = verifyVCSignature(vc, issuerWalletAddress);
    if (!checks.isIssuerSignatureValid) {
      debug.push('issuer signature invalid');
      try {
        const vcForVerification = { ...vc };
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete (vcForVerification as Record<string, unknown>).proof;
        const { canonicalStringify } = await import('@/utils/crypto/did');
        const canonicalVC = canonicalStringify(vcForVerification);
        const recovered = vc.proof?.jws ? ethers.verifyMessage(canonicalVC, vc.proof.jws) : null;
        console.warn('[mobile/vps/verify] Issuer signature invalid', {
          vpId,
          issuerDid,
          issuerWalletAddress,
          recoveredAddress: recovered,
          proofJwsPrefix: vc.proof?.jws?.slice(0, 20),
          canonicalLen: canonicalVC.length,
          canonicalPreview: canonicalVC.slice(0, 160),
        });
      } catch (e) {
        console.warn('[mobile/vps/verify] Issuer signature invalid (debug failed)', { vpId, error: e });
      }
      return apiOk({ valid: false, checks, reason: 'Invalid VC issuer signature', debug });
    }
    debug.push('issuer signature ok');

    // Step 5: VC 유효기간
    const now = new Date();
    const validFrom = vc.validFrom ? new Date(vc.validFrom) : null;
    const validUntil = vc.validUntil ? new Date(vc.validUntil) : null;
    const notBeforeOk = !validFrom || now >= validFrom;
    const notAfterOk = !validUntil || now <= validUntil;
    checks.isWithinValidity = notBeforeOk && notAfterOk;
    if (!checks.isWithinValidity) {
      const reason =
        'VC is out of validity window' +
        (validFrom ? ` (validFrom=${validFrom.toISOString()})` : '') +
        (validUntil ? ` (validUntil=${validUntil.toISOString()})` : '');
      debug.push('validity failed');
      console.warn('[mobile/vps/verify] VC validity failed', { vpId, validFrom, validUntil, now });
      return apiOk({ valid: false, checks, reason, debug });
    }
    debug.push('validity ok');

    // Step 6: VC 온체인 상태 (DB status)
    const vcService = getVCDatabaseService();
    const vcId = vc.id;
    checks.isActiveOnChain = await vcService.verifyVCOnChain(vcId);
    if (!checks.isActiveOnChain) {
      const status = await vcService.getVCStatus(vcId);
      const reason = status === 'REVOKED' ? 'VC has been revoked' : 'VC not found or inactive on-chain';
      debug.push(`vc status inactive: ${reason}`);
      console.warn('[mobile/vps/verify] VC inactive/onchain check failed', { vpId, vcId, status });
      return apiOk({ valid: false, checks, reason, debug });
    }
    debug.push('vc status ok');

    // Step 7: VC subject.id == holder DID
    const vcSubjectId = typeof vc.credentialSubject?.id === 'string' ? (vc.credentialSubject.id as string) : undefined;
    const holderDid = vp.holder;
    checks.isSubjectMatchesHolder = vcSubjectId === holderDid;
    if (!checks.isSubjectMatchesHolder) {
      debug.push('subject-holder mismatch');
      console.warn('[mobile/vps/verify] Subject/holder mismatch', { vpId, vcSubjectId, holderDid });
      return apiOk({ valid: false, checks, reason: 'VC subject DID does not match VP holder DID', debug });
    }
    debug.push('subject-holder ok');

    // All checks passed
    console.log('[mobile/vps/verify] valid VP', { vpId, holder: holderDid, vcId, challenge });
    return apiOk({
      valid: true,
      checks,
      credentialSubject: vc.credentialSubject,
      debug,
    });
  } catch (error) {
    console.error('Error in POST /api/mobile/vps/verify:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
