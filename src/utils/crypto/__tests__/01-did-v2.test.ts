/** @jest-environment node */

import { ethers } from 'ethers';
import {
  createDIDWithAddress,
  createDIDDocument,
  createVC,
  signVC,
  verifyVCSignature,
  type VerifiableCredential,
} from '../did';
import { generateUndpVCId } from '../did';

/**
 * 시나리오(DID/VC v2 기본)
 * - Issuer/Holder 지갑 생성 → DID/DID Document 생성
 * - VC 발급: validFrom/validUntil 사용, proof.jws로 서명
 * - VC 검증: jws로 유효성 확인, 변조 시 실패
 */
describe('DID/VC v2 – JWS + 유효기간', () => {
  const issuerWallet = ethers.Wallet.createRandom();
  const userWallet = ethers.Wallet.createRandom();

  it('Issuer/User DID Document를 생성하고 역할별 메서드가 올바른지 확인한다', () => {
    const { did: issuerDID } = createDIDWithAddress('issuer', issuerWallet.address);
    const { did: userDID } = createDIDWithAddress('user', userWallet.address);

    const issuerDoc = createDIDDocument(issuerDID, issuerWallet.address, issuerWallet.signingKey.publicKey);
    const userDoc = createDIDDocument(userDID, userWallet.address, userWallet.signingKey.publicKey);

    // Common checks
    expect(issuerDoc['@context']).toBe('https://www.w3.org/ns/did/v1');
    expect(issuerDoc.id).toBe(issuerDID);
    expect(issuerDoc.type).toBe('ISSUER');
    expect(issuerDoc.verificationMethod[0]!.id).toBe(`${issuerDID}#keys-1`);
    expect(issuerDoc.verificationMethod[0]!.controller).toBe(issuerDID);
    expect(issuerDoc.verificationMethod[0]!.publicKeyHex).toBe(issuerWallet.signingKey.publicKey);
    expect(issuerDoc.verificationMethod[0]!.blockchainAccountId).toContain(issuerWallet.address);

    expect(userDoc['@context']).toBe('https://www.w3.org/ns/did/v1');
    expect(userDoc.id).toBe(userDID);
    expect(userDoc.type).toBe('USER');
    expect(userDoc.verificationMethod[0]!.id).toBe(`${userDID}#keys-1`);
    expect(userDoc.verificationMethod[0]!.controller).toBe(userDID);
    expect(userDoc.verificationMethod[0]!.publicKeyHex).toBe(userWallet.signingKey.publicKey);
    expect(userDoc.verificationMethod[0]!.blockchainAccountId).toContain(userWallet.address);

    // Role-specific methods
    expect(issuerDoc.assertionMethod).toContain(`${issuerDID}#keys-1`);
    expect(issuerDoc.authentication).toBeUndefined();

    expect(userDoc.authentication).toContain(`${userDID}#keys-1`);
    expect(userDoc.assertionMethod).toBeUndefined();
  });

  it('VC를 발급( proof.jws )하고 유효기간 검증을 통과한다', async () => {
    const { did: issuerDID } = createDIDWithAddress('issuer', issuerWallet.address);
    const { did: userDID } = createDIDWithAddress('user', userWallet.address);

    const vcId = generateUndpVCId();
    const unsignedVC: VerifiableCredential = createVC(
      issuerDID,
      userDID,
      'UndpKycCredential',
      { name: 'Test User', verifiedAt: new Date().toISOString() },
      vcId,
      365,
    );

    // validFrom/validUntil must exist (validFrom required)
    expect(unsignedVC.validFrom).toBeDefined();
    expect(unsignedVC.validUntil).toBeDefined();
    expect(unsignedVC).not.toHaveProperty('issuanceDate');
    expect(unsignedVC).not.toHaveProperty('expirationDate');

    const verificationMethod = `${issuerDID}#keys-1`;
    const signedVC = await signVC(unsignedVC, issuerWallet.privateKey, verificationMethod);

    expect(signedVC.proof).toBeDefined();
    expect(signedVC.proof!.jws).toBeDefined();
    expect(signedVC.proof!.verificationMethod).toBe(verificationMethod);
    expect(signedVC.proof!.type).toBe('EcdsaSecp256k1Signature2019');

    const ok = verifyVCSignature(signedVC, issuerWallet.address);
    expect(ok).toBe(true);

    // 음성: VC 내용을 변조하면 검증이 실패해야 한다
    const tampered: VerifiableCredential = {
      ...signedVC,
      credentialSubject: { id: userDID, name: 'Another', hacked: true },
    };
    expect(verifyVCSignature(tampered, issuerWallet.address)).toBe(false);
  });
});
