import type { NextRequest } from 'next/server';
import { apiOk, apiError } from '@/lib/api-response';
import { requireEventRole } from '@/lib/auth-middleware';
import { EventRole } from '@/server/db/entities/EventStaff';
import { AppDataSource } from '@/server/db/datasource';
import { User, USSDStatus } from '@/server/db/entities/User';
import { EventParticipant } from '@/server/db/entities/EventParticipant';
import { custodyService } from '@/services/custody.db.service';
import { decryptVault } from '@/utils/crypto/vault';
import { createWalletFromMnemonic } from '@/utils/crypto/wallet';
import {
  extractAddressFromDIDDocument,
  type VerifiableCredential,
  verifyVCSignature,
  createVP,
  signVP,
  verifyVPSignature,
} from '@/utils/crypto/did';
import { getVCDatabaseService } from '@/services/vc.db.service';
import { getDIDDatabaseService } from '@/services/did.db.service';

/**
 * POST /api/admin/events/[eventId]/checkins/ussd/verify
 *
 * USSD 기반 체크인 전용 검증 엔드포인트
 * - 전화번호 + PIN을 받아 custody에서 vault 조회 후 검증 수행
 * - Paper Voucher와 동일한 VP 검증 로직 사용
 *
 * Request Body:
 * - phoneNumber: string (required)
 * - pin: string (required, 4-6 digits)
 *
 * Authentication: requireEventRole(eventId, [APPROVER, VERIFIER])
 */
export async function POST(request: NextRequest, { params }: { params: { eventId: string } }) {
  const authCheck = await requireEventRole(params.eventId, [EventRole.APPROVER, EventRole.VERIFIER]);
  if (authCheck) return authCheck;

  try {
    const body = (await request.json()) as { phoneNumber?: string; pin?: string };

    const { phoneNumber, pin } = body;

    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return apiError('Missing required field: phoneNumber', 400, 'VALIDATION_ERROR');
    }

    if (!pin || typeof pin !== 'string') {
      return apiError('Missing required field: pin', 400, 'VALIDATION_ERROR');
    }

    if (!/^\d{4,6}$/.test(pin)) {
      return apiError('PIN must be 4-6 digits', 400, 'VALIDATION_ERROR');
    }

    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const userRepository = AppDataSource.getRepository(User);
    const participantRepository = AppDataSource.getRepository(EventParticipant);

    const checks: {
      isEventParticipant: boolean;
      isPinCorrect?: boolean;
      isWalletAddressMatched?: boolean;
      isVCSignatureValid?: boolean;
      isVCActiveOnChain?: boolean;
      isWithinValidity?: boolean;
      isVPValid?: boolean;
    } = {
      isEventParticipant: false,
    };

    // 1) 사용자 조회 (전화번호)
    const user = await userRepository.findOne({
      where: { phoneNumber },
    });

    if (!user) {
      return apiOk({
        valid: false,
        reason: 'User not found with this phone number',
        checks,
      });
    }

    // USSD 활성 상태 확인
    if (user.ussdStatus !== USSDStatus.ACTIVE) {
      return apiOk({
        valid: false,
        reason: 'User USSD is not active',
        checks,
      });
    }

    // 2) 이벤트 참가 여부 검증
    const participant = await participantRepository.findOne({
      where: {
        eventId: params.eventId,
        userId: user.userId,
      },
    });

    if (!participant) {
      return apiOk({
        valid: false,
        reason: 'User is not a participant of this event',
        checks,
      });
    }

    checks.isEventParticipant = true;

    // 3) Custody에서 vault 조회
    const custody = await custodyService.getCustodyByUserId(user.userId);

    if (!custody) {
      return apiOk({
        valid: false,
        reason: 'Custody wallet not found',
        checks,
      });
    }

    // 4) PIN으로 vault 복호화 (인증)
    let mnemonic: string;
    try {
      mnemonic = decryptVault(custody.vault, pin);
      checks.isPinCorrect = true;
    } catch {
      checks.isPinCorrect = false;
      return apiOk({
        valid: false,
        reason: 'Invalid PIN',
        checks,
      });
    }

    const wallet = createWalletFromMnemonic(mnemonic);
    const derivedAddress = wallet.address;

    // 지갑 주소 일치 확인
    if (derivedAddress.toLowerCase() !== user.walletAddress?.toLowerCase()) {
      checks.isWalletAddressMatched = false;
      return apiOk({
        valid: false,
        reason: 'Wallet address mismatch',
        checks,
      });
    }

    checks.isWalletAddressMatched = true;

    // 5) VC 복호화 및 검증
    if (!custody.vc) {
      return apiOk({
        valid: false,
        reason: 'VC not found in custody',
        checks,
      });
    }

    let vcPlain: string;
    try {
      vcPlain = decryptVault(custody.vc, pin);
    } catch {
      return apiOk({
        valid: false,
        reason: 'Failed to decrypt VC',
        checks,
      });
    }

    let vc: VerifiableCredential;
    try {
      vc = JSON.parse(vcPlain) as VerifiableCredential;
    } catch {
      return apiOk({
        valid: false,
        reason: 'Failed to parse VC JSON',
        checks,
      });
    }

    const didService = getDIDDatabaseService();
    const vcService = getVCDatabaseService();

    // Holder DID 확인
    const holderDid = typeof vc.credentialSubject?.id === 'string' ? (vc.credentialSubject.id as string) : null;
    if (!holderDid) {
      return apiOk({
        valid: false,
        reason: 'VC credentialSubject.id (holder DID) not found',
        checks,
      });
    }

    const holderDoc = await didService.getDIDDocument(holderDid);
    if (!holderDoc) {
      return apiOk({
        valid: false,
        reason: 'Holder DID Document not found',
        checks,
      });
    }

    const holderAddressFromDid = extractAddressFromDIDDocument(holderDoc);
    if (!holderAddressFromDid) {
      return apiOk({
        valid: false,
        reason: 'Holder DID Document has no wallet address',
        checks,
      });
    }

    if (holderAddressFromDid.toLowerCase() !== derivedAddress.toLowerCase()) {
      return apiOk({
        valid: false,
        reason: 'Holder DID and wallet address mismatch',
        checks,
      });
    }

    // Issuer DID & VC 서명 검증
    const issuerDid = typeof vc.issuer === 'string' ? (vc.issuer as string) : vc.issuer?.id;
    if (!issuerDid) {
      return apiOk({
        valid: false,
        reason: 'VC issuer DID not found',
        checks,
      });
    }

    const issuerDoc = await didService.getDIDDocument(issuerDid);
    if (!issuerDoc) {
      return apiOk({
        valid: false,
        reason: 'Issuer DID Document not found',
        checks,
      });
    }

    const issuerAddress = extractAddressFromDIDDocument(issuerDoc);
    if (!issuerAddress) {
      return apiOk({
        valid: false,
        reason: 'Issuer DID Document has no wallet address',
        checks,
      });
    }

    const isVCSignatureValid = verifyVCSignature(vc, issuerAddress);
    checks.isVCSignatureValid = isVCSignatureValid;
    if (!isVCSignatureValid) {
      return apiOk({
        valid: false,
        reason: 'VC issuer signature is invalid',
        checks,
      });
    }

    // VC 온체인 상태 확인
    const isVCActiveOnChain = await vcService.verifyVCOnChain(vc.id);
    checks.isVCActiveOnChain = isVCActiveOnChain;
    if (!isVCActiveOnChain) {
      const status = await vcService.getVCStatus(vc.id);
      const reason =
        status === 'REVOKED'
          ? 'VC has been revoked'
          : status === 'SUSPENDED'
            ? 'VC is suspended'
            : 'VC is not active on-chain';
      return apiOk({
        valid: false,
        reason,
        checks,
      });
    }

    // 유효기간 확인
    const now = new Date();
    const validFrom = vc.validFrom ? new Date(vc.validFrom) : null;
    const validUntil = vc.validUntil ? new Date(vc.validUntil) : null;
    const notBeforeOk = !validFrom || now >= validFrom;
    const notAfterOk = !validUntil || now <= validUntil;
    checks.isWithinValidity = notBeforeOk && notAfterOk;

    if (!checks.isWithinValidity) {
      return apiOk({
        valid: false,
        reason: 'VC is outside validity period',
        checks,
      });
    }

    // 6) VP 생성 및 자체 검증
    const challenge = '0xussd_internal_challenge';
    const vp = createVP(holderDid, [vc], challenge);
    const signedVP = await signVP(vp, wallet.privateKey);

    const isVPValid = verifyVPSignature(signedVP, derivedAddress);
    checks.isVPValid = isVPValid;

    if (!isVPValid) {
      return apiOk({
        valid: false,
        reason: 'VP verification failed',
        checks,
      });
    }

    // 모든 검증 통과
    console.log(`✅ USSD check-in verified: ${phoneNumber} → ${user.walletAddress}`);

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
    console.error('Error in POST /api/admin/events/[eventId]/checkins/ussd/verify:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
