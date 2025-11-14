/**
 * VC Service - Database Implementation
 * Handles VC issuance, revocation, and status management
 * Integrated with Base Network blockchain
 */

import 'reflect-metadata';
import type { DataSource } from 'typeorm';
import {
  createVC,
  signVC,
  canonicalStringify,
  createDIDWithAddress,
  type VerifiableCredential,
} from '../utils/crypto/did';
import { randomBytes, keccak256 } from 'ethers';
import { VcRegistry, VCStatus } from '../server/db/entities/VcRegistry';
import AppDataSource from '../server/db/datasource';
import { getDIDDatabaseService } from './did.db.service';
import { blockchainService } from './blockchain.service';
import { getSystemAdminWallet } from './system-init.service';

export interface IssueVCRequest {
  walletAddress: string;
  publicKeyHex: string;
  vcType: 'KYC' | 'ADMIN';
  data: Record<string, unknown>;
  issuerPrivateKey: string; // Required: Issuer's private key for signing VC and blockchain transactions
}

export interface IssueVCResponse {
  did: string;
  vc: VerifiableCredential;
  vcHash: string;
  txHashes: {
    didRegistry?: string;
    vcRegistry?: string;
  };
  onChainRegistered: boolean;
}

export interface RevokeVCRequest {
  vcId: string;
  reason?: string;
  issuerPrivateKey: string; // Required: Issuer's private key for blockchain transaction
}

export interface RevokeVCResponse {
  vcId: string;
  status: 'REVOKED';
  txHash?: string;
  revokedAt: string;
  onChainRevoked: boolean;
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
      // 새 DID 생성 및 등록 (Issuer가 대신 등록)
      const didResult = await didService.createAndRegisterDID({
        walletAddress: request.walletAddress,
        publicKeyHex: request.publicKeyHex,
        type: 'user', // VC를 받는 모든 대상은 user DID (참가자, Approver, Verifier)
        privateKey: request.issuerPrivateKey, // Issuer의 privateKey로 블록체인 등록
      });
      did = didResult.did;
      didTxHash = didResult.txHash || 'unknown';
      console.log(`[VC Service] Created new DID: ${did}`);
    }

    // Step 2: Issuer DID 가져오기 (System Admin wallet으로부터 결정론적 계산)
    const adminWallet = getSystemAdminWallet();
    const { did: issuerDid } = createDIDWithAddress('issuer', adminWallet.address);

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
    const vc = await signVC(unsignedVC, request.issuerPrivateKey, verificationMethod);

    // Step 5: VC 해시 계산
    const vcHash = this.calculateVCHash(vc);

    // Step 6: 온체인 VC 등록 (REQUIRED)
    if (!blockchainService.isAvailable()) {
      throw new Error('Blockchain unavailable. VC registration requires blockchain.');
    }

    console.log(`[VC Service] Registering VC on blockchain: ${vcId}`);
    const result = await blockchainService.registerVC(vcId, request.issuerPrivateKey);
    const vcTxHash = result.txHash;

    console.log(`[VC Service] ✅ On-chain VC registration successful: ${vcTxHash}`);

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

    console.log(`[VC Service] VC issued: ${vcId} (on-chain: ${vcTxHash})`);

    return {
      did,
      vc,
      vcHash,
      txHashes: {
        didRegistry: didTxHash,
        vcRegistry: vcTxHash,
      },
      onChainRegistered: true,
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

    // Step 2: 온체인 폐기 (REQUIRED)
    if (!blockchainService.isAvailable()) {
      throw new Error('Blockchain unavailable. VC revocation requires blockchain.');
    }

    console.log(`[VC Service] Revoking VC on blockchain: ${request.vcId}`);
    const txHash = await blockchainService.revokeVC(request.vcId, request.issuerPrivateKey);

    console.log(`[VC Service] ✅ On-chain VC revocation successful: ${txHash}`);

    // Step 3: DB 업데이트
    const revokedAt = new Date();
    vcEntity.status = VCStatus.REVOKED;
    vcEntity.revokedAt = revokedAt;
    vcEntity.revocationReason = request.reason;

    await this.dataSource.manager.save(vcEntity);

    console.log(`[VC Service] VC revoked: ${request.vcId} (on-chain: ${txHash})`);

    return {
      vcId: request.vcId,
      status: 'REVOKED',
      txHash,
      revokedAt: revokedAt.toISOString(),
      onChainRevoked: true,
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
   * Verify VC status on blockchain
   * @param vcId VC ID
   * @returns true if ACTIVE on blockchain, false if REVOKED or not found
   */
  async verifyVCOnChain(vcId: string): Promise<boolean> {
    await this.ensureInitialized();

    if (blockchainService.isAvailable()) {
      try {
        const vcStatus = await blockchainService.getVCStatus(vcId);
        // Check if VC status is ACTIVE (enum value 1)
        return vcStatus.status === 1; // VCStatus.ACTIVE
      } catch (error) {
        console.error('[VC Service] Failed to verify VC on blockchain:', error);
        console.log('[VC Service] Falling back to DB status check');
      }
    }

    // Fallback: Check DB status if blockchain is unavailable
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
