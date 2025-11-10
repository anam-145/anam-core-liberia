import { encryptVault, decryptVault, verifyVaultPassword } from '../vault';

describe('Vault Encryption/Decryption', () => {
  const testMnemonic = 'test test test test test test test test test test test junk';
  const testPassword = 'TestPassword123!';
  const wrongPassword = 'WrongPassword456!';

  it('should encrypt a mnemonic into a vault', () => {
    const vault = encryptVault(testMnemonic, testPassword);

    expect(vault).toHaveProperty('ciphertext');
    expect(vault).toHaveProperty('iv');
    expect(vault).toHaveProperty('salt');
    expect(vault).toHaveProperty('authTag');

    // All values should be base64 encoded
    expect(vault.ciphertext).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(vault.iv).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(vault.salt).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(vault.authTag).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it('should decrypt a vault with correct password', () => {
    const vault = encryptVault(testMnemonic, testPassword);
    const decrypted = decryptVault(vault, testPassword);

    expect(decrypted).toBe(testMnemonic);
  });

  it('should fail to decrypt with wrong password', () => {
    const vault = encryptVault(testMnemonic, testPassword);

    expect(() => {
      decryptVault(vault, wrongPassword);
    }).toThrow('Invalid password or corrupted vault');
  });

  it('should verify correct password', () => {
    const vault = encryptVault(testMnemonic, testPassword);

    expect(verifyVaultPassword(vault, testPassword)).toBe(true);
    expect(verifyVaultPassword(vault, wrongPassword)).toBe(false);
  });

  it('should generate different vaults for same mnemonic', () => {
    const vault1 = encryptVault(testMnemonic, testPassword);
    const vault2 = encryptVault(testMnemonic, testPassword);

    // Due to random salt and IV, vaults should be different
    expect(vault1.ciphertext).not.toBe(vault2.ciphertext);
    expect(vault1.salt).not.toBe(vault2.salt);
    expect(vault1.iv).not.toBe(vault2.iv);

    // But both should decrypt to same mnemonic
    expect(decryptVault(vault1, testPassword)).toBe(testMnemonic);
    expect(decryptVault(vault2, testPassword)).toBe(testMnemonic);
  });

  it('should detect tampered vault data', () => {
    const vault = encryptVault(testMnemonic, testPassword);

    // Tamper with the ciphertext
    const tamperedVault = {
      ...vault,
      ciphertext: vault.ciphertext.slice(0, -2) + 'XX',
    };

    expect(() => {
      decryptVault(tamperedVault, testPassword);
    }).toThrow('Invalid password or corrupted vault');
  });
});
