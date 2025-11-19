import type { NextRequest } from 'next/server';
import { apiOk, apiError } from '@/lib/api-response';
import { requireEventRole } from '@/lib/auth-middleware';
import { EventRole } from '@/server/db/entities/EventStaff';
import { AppDataSource } from '@/server/db/datasource';
import { User } from '@/server/db/entities/User';
import { EventParticipant } from '@/server/db/entities/EventParticipant';
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

interface PaperVoucherVault {
  ciphertext: string;
  iv: string;
  salt: string;
  authTag: string;
}

interface PaperVoucherVCVault extends PaperVoucherVault {
  id: string;
}

interface PaperVoucherPayload {
  address: string;
  vault: PaperVoucherVault;
  vc: PaperVoucherVCVault;
}

/**
 * POST /api/admin/events/[eventId]/checkins/paper-voucher/verify
 *
 * Paper Voucher 기반 체크인 전용 검증 엔드포인트
 * - QR payload + 비밀번호를 받아 참가자/VC/VP 검증을 수행
 * - 비즈니스 검증 실패는 200 OK + { valid:false, reason } 패턴을 사용
 *
 * Authentication: requireEventRole(eventId, [APPROVER, VERIFIER])
 */
export async function POST(request: NextRequest, { params }: { params: { eventId: string } }) {
  const authCheck = await requireEventRole(params.eventId, [EventRole.APPROVER, EventRole.VERIFIER]);
  if (authCheck) return authCheck;

  try {
    const body = (await request.json()) as { payload?: PaperVoucherPayload; password?: string };

    const payload = body.payload;
    const password = body.password;

    if (!payload || typeof payload !== 'object') {
      return apiError('Missing or invalid payload', 400, 'VALIDATION_ERROR');
    }

    if (!password || typeof password !== 'string') {
      return apiError('Missing required field: password', 400, 'VALIDATION_ERROR');
    }

    if (!payload.address || typeof payload.address !== 'string') {
      return apiError('Missing required field: payload.address', 400, 'VALIDATION_ERROR');
    }

    if (
      !payload.vault ||
      !payload.vault.ciphertext ||
      !payload.vault.iv ||
      !payload.vault.salt ||
      !payload.vault.authTag
    ) {
      return apiError(
        'Invalid payload.vault structure. Required: { ciphertext, iv, salt, authTag }',
        400,
        'VALIDATION_ERROR',
      );
    }

    if (
      !payload.vc ||
      !payload.vc.id ||
      !payload.vc.ciphertext ||
      !payload.vc.iv ||
      !payload.vc.salt ||
      !payload.vc.authTag
    ) {
      return apiError(
        'Invalid payload.vc structure. Required: { id, ciphertext, iv, salt, authTag }',
        400,
        'VALIDATION_ERROR',
      );
    }

    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const userRepository = AppDataSource.getRepository(User);
    const participantRepository = AppDataSource.getRepository(EventParticipant);

    const checks: {
      isEventParticipant: boolean;
      isPasswordCorrect?: boolean;
      isWalletAddressMatched?: boolean;
      isVCSignatureValid?: boolean;
      isVCActiveOnChain?: boolean;
      isWithinValidity?: boolean;
      isVPValid?: boolean;
    } = {
      isEventParticipant: false,
    };

    // 1) 이벤트 참가 여부 검증 (우선순위 1)
    const user = await userRepository.findOne({
      where: { walletAddress: payload.address },
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

    // 2) Vault 복호화 (비밀번호 검증 + 지갑 재구성)
    let mnemonic: string;
    try {
      mnemonic = decryptVault(payload.vault, password);
      checks.isPasswordCorrect = true;
    } catch {
      checks.isPasswordCorrect = false;
      return apiOk({
        valid: false,
        reason: '비밀번호가 올바르지 않습니다',
        checks,
      });
    }

    const wallet = createWalletFromMnemonic(mnemonic);
    const derivedAddress = wallet.address;

    if (derivedAddress.toLowerCase() !== payload.address.toLowerCase()) {
      checks.isWalletAddressMatched = false;
      return apiOk({
        valid: false,
        reason: '지갑 주소 불일치',
        checks,
      });
    }

    checks.isWalletAddressMatched = true;

    // 3) VC 복호화 및 서명/상태 검증
    let vcPlain: string;
    try {
      vcPlain = decryptVault(payload.vc, password);
    } catch {
      return apiOk({
        valid: false,
        reason: 'VC 복호화에 실패했습니다',
        checks,
      });
    }

    let vc: VerifiableCredential;
    try {
      vc = JSON.parse(vcPlain) as VerifiableCredential;
    } catch {
      return apiOk({
        valid: false,
        reason: 'VC JSON 파싱에 실패했습니다',
        checks,
      });
    }

    // VC ID 일치 여부 (payload.vc.id와 VC.id)
    if (!vc.id || vc.id !== payload.vc.id) {
      return apiOk({
        valid: false,
        reason: 'VC ID가 QR 페이로드와 일치하지 않습니다',
        checks,
      });
    }

    const didService = getDIDDatabaseService();
    const vcService = getVCDatabaseService();

    // Holder DID (credentialSubject.id) → DID Document에서 address 추출 후 wallet 주소와 일치 확인
    const holderDid = typeof vc.credentialSubject?.id === 'string' ? (vc.credentialSubject.id as string) : null;
    if (!holderDid) {
      return apiOk({
        valid: false,
        reason: 'VC credentialSubject.id (holder DID)가 없습니다',
        checks,
      });
    }

    const holderDoc = await didService.getDIDDocument(holderDid);
    if (!holderDoc) {
      return apiOk({
        valid: false,
        reason: 'Holder DID Document를 찾을 수 없습니다',
        checks,
      });
    }

    const holderAddressFromDid = extractAddressFromDIDDocument(holderDoc);
    if (!holderAddressFromDid) {
      return apiOk({
        valid: false,
        reason: 'Holder DID Document에 wallet address가 없습니다',
        checks,
      });
    }

    if (holderAddressFromDid.toLowerCase() !== derivedAddress.toLowerCase()) {
      return apiOk({
        valid: false,
        reason: 'Holder DID와 지갑 주소가 일치하지 않습니다',
        checks,
      });
    }

    // Issuer DID & VC 서명 검증
    const issuerDid = typeof vc.issuer === 'string' ? (vc.issuer as string) : vc.issuer?.id;
    if (!issuerDid) {
      return apiOk({
        valid: false,
        reason: 'VC issuer DID가 없습니다',
        checks,
      });
    }

    const issuerDoc = await didService.getDIDDocument(issuerDid);
    if (!issuerDoc) {
      return apiOk({
        valid: false,
        reason: 'Issuer DID Document를 찾을 수 없습니다',
        checks,
      });
    }

    const issuerAddress = extractAddressFromDIDDocument(issuerDoc);
    if (!issuerAddress) {
      return apiOk({
        valid: false,
        reason: 'Issuer DID Document에 wallet address가 없습니다',
        checks,
      });
    }

    const isVCSignatureValid = verifyVCSignature(vc, issuerAddress);
    checks.isVCSignatureValid = isVCSignatureValid;
    if (!isVCSignatureValid) {
      return apiOk({
        valid: false,
        reason: 'VC issuer 서명이 올바르지 않습니다',
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
          ? 'VC가 폐기되었습니다'
          : status === 'SUSPENDED'
            ? 'VC가 일시 정지 상태입니다'
            : 'VC가 온체인에서 활성 상태가 아닙니다';
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
        reason: 'VC가 유효기간을 벗어났습니다',
        checks,
      });
    }

    // 4) VP 생성 및 자체 검증 (서버 내에서 holder 키로 서명 후 verify)
    const challenge = '0xpaper_voucher_internal_challenge'; // 외부 노출 불필요한 내부 challenge
    const vp = createVP(holderDid, [vc], challenge);
    const signedVP = await signVP(vp, wallet.privateKey);

    const isVPValid = verifyVPSignature(signedVP, derivedAddress);
    checks.isVPValid = isVPValid;

    if (!isVPValid) {
      return apiOk({
        valid: false,
        reason: 'VP 검증에 실패했습니다',
        checks,
      });
    }

    // 모든 검증 통과
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
    console.error('Error in POST /api/admin/events/[eventId]/checkins/paper-voucher/verify:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
