/**
 * Custody Service - Database Implementation
 * Using TypeORM with MariaDB
 *
 * Manages custody wallets for USSD users (required) and
 * optional backups for AnamWallet/Paper Voucher users.
 *
 * Note:
 * - Storing a VC together with the wallet vault is supported (vc?: VerifiableCredential).
 * - In practice, "no VC" custody generally applies only to the Issuer/System Admin account
 *   created during system initialization. Staff onboarding stores both wallet vault and the
 *   signed ADMIN VC together in a single call (see POST /api/admin/admins/onboard).
 */

import 'reflect-metadata';
import type { DataSource } from 'typeorm';
import { randomBytes } from 'crypto';
import { CustodyWallet, WalletType } from '../server/db/entities/CustodyWallet';
import type { Vault } from '../utils/crypto/vault';
import type { VerifiableCredential } from '../utils/crypto/did';
import AppDataSource from '../server/db/datasource';

export interface CreateCustodyRequest {
  userId: string;
  walletType: 'ANAMWALLET' | 'USSD' | 'PAPER_VOUCHER';
  phoneNumber?: string;
  vault: Vault;
  isBackup: boolean;
  vc?: VerifiableCredential; // Optional: store VC together
}

export interface CreateCustodyResponse {
  custodyId: string;
}

export interface UpdateVCRequest {
  vc: VerifiableCredential;
}

export interface CustodyData {
  custodyId: string;
  userId: string;
  walletType: string;
  phoneNumber?: string | null;
  vault: Vault;
  vc: VerifiableCredential | null;
  isBackup: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Database-based Custody Service
 */
export class CustodyDatabaseService {
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
          console.log('[DB] DataSource initialized successfully');
        }
        this.initialized = true;
      } catch (error) {
        console.error('[DB] Failed to initialize DataSource:', error);
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
   * Generate a unique custody ID
   */
  private generateCustodyId(): string {
    return `custody_${randomBytes(16).toString('hex')}`;
  }

  /**
   * Convert entity to response format
   */
  private toCustodyData(entity: CustodyWallet): CustodyData {
    return {
      custodyId: entity.custodyId,
      userId: entity.userId,
      walletType: entity.walletType,
      phoneNumber: entity.phoneNumber,
      vault: entity.vault,
      vc: entity.vc,
      isBackup: entity.isBackup,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  /**
   * Create and store custody wallet
   */
  async createCustody(request: CreateCustodyRequest): Promise<CreateCustodyResponse> {
    await this.ensureInitialized();

    // Validate USSD requirements
    if (request.walletType === 'USSD' && !request.phoneNumber) {
      throw new Error('phoneNumber is required for USSD wallet type');
    }

    // Validate wallet type
    if (!['ANAMWALLET', 'USSD', 'PAPER_VOUCHER'].includes(request.walletType)) {
      throw new Error('Invalid walletType. Must be ANAMWALLET, USSD, or PAPER_VOUCHER');
    }

    // Check for duplicate phone number (if provided)
    if (request.phoneNumber) {
      const existing = await this.dataSource.getRepository(CustodyWallet).findOne({
        where: { phoneNumber: request.phoneNumber },
      });
      if (existing) {
        throw new Error('Phone number already registered');
      }
    }

    // Validate vault structure
    if (!request.vault.ciphertext || !request.vault.iv || !request.vault.salt || !request.vault.authTag) {
      throw new Error('Invalid vault structure. Required fields: ciphertext, iv, salt, authTag');
    }

    // Create custody entity
    const custodyId = this.generateCustodyId();
    const custodyEntity = new CustodyWallet();
    custodyEntity.custodyId = custodyId;
    custodyEntity.userId = request.userId;
    custodyEntity.walletType = WalletType[request.walletType];
    custodyEntity.phoneNumber = request.phoneNumber || null;
    custodyEntity.vault = request.vault;
    custodyEntity.vc = request.vc || null; // Optionally set VC now
    custodyEntity.isBackup = request.isBackup;

    // Save to database
    const repository = this.dataSource.getRepository(CustodyWallet);
    await repository.save(custodyEntity);

    return { custodyId };
  }

  /**
   * Update VC for existing custody
   */
  async updateVC(custodyId: string, request: UpdateVCRequest): Promise<void> {
    await this.ensureInitialized();

    const repository = this.dataSource.getRepository(CustodyWallet);
    const custody = await repository.findOne({ where: { custodyId } });

    if (!custody) {
      throw new Error('Custody not found');
    }

    custody.vc = request.vc;
    await repository.save(custody);
  }

  /**
   * Get custody by custody ID
   */
  async getCustodyById(custodyId: string): Promise<CustodyData | null> {
    await this.ensureInitialized();

    const repository = this.dataSource.getRepository(CustodyWallet);
    const custody = await repository.findOne({ where: { custodyId } });

    if (!custody) {
      return null;
    }

    return this.toCustodyData(custody);
  }

  /**
   * Get custody by user ID
   */
  async getCustodyByUserId(userId: string): Promise<CustodyData | null> {
    await this.ensureInitialized();

    const repository = this.dataSource.getRepository(CustodyWallet);
    const custody = await repository.findOne({ where: { userId } });

    if (!custody) {
      return null;
    }

    return this.toCustodyData(custody);
  }

  /**
   * Get custody by phone number (for USSD)
   */
  async getCustodyByPhone(phoneNumber: string): Promise<CustodyData | null> {
    await this.ensureInitialized();

    const repository = this.dataSource.getRepository(CustodyWallet);
    const custody = await repository.findOne({ where: { phoneNumber } });

    if (!custody) {
      return null;
    }

    return this.toCustodyData(custody);
  }

  /**
   * Delete custody by custody ID
   */
  async deleteCustody(custodyId: string): Promise<void> {
    await this.ensureInitialized();

    const repository = this.dataSource.getRepository(CustodyWallet);
    const custody = await repository.findOne({ where: { custodyId } });

    if (!custody) {
      throw new Error('Custody not found');
    }

    await repository.remove(custody);
  }

  /**
   * Close database connection (for testing)
   */
  async close(): Promise<void> {
    if (this.initialized && this.dataSource.isInitialized) {
      await this.dataSource.destroy();
      this.initialized = false;
    }
  }
}

// Export singleton instance
export const custodyService = new CustodyDatabaseService();
