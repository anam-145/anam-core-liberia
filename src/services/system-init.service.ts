import { AppDataSource } from '@/server/db/datasource';
import { Admin, AdminRole, OnboardingStatus } from '@/server/db/entities/Admin';
import { DidDocument, DIDType } from '@/server/db/entities/DidDocument';
import { createWalletFromMnemonic } from '@/utils/crypto/wallet';
import { createDIDWithAddress, createDIDDocument, hashDIDDocument } from '@/utils/crypto/did';
import { hash } from 'bcryptjs';
import { randomUUID } from 'crypto';
import { blockchainService } from './blockchain.service';

/**
 * System Initialization Service
 *
 * Handles one-time system initialization:
 * - Creates System Admin account
 * - Generates Issuer DID
 * - Sets up wallet and custody
 *
 * Uses hybrid verification:
 * - DB check: Has System Admin been created?
 * - Mnemonic validation: Does env mnemonic match DB wallet address?
 */
class SystemInitService {
  /**
   * Initialize database connection
   */
  async initialize(): Promise<void> {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
  }

  /**
   * Check if system is already initialized
   * Returns existing System Admin if found, null otherwise
   */
  async getSystemAdmin(): Promise<Admin | null> {
    await this.initialize();
    const adminRepository = AppDataSource.getRepository(Admin);

    const systemAdmin = await adminRepository.findOne({
      where: { role: AdminRole.SYSTEM_ADMIN },
    });

    return systemAdmin;
  }

  /**
   * Derive wallet address from mnemonic (without creating full wallet)
   */
  deriveAddressFromMnemonic(mnemonic: string): string {
    const wallet = createWalletFromMnemonic(mnemonic);
    return wallet.address;
  }

  /**
   * Validate environment variables
   */
  validateEnvironment(): {
    username: string;
    password: string;
    mnemonic: string;
  } {
    const username = process.env.SYSTEM_ADMIN_USERNAME;
    const password = process.env.SYSTEM_ADMIN_PASSWORD;
    const mnemonic = process.env.SYSTEM_ADMIN_MNEMONIC;

    if (!username || !password || !mnemonic) {
      throw new Error(
        'Missing required environment variables: SYSTEM_ADMIN_USERNAME, SYSTEM_ADMIN_PASSWORD, SYSTEM_ADMIN_MNEMONIC',
      );
    }

    // Validate mnemonic format (should be 12 or 24 words)
    const words = mnemonic.trim().split(/\s+/);
    if (words.length !== 12 && words.length !== 24) {
      throw new Error('SYSTEM_ADMIN_MNEMONIC must be 12 or 24 words');
    }

    return { username, password, mnemonic };
  }

  /**
   * Perform system initialization
   *
   * Steps:
   * 1. Validate environment variables
   * 2. Check if System Admin already exists (hybrid check)
   * 3. If exists: verify mnemonic matches
   * 4. If not exists: create System Admin with wallet, DID, VC
   */
  async initializeSystemIfNeeded(): Promise<{
    initialized: boolean;
    systemAdmin: Admin;
    message: string;
  }> {
    console.log('[SystemInit] Checking system initialization status...');

    // Step 1: Validate environment
    const env = this.validateEnvironment();

    // Step 2: Calculate expected wallet address from mnemonic
    const expectedAddress = this.deriveAddressFromMnemonic(env.mnemonic);
    console.log(`[SystemInit] Expected wallet address: ${expectedAddress}`);

    // Step 3: Check if System Admin exists
    const existingAdmin = await this.getSystemAdmin();

    if (existingAdmin) {
      // Case A: System already initialized
      console.log('[SystemInit] System Admin already exists');

      if (existingAdmin.walletAddress === expectedAddress) {
        // ✅ Mnemonic matches - all good
        console.log('[SystemInit] ✅ Mnemonic matches. System already initialized.');
        return {
          initialized: false,
          systemAdmin: existingAdmin,
          message: 'System already initialized. Skipping...',
        };
      } else {
        // ❌ Mnemonic mismatch - critical error
        console.error('[SystemInit] ❌ MNEMONIC MISMATCH!');
        console.error(`  DB wallet address: ${existingAdmin.walletAddress}`);
        console.error(`  ENV mnemonic derives: ${expectedAddress}`);
        throw new Error(
          'FATAL: SYSTEM_ADMIN_MNEMONIC does not match existing System Admin wallet address. ' +
            'This is a security issue. DO NOT change the mnemonic after initialization.',
        );
      }
    } else {
      // Case B: First-time initialization
      console.log('[SystemInit] No System Admin found. Initializing for the first time...');

      const systemAdmin = await this.runSystemInitialization(env);

      console.log('[SystemInit] ✅ System initialization complete!');
      console.log(`  Admin ID: ${systemAdmin.adminId}`);
      console.log(`  Username: ${systemAdmin.username}`);
      console.log(`  Wallet Address: ${systemAdmin.walletAddress}`);
      console.log(`  DID: ${systemAdmin.did}`);

      return {
        initialized: true,
        systemAdmin,
        message: 'System initialized successfully',
      };
    }
  }

  /**
   * Run actual system initialization
   * Creates System Admin with wallet, DID Document, and VC
   *
   * Note: System Admin does NOT use custody storage.
   * Private key is accessed from env var when needed.
   */
  private async runSystemInitialization(env: { username: string; password: string; mnemonic: string }): Promise<Admin> {
    await this.initialize();

    // Step 1: Generate wallet from mnemonic
    console.log('[SystemInit] 1. Generating wallet from mnemonic...');
    const wallet = createWalletFromMnemonic(env.mnemonic);

    // Step 2: Create Issuer DID
    console.log('[SystemInit] 2. Creating Issuer DID...');
    const { did: issuerDID } = createDIDWithAddress('issuer', wallet.address);

    // Step 3: Create and register DID Document
    console.log('[SystemInit] 3. Creating DID Document...');
    const didDocument = createDIDDocument(
      issuerDID,
      wallet.address,
      wallet.publicKey,
      issuerDID, // controller (self-controlled)
    );

    console.log('[SystemInit] 4. Registering DID Document...');
    const didRepository = AppDataSource.getRepository(DidDocument);
    const documentHash = hashDIDDocument(didDocument);

    // Step 4a: Check blockchain availability (REQUIRED)
    if (!blockchainService.isAvailable()) {
      throw new Error('Blockchain unavailable. System initialization requires blockchain for DID registration.');
    }

    // Step 4b: Check if DID already registered on blockchain (DB recovery scenario)
    console.log('[SystemInit] Checking if DID already exists on blockchain...');
    let result: { txHash: string; did: string; documentHash: string; blockNumber: number };

    try {
      const existingDID = await blockchainService.getDIDByAddress(wallet.address);

      if (existingDID && existingDID !== '' && existingDID !== '0x') {
        // DID already registered on blockchain (DB recovery mode)
        console.log(`[SystemInit] ✅ DID already registered on-chain: ${existingDID}`);
        console.log(`[SystemInit] Skipping blockchain registration (DB recovery mode)`);

        // Verify it matches expected DID (deterministic check)
        if (existingDID !== issuerDID) {
          throw new Error(
            `DID mismatch! Blockchain has ${existingDID} but expected ${issuerDID}. ` +
              `This indicates a problem with deterministic DID generation.`,
          );
        }

        // Create result object for DB storage (recovered from blockchain)
        result = {
          txHash: 'recovered-from-blockchain',
          did: issuerDID,
          documentHash,
          blockNumber: 0, // Exact block number unknown in recovery mode
        };

        console.log(`[SystemInit] Using existing on-chain registration`);
      } else {
        // DID not found on blockchain - perform new registration
        console.log('[SystemInit] DID not found on blockchain. Registering new DID...');
        result = await blockchainService.registerDID(wallet.address, issuerDID, documentHash, wallet.privateKey);

        console.log(`[SystemInit] ✅ System Admin DID registered on-chain: ${result.txHash}`);
        console.log(`  Block Number: ${result.blockNumber}`);
      }
    } catch (error) {
      // If blockchain read fails, attempt registration
      console.log('[SystemInit] Cannot verify blockchain status, attempting registration...');
      console.log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);

      try {
        result = await blockchainService.registerDID(wallet.address, issuerDID, documentHash, wallet.privateKey);

        console.log(`[SystemInit] ✅ System Admin DID registered on-chain: ${result.txHash}`);
        console.log(`  Block Number: ${result.blockNumber}`);
      } catch (registerError) {
        // Registration failed - could be duplicate or other error
        if (registerError instanceof Error && registerError.message.includes('already')) {
          console.log('[SystemInit] Registration failed: DID already exists. Continuing with DB recovery...');
          result = {
            txHash: 'recovered-after-duplicate-error',
            did: issuerDID,
            documentHash,
            blockNumber: 0,
          };
        } else {
          throw registerError;
        }
      }
    }

    // Save to database (only after blockchain success)
    const didEntity = didRepository.create({
      did: issuerDID,
      walletAddress: wallet.address,
      publicKeyHex: wallet.publicKey,
      didType: DIDType.ISSUER,
      documentJson: didDocument,
      documentHash,
      onChainTxHash: result.txHash,
    });

    await didRepository.save(didEntity);

    // Note: System Admin is an Issuer, not a VC Subject
    // Admin role is managed via Admin.role column, not via VC
    // System Admin does not need a VC (Issuers issue VCs to others)

    // Step 5: Hash password
    console.log('[SystemInit] 5. Hashing password...');
    const passwordHash = await hash(env.password, 10);

    // Step 6: Save to database
    console.log('[SystemInit] 6. Saving System Admin to database...');
    const adminRepository = AppDataSource.getRepository(Admin);

    const admin = adminRepository.create({
      adminId: randomUUID(),
      username: env.username,
      passwordHash,
      fullName: 'System Administrator',
      email: null,
      phoneNumber: null,
      role: AdminRole.SYSTEM_ADMIN,
      did: issuerDID,
      walletAddress: wallet.address,
      isActive: true,
      onboardingStatus: OnboardingStatus.ACTIVE,
    });

    await adminRepository.save(admin);

    console.log('[SystemInit] System Admin created successfully');
    console.log('[SystemInit] Note: Private key accessed from SYSTEM_ADMIN_MNEMONIC env var when needed');

    return admin;
  }
}

// Export singleton instance
export const systemInitService = new SystemInitService();

/**
 * Get System Admin wallet from environment variable
 * Use this when System Admin needs to sign VCs or execute blockchain transactions
 *
 * @returns Wallet info with private key
 * @throws Error if SYSTEM_ADMIN_MNEMONIC is not set
 */
export function getSystemAdminWallet() {
  const mnemonic = process.env.SYSTEM_ADMIN_MNEMONIC;

  if (!mnemonic) {
    throw new Error(
      'SYSTEM_ADMIN_MNEMONIC not found in environment variables. ' + 'System Admin wallet cannot be accessed.',
    );
  }

  return createWalletFromMnemonic(mnemonic);
}
