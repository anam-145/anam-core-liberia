/**
 * VC Service - Database Implementation
 * Handles VC issuance, revocation, and status management
 */

import 'reflect-metadata';
import type { DataSource } from 'typeorm';
import { createVC, signVC, canonicalStringify, type VerifiableCredential } from '../utils/crypto/did';
import { randomBytes, hexlify, keccak256 } from 'ethers';
import { VcRegistry, VCStatus } from '../server/db/entities/VcRegistry';
import AppDataSource from '../server/db/datasource';
import { getDIDDatabaseService } from './did.db.service';

export interface IssueVCRequest {
  walletAddress: string;
  publicKeyHex: string;
  vcType: 'KYC' | 'ADMIN';
  data: Record<string, unknown>;
}

export interface IssueVCResponse {
  did: string;
  vc: VerifiableCredential;
  vcHash: string;
  txHashes: {
    didRegistry: string;
    vcRegistry: string;
  };
}

export interface RevokeVCRequest {
  vcId: string;
  reason?: string;
}

export interface RevokeVCResponse {
  vcId: string;
  status: 'REVOKED';
  txHash: string;
  revokedAt: string;
}

/**
 * Database-based VC Service
 */
export class VCDatabaseService {
  private dataSource: DataSource = AppDataSource;
  private initialized = false;

  /**
   * Initialize database connection
   */
  async initialize(): Promise<void> {
    if (!this.initialized) {
      try {
        if (!this.dataSource.isInitialized) {
          await this.dataSource.initialize();
          console.log('[VC Service] DataSource initialized successfully');
        }
        this.initialized = true;
      } catch (error) {
        console.error('[VC Service] Failed to initialize DataSource:', error);
        throw error;
      }
    }
  }

  /**
   * Ensure service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Issue VC (통합 프로세스: DID 등록 + VC 발급)
   * @param request VC 발급 요청 정보
   * @returns 발급된 VC 및 관련 정보
   */
  async issueVC(request: IssueVCRequest): Promise<IssueVCResponse> {
    await this.ensureInitialized();

    // Step 1: DID 생성 및 등록 (DIDDatabaseService 사용)
    const didService = getDIDDatabaseService();

    // 이미 DID가 있는지 확인
    const existingDid = await didService.getDIDByAddress(request.walletAddress);
    let did: string;
    let didTxHash: string;

    if (existingDid) {
      // 이미 DID가 있으면 재사용
      did = existingDid;
      didTxHash = 'existing'; // 기존 DID는 이미 등록됨
      console.log(`[VC Service] Using existing DID: ${did}`);
    } else {
      // 새 DID 생성 및 등록
      const didResult = await didService.createAndRegisterDID({
        walletAddress: request.walletAddress,
        publicKeyHex: request.publicKeyHex,
        type: request.vcType === 'ADMIN' ? 'issuer' : 'user',
      });
      did = didResult.did;
      didTxHash = didResult.mockTxHash;
      console.log(`[VC Service] Created new DID: ${did}`);
    }

    // Step 2: Issuer DID 가져오기 (환경변수 또는 기본값)
    const issuerDid = process.env.ISSUER_DID || 'did:anam:undp-lr:issuer:system';
    const issuerPrivateKey = process.env.ISSUER_PRIVATE_KEY || '0x' + '0'.repeat(64); // TODO: 실제 issuer 개인키 필요

    // Step 3: VC 생성 (unsigned)
    const vcId = this.generateVCId(request.vcType);
    const vcType = request.vcType === 'KYC' ? 'UndpKycCredential' : 'UndpAdminCredential';

    // createVC 파라미터 순서: (issuerDID, subjectDID, credentialType, credentialSubject, vcId, validityDays)
    const unsignedVC = createVC(
      issuerDid, // 1. issuerDID
      did, // 2. subjectDID (holder DID)
      vcType, // 3. credentialType
      request.data, // 4. credentialSubject
      vcId, // 5. vcId
      730, // 6. validityPeriodDays (2 years)
    );

    // Step 4: VC 서명
    const verificationMethod = `${issuerDid}#keys-1`;
    const vc = await signVC(unsignedVC, issuerPrivateKey, verificationMethod);

    // Step 5: VC 해시 계산
    const vcHash = this.calculateVCHash(vc);

    // Step 6: 온체인 VC 등록 (Mock)
    const vcTxHash = this.generateMockTxHash();
    // TODO: Implement actual blockchain registration
    console.log(`[VC Service] TODO: Register VC on VCStatusRegistry - txHash: ${vcTxHash}`);

    // Step 7: DB에 VC 메타데이터 저장 (VC 원본은 저장하지 않음)
    const vcEntity = new VcRegistry();
    vcEntity.vcId = vcId;
    vcEntity.userDid = did;
    vcEntity.issuerDid = issuerDid;
    vcEntity.vcType = vcType;
    vcEntity.vcHash = vcHash;
    vcEntity.status = VCStatus.ACTIVE;
    vcEntity.issuedAt = new Date(vc.issuanceDate);
    vcEntity.expiresAt = vc.expirationDate ? new Date(vc.expirationDate) : undefined;
    vcEntity.onChainTxHash = vcTxHash;

    await this.dataSource.manager.save(vcEntity);

    console.log(`[VC Service] VC issued: ${vcId}`);

    return {
      did,
      vc,
      vcHash,
      txHashes: {
        didRegistry: didTxHash,
        vcRegistry: vcTxHash,
      },
    };
  }

  /**
   * Revoke VC (VC 폐기)
   * @param request VC 폐기 요청
   * @returns 폐기 결과
   */
  async revokeVC(request: RevokeVCRequest): Promise<RevokeVCResponse> {
    await this.ensureInitialized();

    // Step 1: VC 조회
    const vcEntity = await this.dataSource.manager.findOne(VcRegistry, {
      where: { vcId: request.vcId },
    });

    if (!vcEntity) {
      throw new Error(`VC not found: ${request.vcId}`);
    }

    if (vcEntity.status === VCStatus.REVOKED) {
      throw new Error(`VC already revoked: ${request.vcId}`);
    }

    // Step 2: 온체인 폐기 (Mock)
    const txHash = this.generateMockTxHash();
    // TODO: Implement actual blockchain revocation
    console.log(`[VC Service] TODO: Revoke VC on VCStatusRegistry - txHash: ${txHash}`);

    // Step 3: DB 업데이트
    const revokedAt = new Date();
    vcEntity.status = VCStatus.REVOKED;
    vcEntity.revokedAt = revokedAt;
    vcEntity.revocationReason = request.reason;

    await this.dataSource.manager.save(vcEntity);

    console.log(`[VC Service] VC revoked: ${request.vcId}`);

    return {
      vcId: request.vcId,
      status: 'REVOKED',
      txHash,
      revokedAt: revokedAt.toISOString(),
    };
  }

  /**
   * Get VC status from DB
   * @param vcId VC ID
   * @returns VC status or null if not found
   */
  async getVCStatus(vcId: string): Promise<VCStatus | null> {
    await this.ensureInitialized();

    const vcEntity = await this.dataSource.manager.findOne(VcRegistry, {
      where: { vcId },
    });

    return vcEntity ? vcEntity.status : null;
  }

  /**
   * Verify VC status on blockchain (Mock)
   * @param vcId VC ID
   * @returns true if ACTIVE, false if REVOKED or not found
   */
  async verifyVCOnChain(vcId: string): Promise<boolean> {
    await this.ensureInitialized();

    // TODO: Implement actual blockchain verification
    // For now, check DB status
    const status = await this.getVCStatus(vcId);

    if (!status) {
      return false; // VC not found
    }

    return status === VCStatus.ACTIVE;
  }

  /**
   * Generate VC ID
   * @param vcType VC type (KYC or ADMIN)
   * @returns VC ID (e.g., vc_kyc_12345)
   */
  private generateVCId(vcType: 'KYC' | 'ADMIN'): string {
    const prefix = vcType === 'KYC' ? 'vc_kyc' : 'vc_admin';
    const randomId = randomBytes(4).reduce((acc, byte) => acc + byte.toString(16).padStart(2, '0'), '');
    return `${prefix}_${randomId}`;
  }

  /**
   * Calculate VC hash (for integrity verification)
   * @param vc Verifiable Credential
   * @returns Keccak256 hash
   */
  private calculateVCHash(vc: VerifiableCredential): string {
    // VC를 canonical JSON으로 변환 후 keccak256 해시 계산
    const canonicalJson = canonicalStringify(vc);
    return keccak256(Buffer.from(canonicalJson, 'utf-8'));
  }

  /**
   * Generate mock transaction hash
   * @returns Mock tx hash
   */
  private generateMockTxHash(): string {
    const bytes = randomBytes(32);
    return hexlify(bytes);
  }

  /**
   * Close database connection (for cleanup)
   */
  async close(): Promise<void> {
    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy();
      this.initialized = false;
      console.log('[VC Service] DataSource connection closed');
    }
  }
}

// Singleton instance
let vcService: VCDatabaseService | null = null;

/**
 * Get the singleton VC service instance
 */
export function getVCDatabaseService(): VCDatabaseService {
  if (!vcService) {
    vcService = new VCDatabaseService();
    console.log('[VC Service] VC Database Service created');
  }
  return vcService;
}

/**
 * Reset VC service (for testing)
 */
export function resetVCService(): void {
  if (vcService) {
    vcService.close();
    vcService = null;
  }
}
