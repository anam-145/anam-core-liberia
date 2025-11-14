/**
 * @jest-environment node
 */

import { ethers } from 'ethers';
import {
  createDID,
  createDIDWithAddress,
  parseDID,
  createDIDDocument,
  hashDIDDocument,
  createVC,
  signVC,
  verifyVCSignature,
  createVP,
  signVP,
  verifyVPSignature,
  generateChallenge,
} from '../did';

// DID 생성·파생·서명 흐름 전체 검증
describe('DID Utilities', () => {
  // Test wallet for signing operations
  const testWallet = ethers.Wallet.createRandom();
  const testAddress = testWallet.address;
  const testPublicKey = testWallet.signingKey.publicKey;

  // DID 문자열 생성 규칙 검증 (ethr-did style)
  describe('createDID', () => {
    // Ethereum 주소로 user DID 생성 확인
    it('should create a user DID with Ethereum address', () => {
      const did = createDID('user', testAddress);
      expect(did).toBe(`did:anam:user:${ethers.getAddress(testAddress)}`);
      expect(did).toMatch(/^did:anam:user:0x[a-fA-F0-9]{40}$/);
    });

    // Ethereum 주소로 issuer DID 생성 확인
    it('should create an issuer DID with Ethereum address', () => {
      const did = createDID('issuer', testAddress);
      expect(did).toBe(`did:anam:issuer:${ethers.getAddress(testAddress)}`);
      expect(did).toMatch(/^did:anam:issuer:0x[a-fA-F0-9]{40}$/);
    });

    // 같은 주소에서 같은 DID 생성 확인 (결정론적)
    it('should generate same DID for same address (deterministic)', () => {
      const did1 = createDID('user', testAddress);
      const did2 = createDID('user', testAddress);
      expect(did1).toBe(did2);
    });

    // 다른 주소에서 다른 DID 생성 확인
    it('should generate different DIDs for different addresses', () => {
      const wallet2 = ethers.Wallet.createRandom();
      const did1 = createDID('user', testAddress);
      const did2 = createDID('user', wallet2.address);
      expect(did1).not.toBe(did2);
    });

    // 체크섬 주소 자동 변환 확인
    it('should checksum lowercase addresses', () => {
      const lowercaseAddress = testAddress.toLowerCase();
      const did = createDID('user', lowercaseAddress);
      expect(did).toBe(`did:anam:user:${ethers.getAddress(testAddress)}`);
    });
  });

  // DID-주소 매핑 생성 검증
  describe('createDIDWithAddress', () => {
    // 체크섬 주소가 유지되는지 확인
    it('should create DID with checksummed address', () => {
      const result = createDIDWithAddress('user', testAddress);
      expect(result.did).toBe(`did:anam:user:${ethers.getAddress(testAddress)}`);
      expect(result.address).toBe(ethers.getAddress(testAddress));
    });

    // 소문자 주소를 체크섬으로 변환하는지 확인
    it('should checksum a lowercase address', () => {
      const lowercaseAddress = testAddress.toLowerCase();
      const result = createDIDWithAddress('user', lowercaseAddress);
      expect(result.address).toBe(ethers.getAddress(testAddress));
      expect(result.did).toBe(`did:anam:user:${ethers.getAddress(testAddress)}`);
    });
  });

  // DID 문자열 파싱 유효성 검증
  describe('parseDID', () => {
    // 사용자 DID 파싱 결과 확인
    it('should parse a valid user DID', () => {
      const did = `did:anam:user:${testAddress}`;
      const parsed = parseDID(did);

      expect(parsed.method).toBe('anam');
      expect(parsed.type).toBe('user');
      expect(parsed.address).toBe(ethers.getAddress(testAddress));
    });

    // 발행자 DID 파싱 결과 확인
    it('should parse a valid issuer DID', () => {
      const did = `did:anam:issuer:${testAddress}`;
      const parsed = parseDID(did);

      expect(parsed.method).toBe('anam');
      expect(parsed.type).toBe('issuer');
      expect(parsed.address).toBe(ethers.getAddress(testAddress));
    });

    // 잘못된 DID 형식 처리 확인
    it('should throw error for invalid DID format', () => {
      expect(() => parseDID('did:ethr:0x123')).toThrow('Invalid DID format');
      expect(() => parseDID('did:anam:invalid:0x123')).toThrow('Invalid DID type');
      expect(() => parseDID('did:anam:user:invalid')).toThrow('Invalid DID address');
      expect(() => parseDID('did:anam:user:0xZZZ')).toThrow('Invalid Ethereum address');
    });
  });

  // DID Document 구성과 컨트롤러 설정 검증
  describe('createDIDDocument', () => {
    const testDID = `did:anam:user:${testAddress}`;

    // 사용자 DID 문서에 authentication 포함 여부 확인
    it('should create a user DID Document with authentication', () => {
      const doc = createDIDDocument(testDID, testAddress, testPublicKey);

      expect(doc['@context']).toBe('https://www.w3.org/ns/did/v1');
      expect(doc.id).toBe(testDID);
      expect(doc.type).toBe('USER');
      expect(doc.controller).toBe(testDID);
      expect(doc.verificationMethod).toHaveLength(1);
      expect(doc.verificationMethod[0]!.type).toBe('EcdsaSecp256k1VerificationKey2019');
      expect(doc.verificationMethod[0]!.publicKeyHex).toBe(testPublicKey);
      expect(doc.verificationMethod[0]!.blockchainAccountId).toBe(`eip155:84532:${ethers.getAddress(testAddress)}`);
      expect(doc.authentication).toContain(`${testDID}#keys-1`);
      expect(doc.assertionMethod).toBeUndefined();
    });

    // 발행자 DID 문서에 assertionMethod 포함 여부 확인
    it('should create an issuer DID Document with assertionMethod', () => {
      const wallet2 = ethers.Wallet.createRandom();
      const issuerDID = `did:anam:issuer:${wallet2.address}`;
      const doc = createDIDDocument(issuerDID, wallet2.address, wallet2.signingKey.publicKey);

      expect(doc.id).toBe(issuerDID);
      expect(doc.type).toBe('ISSUER');
      expect(doc.assertionMethod).toContain(`${issuerDID}#keys-1`);
      expect(doc.authentication).toBeUndefined();
    });

    // 커스텀 컨트롤러 지정 동작 확인
    it('should allow custom controller', () => {
      const wallet2 = ethers.Wallet.createRandom();
      const controllerDID = `did:anam:issuer:${wallet2.address}`;
      const doc = createDIDDocument(testDID, testAddress, testPublicKey, controllerDID);

      expect(doc.controller).toBe(controllerDID);
      expect(doc.verificationMethod[0]!.controller).toBe(controllerDID);
    });
  });

  // DID Document 해시 계산 검증
  describe('hashDIDDocument', () => {
    // 동일 문서 해시 일관성 확인
    it('should generate consistent hash for same document', () => {
      const doc = createDIDDocument(`did:anam:user:${testAddress}`, testAddress, testPublicKey);
      const hash1 = hashDIDDocument(doc);
      const hash2 = hashDIDDocument(doc);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^0x[a-f0-9]{64}$/);
    });

    // 다른 문서 해시 분리 여부 확인
    it('should generate different hashes for different documents', () => {
      const wallet2 = ethers.Wallet.createRandom();
      const doc1 = createDIDDocument(`did:anam:user:${testAddress}`, testAddress, testPublicKey);
      const doc2 = createDIDDocument(`did:anam:user:${wallet2.address}`, wallet2.address, wallet2.signingKey.publicKey);

      const hash1 = hashDIDDocument(doc1);
      const hash2 = hashDIDDocument(doc2);

      expect(hash1).not.toBe(hash2);
    });
  });

  // Verifiable Credential 생성·서명 흐름 검증
  describe('VC Operations', () => {
    const issuerWallet = ethers.Wallet.createRandom();
    const subjectWallet = ethers.Wallet.createRandom();
    const issuerDID = `did:anam:issuer:${issuerWallet.address}`;
    const subjectDID = `did:anam:user:${subjectWallet.address}`;
    const vcId = 'vc_kyc_12345';

    // VC 생성 시 필드 구성 검증
    describe('createVC', () => {
      // VC 구조 필수 필드 확인
      it('should create a valid VC structure', () => {
        const credentialSubject = {
          name: 'John Doe',
          kycMethod: 'NIR_OR_VOUCHING',
          verifiedAt: new Date().toISOString(),
        };

        const vc = createVC(issuerDID, subjectDID, 'UndpKycCredential', credentialSubject, vcId);

        expect(vc['@context']).toContain('https://www.w3.org/ns/credentials/v2');
        expect(vc.id).toBe(vcId);
        expect(vc.type).toContain('VerifiableCredential');
        expect(vc.type).toContain('UndpKycCredential');
        expect(vc.issuer.id).toBe(issuerDID);
        expect(vc.issuer.name).toBe('UNDP Liberia');
        expect(vc.credentialSubject.id).toBe(subjectDID);
        expect(vc.credentialSubject.name).toBe('John Doe');
        expect(vc.credentialStatus).toBeDefined();
        expect(vc.proof).toBeUndefined(); // Unsigned VC
      });

      // 유효 기간 계산 확인
      it('should set correct validity period', () => {
        const vc = createVC(issuerDID, subjectDID, 'UndpKycCredential', {}, vcId, 365);

        const issuanceDate = new Date(vc.issuanceDate);
        const expiryDate = new Date(vc.expirationDate!);
        const diffDays = Math.round((expiryDate.getTime() - issuanceDate.getTime()) / (1000 * 60 * 60 * 24));

        expect(diffDays).toBe(365);
      });
    });

    // VC 서명과 검증 절차 검증
    describe('signVC and verifyVCSignature', () => {
      // VC 서명 후 정상 검증 확인
      it('should sign VC and verify signature', async () => {
        const vc = createVC(issuerDID, subjectDID, 'UndpKycCredential', { name: 'Test' }, vcId);
        const verificationMethod = `${issuerDID}#keys-1`;

        const signedVC = await signVC(vc, issuerWallet.privateKey, verificationMethod);

        expect(signedVC.proof).toBeDefined();
        expect(signedVC.proof!.type).toBe('EcdsaSecp256k1Signature2019');
        expect(signedVC.proof!.verificationMethod).toBe(verificationMethod);
        expect(signedVC.proof!.proofPurpose).toBe('assertionMethod');
        expect(signedVC.proof!.proofValue).toBeDefined();

        // Verify signature with correct address
        const isValid = verifyVCSignature(signedVC, issuerWallet.address);
        expect(isValid).toBe(true);

        // Verify signature with wrong address should fail
        const wrongAddress = ethers.Wallet.createRandom().address;
        const isInvalid = verifyVCSignature(signedVC, wrongAddress);
        expect(isInvalid).toBe(false);
      });

      // 서명 없는 VC 검증 실패 확인
      it('should return false for unsigned VC', () => {
        const vc = createVC(issuerDID, subjectDID, 'UndpKycCredential', {}, vcId);
        const isValid = verifyVCSignature(vc, issuerWallet.address);
        expect(isValid).toBe(false);
      });
    });
  });

  // Verifiable Presentation 생성·서명 흐름 검증
  describe('VP Operations', () => {
    const holderWallet = ethers.Wallet.createRandom();
    const issuerWallet = ethers.Wallet.createRandom();
    const holderDID = `did:anam:user:${holderWallet.address}`;
    const issuerDID = `did:anam:issuer:${issuerWallet.address}`;
    const challenge = generateChallenge();

    // VP 생성 구조 검증
    describe('createVP', () => {
      // VP 구조 필수 필드 확인
      it('should create a valid VP structure', () => {
        const vc = createVC(issuerDID, holderDID, 'UndpKycCredential', { name: 'Test' }, 'vc_123');

        const vp = createVP(holderDID, [vc], challenge);

        expect(vp['@context']).toContain('https://www.w3.org/2018/credentials/v1');
        expect(vp.type).toContain('VerifiablePresentation');
        expect(vp.holder).toBe(holderDID);
        expect(vp.verifiableCredential).toHaveLength(1);
        expect(vp.proof!.challenge).toBe(challenge);
        expect(vp.proof!.proofPurpose).toBe('authentication');
        expect(vp.proof!.verificationMethod).toBe(`${holderDID}#keys-1`);
      });
    });

    // VP 서명 및 검증 로직 검증
    describe('signVP and verifyVPSignature', () => {
      // VP 서명 후 검증 성공 확인
      it('should sign VP and verify signature', async () => {
        const vc = createVC(issuerDID, holderDID, 'UndpKycCredential', { name: 'Test' }, 'vc_123');
        const vp = createVP(holderDID, [vc], challenge);

        const signedVP = await signVP(vp, holderWallet.privateKey);

        expect(signedVP.proof!.jws).toBeDefined();

        // Verify signature with correct address
        const isValid = verifyVPSignature(signedVP, holderWallet.address);
        expect(isValid).toBe(true);

        // Verify signature with wrong address should fail
        const wrongAddress = ethers.Wallet.createRandom().address;
        const isInvalid = verifyVPSignature(signedVP, wrongAddress);
        expect(isInvalid).toBe(false);
      });

      // 서명 없는 VP 검증 실패 확인
      it('should return false for unsigned VP', () => {
        const vc = createVC(issuerDID, holderDID, 'UndpKycCredential', { name: 'Test' }, 'vc_123');
        const vp = createVP(holderDID, [vc], challenge);

        const isValid = verifyVPSignature(vp, holderWallet.address);
        expect(isValid).toBe(false);
      });
    });
  });

  // 프레젠테이션 챌린지 생성 규칙 검증
  describe('generateChallenge', () => {
    // 기본 32바이트 챌린지 생성 확인
    it('should generate 32-byte hex challenge by default', () => {
      const challenge = generateChallenge();
      expect(challenge).toMatch(/^0x[a-f0-9]{64}$/); // 32 bytes = 64 hex chars
    });

    // 사용자 정의 길이 챌린지 생성 확인
    it('should generate challenge with custom length', () => {
      const challenge = generateChallenge(16);
      expect(challenge).toMatch(/^0x[a-f0-9]{32}$/); // 16 bytes = 32 hex chars
    });

    it('should generate unique challenges', () => {
      const c1 = generateChallenge();
      const c2 = generateChallenge();
      expect(c1).not.toBe(c2);
    });
  });
});
