/**
 * Blockchain Service
 * Handles interactions with Base Sepolia smart contracts
 * - DIDRegistry: DID registration and management
 * - VCStatusRegistry: VC status tracking (register, revoke, suspend, activate)
 */

import { JsonRpcProvider, Wallet, Contract, type TransactionResponse } from 'ethers';
import DIDRegistryABI from '@/contracts/abi/DIDRegistry.json';
import VCStatusRegistryABI from '@/contracts/abi/VCStatusRegistry.json';

/**
 * Blockchain Service Configuration
 */
interface BlockchainConfig {
  rpcUrl: string;
  chainId: number;
  didRegistryAddress: string;
  vcStatusRegistryAddress: string;
}

/**
 * DID Registration Result
 */
export interface DIDRegistrationResult {
  txHash: string;
  did: string;
  documentHash: string;
  blockNumber: number;
}

/**
 * VC Registration Result
 */
export interface VCRegistrationResult {
  txHash: string;
  vcId: string;
  blockNumber: number;
}

/**
 * VC Status Enum (matches Solidity enum)
 */
export enum VCStatus {
  NOT_REGISTERED = 0,
  ACTIVE = 1,
  SUSPENDED = 2,
  REVOKED = 3,
}

/**
 * VC Status from Blockchain
 */
export interface VCStatusOnChain {
  status: VCStatus;
  revokedAt: bigint;
}

/**
 * Blockchain Service Class
 * Singleton pattern for managing blockchain connections
 */
class BlockchainService {
  private provider: JsonRpcProvider | null = null;
  private didRegistry: Contract | null = null;
  private vcStatusRegistry: Contract | null = null;
  private config: BlockchainConfig | null = null;
  private initialized = false;

  /**
   * Initialize blockchain service with environment variables
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    // Load configuration from environment variables
    const rpcUrl = process.env.BASE_RPC_URL;
    const chainId = process.env.BASE_CHAIN_ID;
    const didRegistryAddress = process.env.DID_REGISTRY_ADDRESS;
    const vcStatusRegistryAddress = process.env.VC_STATUS_REGISTRY_ADDRESS;

    if (!rpcUrl || !chainId || !didRegistryAddress || !vcStatusRegistryAddress) {
      throw new Error(
        'Missing blockchain configuration. Required env vars: BASE_RPC_URL, BASE_CHAIN_ID, DID_REGISTRY_ADDRESS, VC_STATUS_REGISTRY_ADDRESS',
      );
    }

    this.config = {
      rpcUrl,
      chainId: parseInt(chainId, 10),
      didRegistryAddress,
      vcStatusRegistryAddress,
    };

    // Create provider
    this.provider = new JsonRpcProvider(rpcUrl, this.config.chainId);

    // Create contract instances (read-only)
    this.didRegistry = new Contract(didRegistryAddress, DIDRegistryABI, this.provider);
    this.vcStatusRegistry = new Contract(vcStatusRegistryAddress, VCStatusRegistryABI, this.provider);

    this.initialized = true;
    console.log('[Blockchain] Service initialized');
    console.log(`  Network: Base Sepolia`);
    console.log(`  RPC: ${rpcUrl}`);
    console.log(`  Chain ID: ${this.config.chainId}`);
    console.log(`  DID Registry: ${didRegistryAddress}`);
    console.log(`  VC Status Registry: ${vcStatusRegistryAddress}`);
  }

  /**
   * Get signer from private key
   */
  private getSigner(privateKey: string): Wallet {
    if (!this.provider) {
      throw new Error('Blockchain service not initialized');
    }

    const cleanPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    return new Wallet(cleanPrivateKey, this.provider);
  }

  /**
   * Register DID on blockchain
   *
   * @param userAddress - Wallet address that owns this DID
   * @param did - DID string (e.g., "did:anam:issuer:0x...")
   * @param documentHash - Hash of DID Document (bytes32)
   * @param signerPrivateKey - Private key of the wallet that owns this DID
   * @returns Transaction result
   */
  async registerDID(
    userAddress: string,
    did: string,
    documentHash: string,
    signerPrivateKey: string,
  ): Promise<DIDRegistrationResult> {
    this.initialize();

    if (!this.didRegistry) {
      throw new Error('DID Registry contract not initialized');
    }

    console.log(`[Blockchain] Registering DID on-chain`);
    console.log(`  User Address: ${userAddress}`);
    console.log(`  DID: ${did}`);
    console.log(`  Document Hash: ${documentHash}`);

    try {
      const signer = this.getSigner(signerPrivateKey);
      const didRegistry = this.didRegistry;
      const didRegistryWithSigner = didRegistry.connect(signer) as Contract;

      // Call registerIdentity(address userAddress, string didString, bytes32 documentHash)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx: TransactionResponse = await (didRegistryWithSigner as any).registerIdentity(
        userAddress,
        did,
        documentHash,
      );

      console.log(`  Transaction sent: ${tx.hash}`);
      console.log('  Waiting for confirmation...');

      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error('Transaction receipt is null');
      }

      console.log(`  ✅ DID registered at block ${receipt.blockNumber}`);

      return {
        txHash: tx.hash,
        did,
        documentHash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      console.error('[Blockchain] Failed to register DID:', error);
      throw new Error(
        `Failed to register DID on blockchain: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get DID from wallet address
   * @param walletAddress - Wallet address
   * @returns DID string or empty string if not found
   */
  async getDIDByAddress(walletAddress: string): Promise<string> {
    this.initialize();

    if (!this.didRegistry) {
      throw new Error('DID Registry contract not initialized');
    }

    try {
      const didRegistry = this.didRegistry;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const did = await (didRegistry as any).addressToDID(walletAddress);
      return did as string;
    } catch (error) {
      console.error('[Blockchain] Failed to get DID by address:', error);
      throw new Error(`Failed to get DID from blockchain: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get wallet address from DID
   * @param did - DID string
   * @returns Wallet address or zero address if not found
   */
  async getAddressByDID(did: string): Promise<string> {
    this.initialize();

    if (!this.didRegistry) {
      throw new Error('DID Registry contract not initialized');
    }

    try {
      const didRegistry = this.didRegistry;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const address = await (didRegistry as any).didToAddress(did);
      return address as string;
    } catch (error) {
      console.error('[Blockchain] Failed to get address by DID:', error);
      throw new Error(
        `Failed to get address from blockchain: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get document hash by DID
   * @param did - DID string
   * @returns Document hash (bytes32) or zero bytes if not found
   */
  async getDocumentHashByDID(did: string): Promise<string> {
    this.initialize();

    if (!this.didRegistry) {
      throw new Error('DID Registry contract not initialized');
    }

    try {
      const didRegistry = this.didRegistry;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const documentHash = await (didRegistry as any).didToDocumentHash(did);
      return documentHash as string;
    } catch (error) {
      console.error('[Blockchain] Failed to get document hash by DID:', error);
      throw new Error(
        `Failed to get document hash from blockchain: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Register VC on blockchain
   *
   * @param vcId - VC ID (e.g., "vc:admin:uuid")
   * @param issuerPrivateKey - Private key of the issuer
   * @returns Transaction result
   */
  async registerVC(vcId: string, issuerPrivateKey: string): Promise<VCRegistrationResult> {
    this.initialize();

    if (!this.vcStatusRegistry) {
      throw new Error('VC Status Registry contract not initialized');
    }

    console.log(`[Blockchain] Registering VC on-chain`);
    console.log(`  VC ID: ${vcId}`);

    try {
      const signer = this.getSigner(issuerPrivateKey);
      const vcRegistry = this.vcStatusRegistry;
      const vcRegistryWithSigner = vcRegistry.connect(signer) as Contract;

      // Call registerVC(string vcId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx: TransactionResponse = await (vcRegistryWithSigner as any).registerVC(vcId);

      console.log(`  Transaction sent: ${tx.hash}`);
      console.log('  Waiting for confirmation...');

      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error('Transaction receipt is null');
      }

      console.log(`  ✅ VC registered at block ${receipt.blockNumber}`);

      return {
        txHash: tx.hash,
        vcId,
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      console.error('[Blockchain] Failed to register VC:', error);
      throw new Error(
        `Failed to register VC on blockchain: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Revoke VC on blockchain
   * @param vcId - VC ID
   * @param revokerPrivateKey - Private key of the issuer (only issuer can revoke)
   * @returns Transaction hash
   */
  async revokeVC(vcId: string, revokerPrivateKey: string): Promise<string> {
    this.initialize();

    if (!this.vcStatusRegistry) {
      throw new Error('VC Status Registry contract not initialized');
    }

    console.log(`[Blockchain] Revoking VC on-chain`);
    console.log(`  VC ID: ${vcId}`);

    try {
      const signer = this.getSigner(revokerPrivateKey);
      const vcRegistry = this.vcStatusRegistry;
      const vcRegistryWithSigner = vcRegistry.connect(signer) as Contract;

      // Call revokeVC(string vcId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx: TransactionResponse = await (vcRegistryWithSigner as any).revokeVC(vcId);

      console.log(`  Transaction sent: ${tx.hash}`);
      console.log('  Waiting for confirmation...');

      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error('Transaction receipt is null');
      }

      console.log(`  ✅ VC revoked at block ${receipt.blockNumber}`);

      return tx.hash;
    } catch (error) {
      console.error('[Blockchain] Failed to revoke VC:', error);
      throw new Error(`Failed to revoke VC on blockchain: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Suspend VC on blockchain
   * @param vcId - VC ID
   * @param issuerPrivateKey - Private key of the issuer
   * @returns Transaction hash
   */
  async suspendVC(vcId: string, issuerPrivateKey: string): Promise<string> {
    this.initialize();

    if (!this.vcStatusRegistry) {
      throw new Error('VC Status Registry contract not initialized');
    }

    console.log(`[Blockchain] Suspending VC on-chain`);
    console.log(`  VC ID: ${vcId}`);

    try {
      const signer = this.getSigner(issuerPrivateKey);
      const vcRegistry = this.vcStatusRegistry;
      const vcRegistryWithSigner = vcRegistry.connect(signer) as Contract;

      // Call suspendVC(string vcId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx: TransactionResponse = await (vcRegistryWithSigner as any).suspendVC(vcId);

      console.log(`  Transaction sent: ${tx.hash}`);
      console.log('  Waiting for confirmation...');

      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error('Transaction receipt is null');
      }

      console.log(`  ✅ VC suspended at block ${receipt.blockNumber}`);

      return tx.hash;
    } catch (error) {
      console.error('[Blockchain] Failed to suspend VC:', error);
      throw new Error(
        `Failed to suspend VC on blockchain: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Grant event-scoped role on LiberiaEvent contract
   * @param eventAddress - Deployed LiberiaEvent contract address
   * @param role - 'APPROVER' | 'VERIFIER'
   * @param account - Address to grant role to
   * @param signerPrivateKey - Private key with SYSTEM_ADMIN_ROLE on the event
   * @returns Transaction hash
   */
  async grantEventRole(
    eventAddress: string,
    role: 'APPROVER' | 'VERIFIER',
    account: string,
    signerPrivateKey: string,
  ): Promise<string> {
    this.initialize();

    if (!this.provider) {
      throw new Error('Blockchain service not initialized');
    }

    // Minimal ABI for AccessControl
    const EVENT_ROLE_ABI = [
      'function grantRole(bytes32 role, address account) external',
      'function hasRole(bytes32 role, address account) external view returns (bool)',
    ];

    // Resolve role selector via ethers.id
    const { id } = await import('ethers');
    const roleSelector = role === 'APPROVER' ? id('APPROVER_ROLE') : id('VERIFIER_ROLE');

    try {
      const signer = this.getSigner(signerPrivateKey);
      const contract = new Contract(eventAddress, EVENT_ROLE_ABI, signer);

      // Idempotency: skip if already granted
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const already = (await (contract as any).hasRole(roleSelector, account)) as boolean;
      if (already) {
        return 'already-assigned';
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx: any = await (contract as any).grantRole(roleSelector, account);
      const receipt = await tx.wait();
      if (!receipt) throw new Error('Transaction receipt is null');
      return tx.hash as string;
    } catch (error) {
      console.error('[Blockchain] Failed to grant event role:', error);
      throw new Error(
        `Failed to grant ${role}_ROLE on event: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Revoke event-scoped role on LiberiaEvent contract
   * @param eventAddress - Deployed LiberiaEvent contract address
   * @param role - 'APPROVER' | 'VERIFIER'
   * @param account - Address to revoke role from
   * @param signerPrivateKey - Private key with SYSTEM_ADMIN_ROLE on the event
   * @returns Transaction hash or 'already-revoked' when idempotent
   */
  async revokeEventRole(
    eventAddress: string,
    role: 'APPROVER' | 'VERIFIER',
    account: string,
    signerPrivateKey: string,
  ): Promise<string> {
    this.initialize();

    if (!this.provider) {
      throw new Error('Blockchain service not initialized');
    }

    const EVENT_ROLE_ABI = [
      'function revokeRole(bytes32 role, address account) external',
      'function hasRole(bytes32 role, address account) external view returns (bool)',
    ];

    const { id } = await import('ethers');
    const roleSelector = role === 'APPROVER' ? id('APPROVER_ROLE') : id('VERIFIER_ROLE');

    try {
      const signer = this.getSigner(signerPrivateKey);
      const contract = new Contract(eventAddress, EVENT_ROLE_ABI, signer);

      // Idempotency: if role already revoked, return a stable string
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const has = (await (contract as any).hasRole(roleSelector, account)) as boolean;
      if (!has) {
        return 'already-revoked';
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx: any = await (contract as any).revokeRole(roleSelector, account);
      const receipt = await tx.wait();
      if (!receipt) throw new Error('Transaction receipt is null');
      return tx.hash as string;
    } catch (error) {
      console.error('[Blockchain] Failed to revoke event role:', error);
      throw new Error(
        `Failed to revoke ${role}_ROLE on event: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Activate VC on blockchain (from suspended state)
   * @param vcId - VC ID
   * @param issuerPrivateKey - Private key of the issuer
   * @returns Transaction hash
   */
  async activateVC(vcId: string, issuerPrivateKey: string): Promise<string> {
    this.initialize();

    if (!this.vcStatusRegistry) {
      throw new Error('VC Status Registry contract not initialized');
    }

    console.log(`[Blockchain] Activating VC on-chain`);
    console.log(`  VC ID: ${vcId}`);

    try {
      const signer = this.getSigner(issuerPrivateKey);
      const vcRegistry = this.vcStatusRegistry;
      const vcRegistryWithSigner = vcRegistry.connect(signer) as Contract;

      // Call activateVC(string vcId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx: TransactionResponse = await (vcRegistryWithSigner as any).activateVC(vcId);

      console.log(`  Transaction sent: ${tx.hash}`);
      console.log('  Waiting for confirmation...');

      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error('Transaction receipt is null');
      }

      console.log(`  ✅ VC activated at block ${receipt.blockNumber}`);

      return tx.hash;
    } catch (error) {
      console.error('[Blockchain] Failed to activate VC:', error);
      throw new Error(
        `Failed to activate VC on blockchain: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Transfer ERC20 tokens (e.g., USDC) to a recipient
   * @param tokenAddress ERC20 token address
   * @param to Recipient address
   * @param amount Base units amount (e.g., 6 decimals for USDC)
   * @param signerPrivateKey Sender private key
   * @returns Transaction hash
   */
  async transferERC20(tokenAddress: string, to: string, amount: bigint, signerPrivateKey: string): Promise<string> {
    this.initialize();

    if (!this.provider) throw new Error('Blockchain service not initialized');
    if (!tokenAddress || !to) throw new Error('Invalid token or recipient address');
    if (amount <= BigInt(0)) throw new Error('Transfer amount must be greater than zero');

    // Minimal ERC20 ABI
    const ERC20_ABI = [
      'function transfer(address to, uint256 amount) external returns (bool)',
      'function balanceOf(address owner) external view returns (uint256)',
    ];

    try {
      const signer = this.getSigner(signerPrivateKey);
      const token = new Contract(tokenAddress, ERC20_ABI, signer);

      // Optional: balance check before transfer
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bal = (await (token as any).balanceOf(await signer.getAddress())) as bigint;
      if (bal < amount) {
        throw new Error('Insufficient token balance for funding');
      }

      const tx = await (
        token as unknown as { transfer: (to: string, amount: bigint) => Promise<TransactionResponse> }
      ).transfer(to, amount);
      const receipt = await tx.wait();
      if (!receipt) throw new Error('Transaction receipt is null');
      return tx.hash as string;
    } catch (error) {
      console.error('[Blockchain] ERC20 transfer failed:', error);
      throw new Error(`ERC20 transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get VC status from blockchain
   * @param vcId - VC ID
   * @returns VC status and revoked timestamp
   */
  async getVCStatus(vcId: string): Promise<VCStatusOnChain> {
    this.initialize();

    if (!this.vcStatusRegistry) {
      throw new Error('VC Status Registry contract not initialized');
    }

    try {
      const vcRegistry = this.vcStatusRegistry;

      // Call vcStatus(string vcId) - returns enum uint8
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const status = await (vcRegistry as any).vcStatus(vcId);

      // Call revokedAt(string vcId) - returns uint256
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const revokedAt = await (vcRegistry as any).revokedAt(vcId);

      return {
        status: status as VCStatus,
        revokedAt: revokedAt as bigint,
      };
    } catch (error) {
      console.error('[Blockchain] Failed to get VC status:', error);
      throw new Error(
        `Failed to get VC status from blockchain: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Check if blockchain service is available
   */
  isAvailable(): boolean {
    try {
      this.initialize();
      return this.initialized && this.provider !== null;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const blockchainService = new BlockchainService();
