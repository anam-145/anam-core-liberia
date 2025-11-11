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

// 니모닉 생성부터 키 파생·서명·검증까지 지갑 워크플로우 검증
describe('Wallet Utilities', () => {
  // Valid BIP39 test mnemonic
  const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const testPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

  // 니모닉 생성 기능 검증
  describe('Mnemonic Generation', () => {
    // 12단어 니모닉 생성 확인
    it('should generate a valid 12-word mnemonic', () => {
      const mnemonic = generateMnemonic();
      const words = mnemonic.split(' ');

      expect(words).toHaveLength(12);
      expect(validateMnemonic(mnemonic)).toBe(true);
    });

    // 올바른 니모닉 검증 확인
    it('should validate correct mnemonic', () => {
      expect(validateMnemonic(testMnemonic)).toBe(true);
    });

    // 잘못된 니모닉 거부 확인
    it('should reject invalid mnemonic', () => {
      expect(validateMnemonic('invalid mnemonic phrase')).toBe(false);
    });
  });

  // 니모닉 기반 지갑 생성 검증
  describe('Wallet Creation', () => {
    // 니모닉으로 지갑 생성 확인
    it('should create wallet from mnemonic', () => {
      const wallet = createWalletFromMnemonic(testMnemonic);

      expect(wallet).toHaveProperty('mnemonic');
      expect(wallet).toHaveProperty('privateKey');
      expect(wallet).toHaveProperty('publicKey');
      expect(wallet).toHaveProperty('address');
      expect(wallet.mnemonic).toBe(testMnemonic);
      expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    // 랜덤 지갑 생성 확인
    it('should generate a new wallet', () => {
      const wallet = generateWallet();

      expect(validateMnemonic(wallet.mnemonic)).toBe(true);
      expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    // 같은 니모닉에서 동일 주소 도출 확인
    it('should derive consistent addresses from same mnemonic', () => {
      const wallet1 = createWalletFromMnemonic(testMnemonic);
      const wallet2 = createWalletFromMnemonic(testMnemonic);

      expect(wallet1.address).toBe(wallet2.address);
      expect(wallet1.privateKey).toBe(wallet2.privateKey);
    });
  });

  // 파생 키와 주소 계산 검증
  describe('Key Derivation', () => {
    // 경로별 파생 결과 차이 확인
    it('should derive keys at different paths', () => {
      const key0 = deriveKey(testMnemonic, "m/44'/60'/0'/0/0");
      const key1 = deriveKey(testMnemonic, "m/44'/60'/0'/0/1");

      expect(key0.address).not.toBe(key1.address);
      expect(key0.privateKey).not.toBe(key1.privateKey);
    });

    // 프라이빗 키로 주소 생성 확인
    it('should get address from private key', () => {
      const address = getAddressFromPrivateKey(testPrivateKey);
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  // 메시지 서명 및 검증 흐름 검증
  describe('Message Signing', () => {
    // 서명 후 검증 성공 확인
    it('should sign and verify message', async () => {
      const message = 'Hello, World!';
      const wallet = generateWallet();

      const signature = await signMessage(message, wallet.privateKey);
      expect(signature).toBeTruthy();

      const isValid = verifyMessage(message, signature, wallet.address);
      expect(isValid).toBe(true);
    });

    // 다른 주소로 검증 실패 확인
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
