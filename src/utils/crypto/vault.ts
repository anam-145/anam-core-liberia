/**
 * Vault Encryption/Decryption Utilities
 *
 * Implements AES-256-GCM encryption with PBKDF2 key derivation
 * as specified in section 5.3 of the system design document
 */

import { randomBytes, pbkdf2Sync, createCipheriv, createDecipheriv } from 'crypto';

export interface Vault {
  ciphertext: string; // Encrypted mnemonic
  iv: string; // Initialization vector
  salt: string; // PBKDF2 salt
  authTag: string; // Authentication tag
}

export interface VaultOptions {
  iterations?: number; // PBKDF2 iterations (default: 10000)
  saltLength?: number; // Salt length in bytes (default: 16)
  ivLength?: number; // IV length in bytes (default: 12 for GCM)
}

const DEFAULT_OPTIONS: Required<VaultOptions> = {
  iterations: 10000,
  saltLength: 16, // 128 bits
  ivLength: 12, // 96 bits for GCM
};

/**
 * Derives an AES key from a password using PBKDF2
 */
function deriveKey(password: string, salt: Buffer, iterations: number): Buffer {
  return pbkdf2Sync(password, salt, iterations, 32, 'sha256'); // 256-bit key
}

/**
 * Encrypts a mnemonic phrase into a vault
 * @param mnemonic - The BIP39 mnemonic phrase to encrypt
 * @param password - The user's password for encryption
 * @param options - Optional encryption parameters
 * @returns Encrypted vault object
 */
export function encryptVault(mnemonic: string, password: string, options: VaultOptions = {}): Vault {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Generate random salt and IV
  const salt = randomBytes(opts.saltLength);
  const iv = randomBytes(opts.ivLength);

  // Derive key from password
  const key = deriveKey(password, salt, opts.iterations);

  // Create cipher
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  // Encrypt the mnemonic
  const encrypted = Buffer.concat([cipher.update(mnemonic, 'utf8'), cipher.final()]);

  // Get the authentication tag
  const authTag = cipher.getAuthTag();

  // Clear sensitive data from memory
  key.fill(0);

  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    salt: salt.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

/**
 * Decrypts a vault to retrieve the mnemonic phrase
 * @param vault - The encrypted vault object
 * @param password - The user's password for decryption
 * @returns The decrypted mnemonic phrase
 * @throws Error if decryption fails (wrong password or corrupted data)
 */
export function decryptVault(vault: Vault, password: string): string {
  try {
    // Decode from base64
    const salt = Buffer.from(vault.salt, 'base64');
    const iv = Buffer.from(vault.iv, 'base64');
    const authTag = Buffer.from(vault.authTag, 'base64');
    const ciphertext = Buffer.from(vault.ciphertext, 'base64');

    // Derive key from password (use same iterations as encryption)
    const key = deriveKey(password, salt, DEFAULT_OPTIONS.iterations);

    // Create decipher
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt the ciphertext
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    // Clear sensitive data from memory
    key.fill(0);

    return decrypted.toString('utf8');
  } catch {
    // Auth tag verification failure means wrong password or tampered data
    throw new Error('Invalid password or corrupted vault');
  }
}

/**
 * Verifies a password against a vault without decrypting
 * @param vault - The encrypted vault object
 * @param password - The password to verify
 * @returns true if password is correct, false otherwise
 */
export function verifyVaultPassword(vault: Vault, password: string): boolean {
  try {
    decryptVault(vault, password);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generates a random password of specified length
 * @param length - Password length (default: 16)
 * @returns Random password string
 */
export function generatePassword(length: number = 16): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const randomBytesBuffer = randomBytes(length);
  let password = '';

  for (let i = 0; i < length; i++) {
    password += charset[randomBytesBuffer[i]! % charset.length];
  }

  return password;
}
