/** @jest-environment node */

/**
 * 시나리오(Admin VC End-to-End)
 * - Issuer 키를 ENV(SYSTEM_ADMIN_MNEMONIC)에서 복원(결정론적)
 * - User 지갑 생성(랜덤) → DID/Document/Hash 생성
 * - ADMIN VC 생성/서명( proof.jws )/검증
 * - Vault 암호화/복호화 (mnemonic, VC JSON)
 * - VP 생성/서명/검증 + 음성(변조)
 */

import { createWalletFromMnemonic, generateWallet } from '@/utils/crypto/wallet';
import {
  createDIDWithAddress,
  createDIDDocument,
  hashDIDDocument,
  createVC,
  signVC,
  verifyVCSignature,
  createVP,
  signVP,
  verifyVPSignature,
  generateChallenge,
  type VerifiableCredential,
  type VerifiablePresentation,
} from '@/utils/crypto/did';
import { encryptVault, decryptVault } from '@/utils/crypto/vault';

describe('Admin VC End-to-End (v2)', () => {
  let issuerMnemonic: string;
  let userPassword: string;

  beforeAll(() => {
    issuerMnemonic =
      process.env.SYSTEM_ADMIN_MNEMONIC ||
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    userPassword = 'SecurePassword123!';
  });

  let issuerWallet: ReturnType<typeof createWalletFromMnemonic>;
  let issuerDID: string;
  // NOTE: 문서 해시의 결정론성은 각 it 블록에서 바로 검증하며,
  // 해시 값을 외부로 보관하지 않습니다.

  let userWallet: ReturnType<typeof generateWallet>;
  let userDID: string;
  // (위와 동일)

  let adminVC: VerifiableCredential;
  let signedVC: VerifiableCredential;
  let challenge: string;
  let unsignedVP: VerifiablePresentation;
  let signedVP: VerifiablePresentation;

  let mnemonicVault: ReturnType<typeof encryptVault>;
  let vcVault: ReturnType<typeof encryptVault>;

  it('ENV 니모닉에서 Issuer 지갑 복원 및 DID/Document 해시 생성', () => {
    issuerWallet = createWalletFromMnemonic(issuerMnemonic);
    expect(issuerWallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(issuerWallet.publicKey).toMatch(/^(0x04[a-fA-F0-9]{128}|0x0[23][a-fA-F0-9]{64})$/);
    expect(issuerWallet.privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);

    const { did: iDid } = createDIDWithAddress('issuer', issuerWallet.address);
    issuerDID = iDid;
    expect(issuerDID).toMatch(/^did:anam:issuer:0x[a-fA-F0-9]{40}$/);

    const issuerDoc = createDIDDocument(issuerDID, issuerWallet.address, issuerWallet.publicKey, issuerDID);
    const h1 = hashDIDDocument(issuerDoc);
    const h2 = hashDIDDocument(issuerDoc);
    // 결정론성 체크만 수행
    expect(h1).toMatch(/^0x[a-fA-F0-9]{64}$/);
    expect(h1).toBe(h2);
  });

  it('User 지갑/DID/Document/해시 생성', () => {
    userWallet = generateWallet();
    expect(userWallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(userWallet.mnemonic.split(' ')).toHaveLength(12);

    const { did: uDid } = createDIDWithAddress('user', userWallet.address);
    userDID = uDid;
    expect(userDID).toMatch(/^did:anam:user:0x[a-fA-F0-9]{40}$/);

    const userDoc = createDIDDocument(userDID, userWallet.address, userWallet.publicKey, userDID);
    const uh = hashDIDDocument(userDoc);
    // 결정론성 체크만 수행
    expect(uh).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });

  it('ADMIN VC 생성 → proof.jws 서명 → 검증', async () => {
    const { generateUndpVCId } = await import('@/utils/crypto/did');
    const vcId = generateUndpVCId();
    const subject = { username: 'john.doe', fullName: 'John Doe' };

    adminVC = createVC(issuerDID, userDID, 'UndpAdminCredential', subject, vcId, 730);

    expect(adminVC.id).toBe(vcId);
    expect(adminVC.issuer.id).toBe(issuerDID);
    expect(adminVC.credentialSubject.id).toBe(userDID);
    expect(adminVC.type).toContain('VerifiableCredential');
    expect(adminVC.type).toContain('UndpAdminCredential');

    const verificationMethod = `${issuerDID}#keys-1`;
    signedVC = await signVC(adminVC, issuerWallet.privateKey, verificationMethod);
    expect(signedVC.proof).toBeDefined();
    expect(signedVC.proof!.verificationMethod).toBe(verificationMethod);

    const ok = verifyVCSignature(signedVC, issuerWallet.address);
    expect(ok).toBe(true);

    const tampered = {
      ...signedVC,
      credentialSubject: { id: userDID, username: 'evil', fullName: 'Hacker' },
    } as VerifiableCredential;
    expect(verifyVCSignature(tampered, issuerWallet.address)).toBe(false);
  });

  it('니모닉/VC JSON 암호화 → 복호화 시 원본과 동일', () => {
    mnemonicVault = encryptVault(userWallet.mnemonic, userPassword);
    expect(mnemonicVault.ciphertext).toBeTruthy();

    const vcString = JSON.stringify(signedVC);
    vcVault = encryptVault(vcString, userPassword);
    expect(vcVault.ciphertext).toBeTruthy();

    const decryptedMnemonic = decryptVault(mnemonicVault, userPassword);
    expect(decryptedMnemonic).toBe(userWallet.mnemonic);
    const restored = createWalletFromMnemonic(decryptedMnemonic);
    expect(restored.address).toBe(userWallet.address);
    expect(restored.publicKey).toBe(userWallet.publicKey);

    const decryptedVCString = decryptVault(vcVault, userPassword);
    const decryptedVC = JSON.parse(decryptedVCString) as VerifiableCredential;
    expect(decryptedVC.id).toBe(signedVC.id);
    expect(decryptedVC.proof!.jws).toBe(signedVC.proof!.jws);
  });

  it('VP를 생성/서명하고 challenge 변조 시 실패', async () => {
    challenge = generateChallenge(32);
    expect(challenge).toMatch(/^0x[0-9a-fA-F]{64}$/);

    unsignedVP = createVP(userDID, [signedVC], challenge);
    expect(unsignedVP.proof).toBeDefined();
    expect(unsignedVP.proof!.jws).toBeUndefined();

    signedVP = await signVP(unsignedVP, userWallet.privateKey);
    expect(typeof signedVP.proof!.jws).toBe('string');

    expect(verifyVPSignature(signedVP, userWallet.address)).toBe(true);

    const forged = {
      ...signedVP,
      proof: { ...signedVP.proof!, challenge: generateChallenge(32) },
    } as VerifiablePresentation;
    expect(verifyVPSignature(forged, userWallet.address)).toBe(false);
  });
});
