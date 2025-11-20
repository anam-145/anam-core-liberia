import type { NextRequest } from 'next/server';
import { apiOk, apiError } from '@/lib/api-response';
import { requireEventRole } from '@/lib/auth-middleware';
import { EventRole } from '@/server/db/entities/EventStaff';
import { AppDataSource } from '@/server/db/datasource';
import { User } from '@/server/db/entities/User';
import { EventParticipant } from '@/server/db/entities/EventParticipant';
import { EventCheckin } from '@/server/db/entities/EventCheckin';
import { getVPSessionService } from '@/services/vp-session.memory.service';
import { getDIDDatabaseService } from '@/services/did.db.service';
import { getVCDatabaseService } from '@/services/vc.db.service';
import { extractAddressFromDIDDocument, verifyVPSignature, verifyVCSignature } from '@/utils/crypto/did';
import { Between } from 'typeorm';

/**
 * POST /api/admin/events/[eventId]/checkins/anamwallet/verify
 *
 * AnamWallet 기반 체크인 검증 엔드포인트
 * - sessionId로 VP를 조회하고 7단계 검증 수행
 * - 비즈니스 검증 실패는 200 OK + { valid:false, reason } 패턴 사용
 *
 * Authentication: requireEventRole(eventId, [APPROVER, VERIFIER])
 *
 * Request Body:
 * {
 *   "sessionId": "abc123def456..."
 * }
 *
 * Response (200):
 * {
 *   "valid": boolean,
 *   "userId"?: string,
 *   "user"?: { id, userId, name, walletAddress, did, kycFacePath },
 *   "checks": { ... },
 *   "reason"?: string
 * }
 */
export async function POST(request: NextRequest, { params }: { params: { eventId: string } }) {
  const authCheck = await requireEventRole(params.eventId, [EventRole.APPROVER, EventRole.VERIFIER]);
  if (authCheck) return authCheck;

  try {
    const body = (await request.json()) as { sessionId?: string };

    if (!body.sessionId || typeof body.sessionId !== 'string') {
      return apiError('Missing required field: sessionId', 400, 'VALIDATION_ERROR');
    }

    const sessionId = body.sessionId;

    const checks = {
      isStructureValid: false,
      isHolderSignatureValid: false,
      isIssuerSignatureValid: false,
      isWithinValidity: false,
      isActiveOnChain: false,
      isSubjectMatchesHolder: false,
      isEventParticipant: false,
      isNotCheckedInToday: false,
    };

    // 1) Retrieve and verify VP session (marks as used but keeps in memory for polling)
    const vpSessionService = getVPSessionService();
    let sessionInfo;
    try {
      sessionInfo = vpSessionService.verifyAndMarkUsed(sessionId);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Failed to retrieve session';
      console.warn('[anamwallet/verify] Session retrieval failed', { sessionId, reason });
      return apiOk({
        valid: false,
        reason,
        checks,
      });
    }

    const vp = sessionInfo.vp;
    const challenge = sessionInfo.challenge;

    console.log('[anamwallet/verify] VP session retrieved', {
      sessionId,
      holder: vp.holder,
      challenge: challenge.slice(0, 20) + '...',
    });

    // 2) VP structure validation
    if (
      !vp['@context'] ||
      !vp.type ||
      !vp.holder ||
      !vp.verifiableCredential ||
      !Array.isArray(vp.verifiableCredential) ||
      vp.verifiableCredential.length === 0
    ) {
      return apiOk({ valid: false, reason: 'Invalid VP structure', checks });
    }
    checks.isStructureValid = true;

    const vc = vp.verifiableCredential[0];
    if (!vc) {
      return apiOk({ valid: false, reason: 'No VC found in VP', checks });
    }

    // 3) Holder signature verification
    const didService = getDIDDatabaseService();
    const holderDocument = await didService.getDIDDocument(vp.holder);
    if (!holderDocument) {
      return apiError('Holder DID not found', 404, 'NOT_FOUND');
    }
    const holderWalletAddress = extractAddressFromDIDDocument(holderDocument);
    if (!holderWalletAddress) {
      return apiError('Holder wallet address not found in DID document', 400, 'VALIDATION_ERROR');
    }

    checks.isHolderSignatureValid = verifyVPSignature(vp, holderWalletAddress);
    if (!checks.isHolderSignatureValid) {
      console.warn('[anamwallet/verify] Holder signature invalid', { holder: vp.holder, holderWalletAddress });
      return apiOk({ valid: false, checks, reason: 'Invalid VP holder signature' });
    }

    // 4) Issuer signature verification
    const issuerDid = typeof vc.issuer === 'string' ? vc.issuer : vc.issuer.id;
    const issuerDocument = await didService.getDIDDocument(issuerDid);
    if (!issuerDocument) {
      return apiError('Issuer DID not found', 404, 'NOT_FOUND');
    }
    const issuerWalletAddress = extractAddressFromDIDDocument(issuerDocument);
    if (!issuerWalletAddress) {
      return apiError('Issuer wallet address not found in DID document', 400, 'VALIDATION_ERROR');
    }

    checks.isIssuerSignatureValid = verifyVCSignature(vc, issuerWalletAddress);
    if (!checks.isIssuerSignatureValid) {
      console.warn('[anamwallet/verify] Issuer signature invalid', { issuer: issuerDid, issuerWalletAddress });
      return apiOk({ valid: false, checks, reason: 'Invalid VC issuer signature' });
    }

    // 5) VC validity period check
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
      console.warn('[anamwallet/verify] VC validity failed', { validFrom, validUntil, now });
      return apiOk({ valid: false, checks, reason });
    }

    // 6) VC on-chain status check
    const vcService = getVCDatabaseService();
    const vcId = vc.id;
    checks.isActiveOnChain = await vcService.verifyVCOnChain(vcId);
    if (!checks.isActiveOnChain) {
      const status = await vcService.getVCStatus(vcId);
      const reason = status === 'REVOKED' ? 'VC has been revoked' : 'VC not found or inactive on-chain';
      console.warn('[anamwallet/verify] VC inactive/onchain check failed', { vcId, status });
      return apiOk({ valid: false, checks, reason });
    }

    // 7) VC subject.id == holder DID
    const vcSubjectId = typeof vc.credentialSubject?.id === 'string' ? (vc.credentialSubject.id as string) : undefined;
    const holderDid = vp.holder;
    checks.isSubjectMatchesHolder = vcSubjectId === holderDid;
    if (!checks.isSubjectMatchesHolder) {
      console.warn('[anamwallet/verify] Subject/holder mismatch', { vcSubjectId, holderDid });
      return apiOk({ valid: false, checks, reason: 'VC subject DID does not match VP holder DID' });
    }

    // 8) Check event participant
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const userRepository = AppDataSource.getRepository(User);
    const participantRepository = AppDataSource.getRepository(EventParticipant);

    const user = await userRepository.findOne({
      where: { walletAddress: holderWalletAddress },
    });

    if (!user) {
      return apiOk({
        valid: false,
        reason: '사용자를 찾을 수 없습니다',
        checks,
      });
    }

    const participant = await participantRepository.findOne({
      where: {
        eventId: params.eventId,
        userId: user.userId,
      },
    });

    if (!participant) {
      return apiOk({
        valid: false,
        reason: '이 이벤트 참가자가 아닙니다',
        checks,
      });
    }

    checks.isEventParticipant = true;

    // 9) Check if already checked in today (UTC-based)
    const checkinRepository = AppDataSource.getRepository(EventCheckin);
    const nowUtc = new Date();
    const startOfDayUtc = new Date(
      Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate(), 0, 0, 0),
    );
    const endOfDayUtc = new Date(
      Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate(), 23, 59, 59, 999),
    );

    const existingCheckin = await checkinRepository.findOne({
      where: {
        eventId: params.eventId,
        userId: user.userId,
        checkedInAt: Between(startOfDayUtc, endOfDayUtc),
      },
    });

    if (existingCheckin) {
      return apiOk({
        valid: false,
        reason: '오늘 이미 체크인했습니다',
        checks,
      });
    }

    checks.isNotCheckedInToday = true;

    // All checks passed
    console.log('[anamwallet/verify] Valid VP', { sessionId, userId: user.userId, holder: holderDid, vcId });

    return apiOk({
      valid: true,
      userId: user.userId,
      user: {
        id: user.id,
        userId: user.userId,
        name: user.name,
        walletAddress: user.walletAddress,
        did: holderDid,
        kycFacePath: user.kycFacePath,
      },
      checks,
    });
  } catch (error) {
    console.error('Error in POST /api/admin/events/[eventId]/checkins/anamwallet/verify:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
