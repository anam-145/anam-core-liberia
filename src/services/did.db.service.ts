/**
 * DID Service - Database Implementation
 * Using TypeORM with MariaDB
 * Integrated with Ethereum Sepolia blockchain
 *
 * Blockchain Integration:
 * - ON-CHAIN: When privateKey is provided (internal services only)
 *   - system-init.service.ts: System Admin DID registration
 *   - vc.db.service.ts: User DID registration during VC issuance
 * - OFF-CHAIN: When privateKey is not provided (external API calls)
 *   - POST /api/dids/register: Only saves to DB (for security)
 */

import 'reflect-metadata';
import type { DataSource } from 'typeorm';
import {
  createDIDWithAddress,
  createDIDDocument,
  hashDIDDocument,
  type DIDDocument as DIDDocumentType,
} from '../utils/crypto/did';
import { isAddress } from 'ethers';
import { DidDocument, DIDType } from '../server/db/entities/DidDocument';
import AppDataSource from '../server/db/datasource';
import { blockchainService } from './blockchain.service';

export interface CreateDIDRequest {
  walletAddress: string;
  publicKeyHex: string;
  type: 'user' | 'issuer';
  privateKey?: string; // Optional: for on-chain registration
}

export interface CreateDIDResponse {
  did: string;
  document: DIDDocumentType;
  documentHash: string;
  txHash?: string; // Optional: only present if registered on-chain
  blockNumber?: number; // Optional: only present if registered on-chain
  onChainRegistered: boolean;
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
   *
   * Blockchain Registration (REQUIRED):
   * - privateKey must be provided
   * - Blockchain must be available
   * - Registration must succeed
   * - If any step fails, entire operation fails
   *
   * Note: External API (/api/dids/register) does NOT provide privateKey for security.
   * On-chain registration only happens in internal services.
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

    // Create DID and Document (deterministic based on wallet address)
    const { did } = createDIDWithAddress(request.type, request.walletAddress);
    const document = createDIDDocument(did, request.walletAddress, request.publicKeyHex);
    const documentHash = hashDIDDocument(document);

    // Blockchain registration is REQUIRED
    if (!request.privateKey) {
      throw new Error('Private key required for DID registration');
    }

    if (!blockchainService.isAvailable()) {
      throw new Error('Blockchain unavailable. DID registration requires blockchain.');
    }

    // Check if DID already registered on blockchain (DB recovery scenario)
    console.log(`[DID Service] Checking if DID already exists on blockchain: ${did}`);
    let result: { txHash: string; blockNumber: number };

    try {
      const existingDID = await blockchainService.getDIDByAddress(request.walletAddress);

      if (existingDID && existingDID !== '' && existingDID !== '0x') {
        // DID already registered on blockchain
        console.log(`[DID Service] ✅ DID already registered on-chain: ${existingDID}`);

        // Verify deterministic match
        if (existingDID !== did) {
          throw new Error(
            `DID mismatch! Blockchain has ${existingDID} but expected ${did}. ` +
              `This indicates a problem with deterministic DID generation.`,
          );
        }

        console.log(`[DID Service] Skipping blockchain registration (already exists)`);
        result = {
          txHash: 'recovered-from-blockchain',
          blockNumber: 0,
        };
      } else {
        // Register on blockchain
        console.log(`[DID Service] Registering DID on blockchain: ${did}`);
        const registerResult = await blockchainService.registerDID(
          request.walletAddress,
          did,
          documentHash,
          request.privateKey,
        );

        console.log(`[DID Service] ✅ On-chain registration successful: ${registerResult.txHash}`);
        console.log(`[DID Service] Block Number: ${registerResult.blockNumber}`);

        result = {
          txHash: registerResult.txHash,
          blockNumber: registerResult.blockNumber,
        };
      }
    } catch (error) {
      // If read fails, attempt registration
      console.log(`[DID Service] Cannot verify blockchain status, attempting registration...`);
      console.log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);

      try {
        const registerResult = await blockchainService.registerDID(
          request.walletAddress,
          did,
          documentHash,
          request.privateKey,
        );

        console.log(`[DID Service] ✅ On-chain registration successful: ${registerResult.txHash}`);

        result = {
          txHash: registerResult.txHash,
          blockNumber: registerResult.blockNumber,
        };
      } catch (registerError) {
        if (registerError instanceof Error && registerError.message.includes('already')) {
          console.log(`[DID Service] Registration failed: DID already exists. Continuing...`);
          result = {
            txHash: 'recovered-after-duplicate-error',
            blockNumber: 0,
          };
        } else {
          throw registerError;
        }
      }
    }

    // Save to database (only after blockchain success)
    const didEntity = new DidDocument();
    didEntity.did = did;
    didEntity.walletAddress = request.walletAddress;
    didEntity.publicKeyHex = request.publicKeyHex;
    didEntity.didType = request.type === 'user' ? DIDType.USER : DIDType.ISSUER;
    didEntity.documentJson = document;
    didEntity.documentHash = documentHash;
    didEntity.onChainTxHash = result.txHash;

    await this.dataSource.manager.save(didEntity);

    console.log(`[DB] DID created: ${did} (on-chain: ${result.txHash})`);

    return {
      did,
      document,
      documentHash,
      txHash: result.txHash,
      blockNumber: result.blockNumber,
      onChainRegistered: true,
    };
  }

  /**
   * Get DID Document by DID
   */
  async getDIDDocument(did: string): Promise<DIDDocumentType | null> {
    await this.ensureInitialized();

    const didEntity = await this.dataSource.manager.findOne(DidDocument, {
      where: { did },
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
      where: { walletAddress },
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

    const query = this.dataSource.manager.createQueryBuilder(DidDocument, 'did');

    if (type) {
      query.where('did.didType = :type', { type: type.toUpperCase() });
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
   * Verify DID on blockchain
   * Checks if DID exists and document hash matches
   */
  async verifyOnChain(did: string): Promise<boolean> {
    await this.ensureInitialized();

    if (!blockchainService.isAvailable()) {
      console.log('[DID Service] Blockchain unavailable - falling back to DB check');
      const didEntity = await this.dataSource.manager.findOne(DidDocument, {
        where: { did },
      });
      return !!didEntity;
    }

    try {
      // Get address from blockchain
      const address = await blockchainService.getAddressByDID(did);

      // Check if address is not zero address (0x0000...)
      const isRegistered = address !== '0x0000000000000000000000000000000000000000';

      if (isRegistered) {
        // Verify document hash matches
        const onChainHash = await blockchainService.getDocumentHashByDID(did);
        const dbEntity = await this.dataSource.manager.findOne(DidDocument, {
          where: { did },
        });

        if (dbEntity && dbEntity.documentHash === onChainHash) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('[DID Service] Failed to verify DID on blockchain:', error);
      // Fallback to DB check
      const didEntity = await this.dataSource.manager.findOne(DidDocument, {
        where: { did },
      });
      return !!didEntity;
    }
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
