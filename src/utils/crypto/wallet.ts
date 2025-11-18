/**
 * Wallet Utilities
 *
 * Implements BIP39/BIP32/BIP44 wallet generation and key derivation
 * using ethers.js library
 */

import { ethers } from 'ethers';

export interface WalletInfo {
  mnemonic: string;
  seed: string;
  privateKey: string;
  publicKey: string;
  address: string;
}

export interface DerivedKey {
  privateKey: string;
  publicKey: string;
  address: string;
  path: string;
}

/**
 * Generates a new BIP39 mnemonic phrase
 * @returns BIP39 mnemonic phrase (12 words by default)
 */
export function generateMnemonic(): string {
  // Use ethers built-in mnemonic generation
  const wallet = ethers.Wallet.createRandom();
  return wallet.mnemonic!.phrase;
}

/**
 * Validates a BIP39 mnemonic phrase
 * @param mnemonic - The mnemonic phrase to validate
 * @returns true if valid, false otherwise
 */
export function validateMnemonic(mnemonic: string): boolean {
  return ethers.Mnemonic.isValidMnemonic(mnemonic);
}

/**
 * Creates a wallet from a mnemonic phrase
 * @param mnemonic - BIP39 mnemonic phrase
 * @param path - Derivation path (default: Ethereum standard)
 * @returns Wallet information
 */
export function createWalletFromMnemonic(mnemonic: string, path: string = "m/44'/60'/0'/0/0"): WalletInfo {
  if (!validateMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic phrase');
  }

  // Create HD wallet directly from mnemonic using ethers
  const wallet = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, path);
  // Ensure uncompressed 65-byte public key (0x04 + 64 bytes)
  const uncompressedPublicKey = new ethers.Wallet(wallet.privateKey).signingKey.publicKey;

  return {
    mnemonic,
    seed: wallet.mnemonic!.computeSeed(),
    privateKey: wallet.privateKey,
    publicKey: uncompressedPublicKey,
    address: wallet.address,
  };
}

/**
 * Generates a new wallet with a random mnemonic
 * @returns Wallet information
 */
export function generateWallet(): WalletInfo {
  const mnemonic = generateMnemonic();
  return createWalletFromMnemonic(mnemonic);
}

/**
 * Derives a key from a mnemonic at a specific path
 * @param mnemonic - BIP39 mnemonic phrase
 * @param path - BIP44 derivation path
 * @returns Derived key information
 */
export function deriveKey(mnemonic: string, path: string): DerivedKey {
  if (!validateMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic phrase');
  }

  // Create HD wallet directly from mnemonic using ethers
  const wallet = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, path);
  // Ensure uncompressed public key
  const uncompressedPublicKey = new ethers.Wallet(wallet.privateKey).signingKey.publicKey;

  return {
    privateKey: wallet.privateKey,
    publicKey: uncompressedPublicKey,
    address: wallet.address,
    path,
  };
}

/**
 * Derives multiple keys from a mnemonic
 * @param mnemonic - BIP39 mnemonic phrase
 * @param count - Number of keys to derive
 * @param basePath - Base derivation path
 * @returns Array of derived keys
 */
export function deriveKeys(mnemonic: string, count: number, basePath: string = "m/44'/60'/0'/0"): DerivedKey[] {
  const keys: DerivedKey[] = [];

  for (let i = 0; i < count; i++) {
    const path = `${basePath}/${i}`;
    keys.push(deriveKey(mnemonic, path));
  }

  return keys;
}

/**
 * Gets the address from a private key
 * @param privateKey - The private key (with or without 0x prefix)
 * @returns Ethereum address
 */
export function getAddressFromPrivateKey(privateKey: string): string {
  const wallet = new ethers.Wallet(privateKey);
  return wallet.address;
}

/**
 * Gets the address from a public key
 * @param publicKey - The public key (compressed or uncompressed, with or without 0x prefix)
 * @returns Ethereum address
 */
export function getAddressFromPublicKey(publicKey: string): string {
  // Remove 0x prefix if present
  const cleanPublicKey = publicKey.startsWith('0x') ? publicKey.slice(2) : publicKey;

  // Convert to uncompressed format if compressed (33 bytes starting with 02 or 03)
  let uncompressedKey = cleanPublicKey;
  if (cleanPublicKey.length === 66) {
    // Compressed public key (33 bytes)
    // For compressed keys, we need to use computeAddress directly
    return ethers.computeAddress('0x' + cleanPublicKey);
  }

  // For uncompressed keys (65 bytes starting with 04, or 64 bytes without prefix)
  if (cleanPublicKey.length === 130 && cleanPublicKey.startsWith('04')) {
    uncompressedKey = cleanPublicKey.slice(2); // Remove the '04' prefix
  } else if (cleanPublicKey.length === 128) {
    // Already without prefix
    uncompressedKey = cleanPublicKey;
  }

  // Compute address from public key
  return ethers.computeAddress('0x04' + uncompressedKey);
}

/**
 * Signs a message with a private key
 * @param message - The message to sign
 * @param privateKey - The private key to sign with
 * @returns Signature string
 */
export async function signMessage(message: string, privateKey: string): Promise<string> {
  const wallet = new ethers.Wallet(privateKey);
  return await wallet.signMessage(message);
}

/**
 * Verifies a message signature
 * @param message - The original message
 * @param signature - The signature to verify
 * @param address - The expected signer's address
 * @returns true if signature is valid, false otherwise
 */
export function verifyMessage(message: string, signature: string, address: string): boolean {
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === address.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Creates a deterministic wallet for a specific chain
 * @param mnemonic - BIP39 mnemonic phrase
 * @param chainId - Chain ID (e.g., 1 for Ethereum mainnet, 8453 for Base)
 * @returns Wallet information for the specific chain
 */
export function createChainWallet(mnemonic: string, chainId: number): WalletInfo {
  // Use chain-specific path
  // Common paths:
  // Ethereum: m/44'/60'/0'/0/0
  // Bitcoin: m/44'/0'/0'/0/0
  // We'll use Ethereum path for all EVM chains
  const path = `m/44'/60'/${chainId}'/0/0`;
  return createWalletFromMnemonic(mnemonic, path);
}

/**
 * Generates a random private key
 * @returns Random private key as hex string
 */
export function generatePrivateKey(): string {
  const randomBytes = ethers.randomBytes(32);
  return ethers.hexlify(randomBytes);
}

/**
 * Creates a wallet from a private key
 * @param privateKey - The private key
 * @returns Wallet information (without mnemonic)
 */
export function createWalletFromPrivateKey(privateKey: string): Omit<WalletInfo, 'mnemonic' | 'seed'> {
  const wallet = new ethers.Wallet(privateKey);
  const publicKey = wallet.signingKey.publicKey;

  return {
    privateKey: wallet.privateKey,
    publicKey: publicKey,
    address: wallet.address,
  };
}
