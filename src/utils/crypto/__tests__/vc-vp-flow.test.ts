/**
 * VC/VP End-to-End Flow Integration Test
 *
 * Scenario:
 * 1. User and Issuer keypair generation
 * 2. User DID creation
 * 3. Issuer DID creation
 * 4. Issuer issues and signs VC for User
 * 5. Verifier generates challenge
 * 6. User creates and signs VP (including VC)
 * 7. Verifier verifies VP
 * 8. Verifier verifies VC
 */

import { ethers } from 'ethers';
import {
  createDID,
  createDIDDocument,
  createVC,
  signVC,
  createVP,
  signVP,
  verifyVCSignature,
  verifyVPSignature,
  generateChallenge,
  type VerifiableCredential,
  type VerifiablePresentation,
} from '../did';

// VC/VP 전체 흐름 통합 테스트 (User → Issuer → Verifier)
describe('VC/VP End-to-End Flow Integration Test', () => {
  // Test wallets with fixed private keys for predictable testing
  const USER_PRIVATE_KEY = '0x1234567890123456789012345678901234567890123456789012345678901234';
  const ISSUER_PRIVATE_KEY = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd';

  const userWallet = new ethers.Wallet(USER_PRIVATE_KEY);
  const issuerWallet = new ethers.Wallet(ISSUER_PRIVATE_KEY);

  // 65-byte uncompressed public key (0x04 + 64 bytes coordinates)
  const userPublicKeyHex = userWallet.signingKey.publicKey;
  const issuerPublicKeyHex = issuerWallet.signingKey.publicKey;

  let userDID: string;
  let issuerDID: string;

  // Step 1-2: DID 생성
  describe('DID Creation', () => {
    // User DID를 생성할 수 있어야 함
    it('should create user DID', () => {
      userDID = createDID('user');

      expect(userDID).toBeDefined();
      expect(userDID).toMatch(/^did:anam:undp-lr:user:/);

      const userDIDDoc = createDIDDocument(userDID, userWallet.address, userPublicKeyHex);

      expect(userDIDDoc.id).toBe(userDID);
      expect(userDIDDoc.type).toBe('USER');
      expect(userDIDDoc.authentication).toBeDefined();
    });

    // Issuer DID를 생성할 수 있어야 함
    it('should create issuer DID', () => {
      issuerDID = createDID('issuer');

      expect(issuerDID).toBeDefined();
      expect(issuerDID).toMatch(/^did:anam:undp-lr:issuer:/);

      const issuerDIDDoc = createDIDDocument(issuerDID, issuerWallet.address, issuerPublicKeyHex);

      expect(issuerDIDDoc.id).toBe(issuerDID);
      expect(issuerDIDDoc.type).toBe('ISSUER');
      expect(issuerDIDDoc.assertionMethod).toBeDefined();
    });
  });

  // Step 3-4: VC 발급 및 서명
  describe('VC Issuance and Signing', () => {
    let unsignedVC: VerifiableCredential;
    let signedVC: VerifiableCredential;

    // Issuer가 VC를 생성할 수 있어야 함
    it('should create VC by issuer', () => {
      const vcId = 'vc_kyc_test_12345';
      const credentialSubject = {
        kycLevel: 'verified',
        countryCode: 'LR',
        verificationDate: new Date().toISOString(),
        documentType: 'national_id',
      };

      unsignedVC = createVC(issuerDID, userDID, 'UndpKycCredential', credentialSubject, vcId, 730);

      expect(unsignedVC.id).toBe(vcId);
      expect(unsignedVC.issuer.id).toBe(issuerDID);
      expect(unsignedVC.credentialSubject.id).toBe(userDID);
      expect(unsignedVC.credentialSubject.kycLevel).toBe('verified');
      expect(unsignedVC.type).toContain('VerifiableCredential');
      expect(unsignedVC.type).toContain('UndpKycCredential');
    });

    // Issuer가 VC에 서명할 수 있어야 함
    it('should sign VC by issuer', async () => {
      const verificationMethod = `${issuerDID}#keys-1`;

      signedVC = await signVC(unsignedVC, issuerWallet.privateKey, verificationMethod);

      expect(signedVC.proof).toBeDefined();
      expect(signedVC.proof!.type).toBe('EcdsaSecp256k1Signature2019');
      expect(signedVC.proof!.verificationMethod).toBe(verificationMethod);
      expect(signedVC.proof!.proofPurpose).toBe('assertionMethod');
      expect(signedVC.proof!.proofValue).toBeDefined();
      expect(signedVC.proof!.proofValue).toMatch(/^0x[0-9a-fA-F]+$/);
    });

    // Issuer의 VC 서명을 검증할 수 있어야 함
    it('should verify VC signature from issuer', () => {
      const isValid = verifyVCSignature(signedVC, issuerWallet.address);
      expect(isValid).toBe(true);
    });

    // 잘못된 주소로 VC 서명 검증 시 실패해야 함
    it('should fail to verify VC signature with wrong address', () => {
      const randomWallet = new ethers.Wallet('0x' + '9'.repeat(64));
      const isValid = verifyVCSignature(signedVC, randomWallet.address);
      expect(isValid).toBe(false);
    });
  });

  // Step 5-6: VP 생성 및 서명
  describe('VP Creation and Signing', () => {
    let challenge: string;
    let unsignedVP: VerifiablePresentation;
    let signedVP: VerifiablePresentation;
    let signedVC: VerifiableCredential;

    beforeAll(async () => {
      // Prepare test VC
      const vcId = 'vc_kyc_vp_test_67890';
      const credentialSubject = {
        kycLevel: 'verified',
        countryCode: 'LR',
      };

      const unsignedVC = createVC(issuerDID, userDID, 'UndpKycCredential', credentialSubject, vcId, 730);

      signedVC = await signVC(unsignedVC, issuerWallet.privateKey, `${issuerDID}#keys-1`);
    });

    // Challenge를 생성할 수 있어야 함
    it('should generate challenge', () => {
      challenge = generateChallenge(32);

      expect(challenge).toBeDefined();
      expect(challenge).toMatch(/^0x[0-9a-fA-F]{64}$/); // 32 bytes = 64 hex chars
    });

    // User가 VP를 생성할 수 있어야 함
    it('should create VP by user', () => {
      unsignedVP = createVP(userDID, [signedVC], challenge);

      expect(unsignedVP.holder).toBe(userDID);
      expect(unsignedVP.verifiableCredential).toHaveLength(1);
      expect(unsignedVP.verifiableCredential[0]!.id).toBe(signedVC.id);
      expect(unsignedVP.proof!.challenge).toBe(challenge);
      expect(unsignedVP.proof!.domain).toBe('anam.liberia');
    });

    // User가 VP에 서명할 수 있어야 함
    it('should sign VP by user', async () => {
      signedVP = await signVP(unsignedVP, userWallet.privateKey);

      expect(signedVP.proof!.jws).toBeDefined();
      expect(signedVP.proof!.jws).toMatch(/^0x[0-9a-fA-F]+$/);
    });

    // User의 VP 서명을 검증할 수 있어야 함
    it('should verify VP signature from user', () => {
      const isValid = verifyVPSignature(signedVP, userWallet.address);
      expect(isValid).toBe(true);
    });

    // 잘못된 주소로 VP 서명 검증 시 실패해야 함
    it('should fail to verify VP signature with wrong address', () => {
      const randomWallet = new ethers.Wallet('0x' + '8'.repeat(64));
      const isValid = verifyVPSignature(signedVP, randomWallet.address);
      expect(isValid).toBe(false);
    });
  });

  // Step 7-8: 전체 검증 흐름
  describe('Complete Verification Flow', () => {
    let challenge: string;
    let signedVC: VerifiableCredential;
    let signedVP: VerifiablePresentation;

    beforeAll(async () => {
      // Prepare complete flow
      challenge = generateChallenge(32);

      // Create and sign VC
      const vcId = 'vc_kyc_full_test_99999';
      const credentialSubject = {
        kycLevel: 'verified',
        countryCode: 'LR',
        verificationDate: new Date().toISOString(),
      };

      const unsignedVC = createVC(issuerDID, userDID, 'UndpKycCredential', credentialSubject, vcId, 730);

      signedVC = await signVC(unsignedVC, issuerWallet.privateKey, `${issuerDID}#keys-1`);

      // Create and sign VP
      const unsignedVP = createVP(userDID, [signedVC], challenge);
      signedVP = await signVP(unsignedVP, userWallet.privateKey);
    });

    // Verifier가 전체 VP를 검증할 수 있어야 함
    it('should verify complete VP by verifier', () => {
      // 1. Verify VP signature (signed by User)
      const isVPValid = verifyVPSignature(signedVP, userWallet.address);
      expect(isVPValid).toBe(true);

      // 2. Verify challenge
      expect(signedVP.proof!.challenge).toBe(challenge);

      // 3. Extract VC from VP
      const vcInVP = signedVP.verifiableCredential[0]!;
      expect(vcInVP).toBeDefined();

      // 4. Verify VC signature (signed by Issuer)
      const isVCValid = verifyVCSignature(vcInVP, issuerWallet.address);
      expect(isVCValid).toBe(true);

      // 5. Verify VC expiration
      const now = new Date();
      const expirationDate = new Date(vcInVP.expirationDate!);
      expect(now.getTime()).toBeLessThan(expirationDate.getTime());

      // 6. Verify VC subject matches VP holder
      expect(vcInVP.credentialSubject.id).toBe(signedVP.holder);
    });

    // 위조된 VC가 포함된 VP는 검증 실패해야 함
    it('should fail to verify VP with forged VC', async () => {
      // Create forged VC by fake issuer
      const fakeIssuerWallet = new ethers.Wallet('0x' + '7'.repeat(64));
      const fakeIssuerDID = createDID('issuer');

      const fakeVC = createVC(fakeIssuerDID, userDID, 'FakeCredential', { fake: true }, 'vc_fake_12345', 730);

      const signedFakeVC = await signVC(fakeVC, fakeIssuerWallet.privateKey, `${fakeIssuerDID}#keys-1`);

      // Create VP with forged VC
      const fakeVP = createVP(userDID, [signedFakeVC], challenge);
      const signedFakeVP = await signVP(fakeVP, userWallet.privateKey);

      // VP signature is valid but
      expect(verifyVPSignature(signedFakeVP, userWallet.address)).toBe(true);

      // VC signature verification fails with original issuer address
      const vcInFakeVP = signedFakeVP.verifiableCredential[0]!;
      const isVCValid = verifyVCSignature(vcInFakeVP, issuerWallet.address);
      expect(isVCValid).toBe(false);
    });

    // 잘못된 challenge가 포함된 VP는 검증 실패해야 함
    it('should fail to verify VP with wrong challenge', async () => {
      const wrongChallenge = generateChallenge(32);

      const vpWithWrongChallenge = createVP(userDID, [signedVC], wrongChallenge);
      const signedVPWithWrongChallenge = await signVP(vpWithWrongChallenge, userWallet.privateKey);

      // Challenge is different
      expect(signedVPWithWrongChallenge.proof!.challenge).not.toBe(challenge);
      expect(signedVPWithWrongChallenge.proof!.challenge).toBe(wrongChallenge);
    });

    // 만료된 VC가 포함된 VP는 검증 실패해야 함
    it('should fail to verify VP with expired VC', async () => {
      // Create expired VC (-1 day)
      const expiredVC = createVC(
        issuerDID,
        userDID,
        'ExpiredCredential',
        { expired: true },
        'vc_expired_12345',
        -1, // Expired yesterday
      );

      const signedExpiredVC = await signVC(expiredVC, issuerWallet.privateKey, `${issuerDID}#keys-1`);

      // Create VP with expired VC
      const vpWithExpiredVC = createVP(userDID, [signedExpiredVC], challenge);
      const signedVPWithExpiredVC = await signVP(vpWithExpiredVC, userWallet.privateKey);

      // Verify expiration
      const vcInVP = signedVPWithExpiredVC.verifiableCredential[0]!;
      const now = new Date();
      const expirationDate = new Date(vcInVP.expirationDate!);

      expect(now.getTime()).toBeGreaterThan(expirationDate.getTime());
    });
  });

  // 보안 테스트
  describe('Security Tests', () => {
    // VC proof 없이는 검증 실패해야 함
    it('should fail to verify VC without proof', () => {
      const vcWithoutProof = createVC(issuerDID, userDID, 'TestCredential', { test: true }, 'vc_no_proof', 730);

      const isValid = verifyVCSignature(vcWithoutProof, issuerWallet.address);
      expect(isValid).toBe(false);
    });

    // VP proof 없이는 검증 실패해야 함
    it('should fail to verify VP without proof', () => {
      const challenge = generateChallenge(32);
      const vpWithoutProof = createVP(userDID, [], challenge);

      const isValid = verifyVPSignature(vpWithoutProof, userWallet.address);
      expect(isValid).toBe(false);
    });

    // 서명이 변조된 VC는 검증 실패해야 함
    it('should fail to verify VC with tampered signature', async () => {
      const vc = createVC(issuerDID, userDID, 'TestCredential', { test: true }, 'vc_tampered', 730);

      const signedVC = await signVC(vc, issuerWallet.privateKey, `${issuerDID}#keys-1`);

      // Tamper signature
      const tamperedVC = {
        ...signedVC,
        proof: {
          ...signedVC.proof!,
          proofValue: '0x' + '0'.repeat(130), // Fake signature
        },
      };

      const isValid = verifyVCSignature(tamperedVC, issuerWallet.address);
      expect(isValid).toBe(false);
    });

    // VC 내용이 변조되면 서명 검증 실패해야 함
    it('should fail to verify VC with tampered content', async () => {
      const vc = createVC(
        issuerDID,
        userDID,
        'TestCredential',
        { test: true, originalValue: 'original' },
        'vc_content_tampered',
        730,
      );

      const signedVC = await signVC(vc, issuerWallet.privateKey, `${issuerDID}#keys-1`);

      // Tamper content - change entire credentialSubject
      const tamperedVC = {
        ...signedVC,
        credentialSubject: {
          id: userDID,
          test: false, // Tampered
          originalValue: 'tampered', // Tampered
          malicious: 'data', // Added
        },
        proof: signedVC.proof, // Keep original signature
      };

      const isValid = verifyVCSignature(tamperedVC, issuerWallet.address);
      expect(isValid).toBe(false);
    });
  });

  // 엣지 케이스
  describe('Edge Cases', () => {
    // 여러 개의 VC를 포함한 VP를 생성하고 검증할 수 있어야 함
    it('should create and verify VP with multiple VCs', async () => {
      const challenge = generateChallenge(32);

      // Create multiple VCs
      const vc1 = createVC(issuerDID, userDID, 'KycCredential', { kycLevel: 'verified' }, 'vc_multi_1', 730);
      const signedVC1 = await signVC(vc1, issuerWallet.privateKey, `${issuerDID}#keys-1`);

      const vc2 = createVC(issuerDID, userDID, 'AddressCredential', { country: 'LR' }, 'vc_multi_2', 730);
      const signedVC2 = await signVC(vc2, issuerWallet.privateKey, `${issuerDID}#keys-1`);

      // Create VP with multiple VCs
      const vp = createVP(userDID, [signedVC1, signedVC2], challenge);
      const signedVP = await signVP(vp, userWallet.privateKey);

      // Verify
      expect(signedVP.verifiableCredential).toHaveLength(2);
      expect(verifyVPSignature(signedVP, userWallet.address)).toBe(true);
      expect(verifyVCSignature(signedVP.verifiableCredential[0]!, issuerWallet.address)).toBe(true);
      expect(verifyVCSignature(signedVP.verifiableCredential[1]!, issuerWallet.address)).toBe(true);
    });

    // 빈 VC 배열로 VP를 생성할 수 있어야 함
    it('should create VP with empty VC array', async () => {
      const challenge = generateChallenge(32);
      const vp = createVP(userDID, [], challenge);
      const signedVP = await signVP(vp, userWallet.privateKey);

      expect(signedVP.verifiableCredential).toHaveLength(0);
      expect(verifyVPSignature(signedVP, userWallet.address)).toBe(true);
    });
  });
});
