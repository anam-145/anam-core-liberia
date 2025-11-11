/**
 * DID Service - Database Implementation
 * Using TypeORM with MariaDB
 */

import 'reflect-metadata';
import type { DataSource } from 'typeorm';
import {
  createDID,
  createDIDDocument,
  hashDIDDocument,
  type DIDDocument as DIDDocumentType,
} from '../utils/crypto/did';
import { isAddress, randomBytes, hexlify } from 'ethers';
import { DidDocument, DIDType } from '../server/db/entities/DidDocument';
import AppDataSource from '../server/db/datasource';

export interface CreateDIDRequest {
  walletAddress: string;
  publicKeyHex: string;
  type: 'user' | 'issuer';
}

export interface CreateDIDResponse {
  did: string;
  document: DIDDocumentType;
  documentHash: string;
  mockTxHash: string;
}

/**
 * Database-based DID Service
 */
export class DIDDatabaseService {
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
   * Create and register a new DID
   */
  async createAndRegisterDID(request: CreateDIDRequest): Promise<CreateDIDResponse> {
    await this.ensureInitialized();

    // Validate inputs
    if (!isAddress(request.walletAddress)) {
      throw new Error('Invalid wallet address');
    }

    if (!request.publicKeyHex.match(/^0x[a-fA-F0-9]{130}$/)) {
      throw new Error('Invalid public key format (expected 65 bytes hex)');
    }

    // Check if wallet already has a DID
    const existingDid = await this.getDIDByAddress(request.walletAddress);
    if (existingDid) {
      throw new Error(`Wallet already has a DID: ${existingDid}`);
    }

    // Create DID and Document
    const did = createDID(request.type);
    const document = createDIDDocument(did, request.walletAddress, request.publicKeyHex);
    const documentHash = hashDIDDocument(document);
    const mockTxHash = this.generateMockTxHash();

    // Save to database
    const didEntity = new DidDocument();
    didEntity.did = did;
    didEntity.walletAddress = request.walletAddress;
    didEntity.publicKeyHex = request.publicKeyHex;
    didEntity.didType = request.type === 'user' ? DIDType.USER : DIDType.ISSUER;
    didEntity.documentJson = document;
    didEntity.documentHash = documentHash;
    didEntity.onChainTxHash = mockTxHash;
    didEntity.isActive = true;

    await this.dataSource.manager.save(didEntity);

    console.log(`[DB] DID created: ${did}`);

    return {
      did,
      document,
      documentHash,
      mockTxHash,
    };
  }

  /**
   * Get DID Document by DID
   */
  async getDIDDocument(did: string): Promise<DIDDocumentType | null> {
    await this.ensureInitialized();

    const didEntity = await this.dataSource.manager.findOne(DidDocument, {
      where: { did, isActive: true },
    });

    return didEntity ? didEntity.documentJson : null;
  }

  /**
   * Get DID by wallet address
   */
  async getDIDByAddress(walletAddress: string): Promise<string | null> {
    await this.ensureInitialized();

    if (!isAddress(walletAddress)) {
      throw new Error('Invalid wallet address');
    }

    const didEntity = await this.dataSource.manager.findOne(DidDocument, {
      where: { walletAddress, isActive: true },
    });

    return didEntity ? didEntity.did : null;
  }

  /**
   * List all DIDs
   */
  async listDIDs(type?: 'user' | 'issuer'): Promise<
    Array<{
      did: string;
      walletAddress: string;
      type: string;
      createdAt: Date;
    }>
  > {
    await this.ensureInitialized();

    const query = this.dataSource.manager
      .createQueryBuilder(DidDocument, 'did')
      .where('did.isActive = :isActive', { isActive: true });

    if (type) {
      query.andWhere('did.didType = :type', { type: type.toUpperCase() });
    }

    const entities = await query.getMany();

    return entities.map((entity) => ({
      did: entity.did,
      walletAddress: entity.walletAddress,
      type: entity.didType.toLowerCase(),
      createdAt: entity.createdAt,
    }));
  }

  /**
   * Mock blockchain verification
   */
  async verifyOnChain(did: string): Promise<boolean> {
    await this.ensureInitialized();

    const didEntity = await this.dataSource.manager.findOne(DidDocument, {
      where: { did, isActive: true },
    });

    // Mock verification - in real implementation, check blockchain
    return !!didEntity;
  }

  /**
   * Generate mock transaction hash
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
      console.log('[DB] DataSource connection closed');
    }
  }
}

// Singleton instance
let didService: DIDDatabaseService | null = null;

export function getDIDDatabaseService(): DIDDatabaseService {
  if (!didService) {
    didService = new DIDDatabaseService();
    console.log('[DB] DID Database Service created');
  }
  return didService;
}
