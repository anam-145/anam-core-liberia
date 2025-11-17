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
import { CustodyWallet } from '../server/db/entities/CustodyWallet';
import type { Vault } from '../utils/crypto/vault';
import AppDataSource from '../server/db/datasource';

export interface CreateCustodyRequest {
  userId?: string; // Either userId or adminId must be provided
  adminId?: string;
  vault: Vault;
  vc?: Vault & { id: string }; // Optional: encrypted VC vault with id
}

export interface CreateCustodyResponse {
  custodyId: string;
}

export interface UpdateVCRequest {
  vc: Vault & { id: string };
}

export interface CustodyData {
  custodyId: string;
  userId: string | null;
  adminId: string | null;
  vault: Vault;
  vc: (Vault & { id: string }) | null;
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
      adminId: entity.adminId,
      vault: entity.vault,
      vc: entity.vc,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  /**
   * Create and store custody wallet
   */
  async createCustody(request: CreateCustodyRequest): Promise<CreateCustodyResponse> {
    await this.ensureInitialized();

    // Validate owner reference
    if (!request.userId && !request.adminId) {
      throw new Error('Either userId or adminId is required');
    }

    // Validate vault structure
    if (!request.vault.ciphertext || !request.vault.iv || !request.vault.salt || !request.vault.authTag) {
      throw new Error('Invalid vault structure. Required fields: ciphertext, iv, salt, authTag');
    }

    // Create custody entity
    const custodyId = this.generateCustodyId();
    const custodyEntity = new CustodyWallet();
    custodyEntity.custodyId = custodyId;
    custodyEntity.userId = request.userId ?? null;
    custodyEntity.adminId = request.adminId ?? null;
    custodyEntity.vault = request.vault;
    custodyEntity.vc = request.vc || null; // Optionally set VC now

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
  // getCustodyByPhone removed — phone-based lookup deprecated in MVP

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
