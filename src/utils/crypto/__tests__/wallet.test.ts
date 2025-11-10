/** @jest-environment node */

import {
  generateMnemonic,
  validateMnemonic,
  createWalletFromMnemonic,
  generateWallet,
  deriveKey,
  getAddressFromPrivateKey,
  signMessage,
  verifyMessage,
} from '../wallet';

describe('Wallet Utilities', () => {
  // Valid BIP39 test mnemonic
  const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const testPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

  describe('Mnemonic Generation', () => {
    it('should generate a valid 12-word mnemonic', () => {
      const mnemonic = generateMnemonic();
      const words = mnemonic.split(' ');

      expect(words).toHaveLength(12);
      expect(validateMnemonic(mnemonic)).toBe(true);
    });

    it('should validate correct mnemonic', () => {
      expect(validateMnemonic(testMnemonic)).toBe(true);
    });

    it('should reject invalid mnemonic', () => {
      expect(validateMnemonic('invalid mnemonic phrase')).toBe(false);
    });
  });

  describe('Wallet Creation', () => {
    it('should create wallet from mnemonic', () => {
      const wallet = createWalletFromMnemonic(testMnemonic);

      expect(wallet).toHaveProperty('mnemonic');
      expect(wallet).toHaveProperty('privateKey');
      expect(wallet).toHaveProperty('publicKey');
      expect(wallet).toHaveProperty('address');
      expect(wallet.mnemonic).toBe(testMnemonic);
      expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should generate a new wallet', () => {
      const wallet = generateWallet();

      expect(validateMnemonic(wallet.mnemonic)).toBe(true);
      expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should derive consistent addresses from same mnemonic', () => {
      const wallet1 = createWalletFromMnemonic(testMnemonic);
      const wallet2 = createWalletFromMnemonic(testMnemonic);

      expect(wallet1.address).toBe(wallet2.address);
      expect(wallet1.privateKey).toBe(wallet2.privateKey);
    });
  });

  describe('Key Derivation', () => {
    it('should derive keys at different paths', () => {
      const key0 = deriveKey(testMnemonic, "m/44'/60'/0'/0/0");
      const key1 = deriveKey(testMnemonic, "m/44'/60'/0'/0/1");

      expect(key0.address).not.toBe(key1.address);
      expect(key0.privateKey).not.toBe(key1.privateKey);
    });

    it('should get address from private key', () => {
      const address = getAddressFromPrivateKey(testPrivateKey);
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  describe('Message Signing', () => {
    it('should sign and verify message', async () => {
      const message = 'Hello, World!';
      const wallet = generateWallet();

      const signature = await signMessage(message, wallet.privateKey);
      expect(signature).toBeTruthy();

      const isValid = verifyMessage(message, signature, wallet.address);
      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', async () => {
      const message = 'Hello, World!';
      const wallet1 = generateWallet();
      const wallet2 = generateWallet();

      const signature = await signMessage(message, wallet1.privateKey);
      const isValid = verifyMessage(message, signature, wallet2.address);

      expect(isValid).toBe(false);
    });
  });
});
