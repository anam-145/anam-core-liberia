/** @jest-environment node */

import { POST } from '../verify/route';
import { getChallengeService, resetChallengeService } from '@/services/challenge.memory.service';
import {
  createDIDWithAddress,
  createDIDDocument,
  createVC,
  signVC,
  createVP,
  type VerifiableCredential,
} from '@/utils/crypto/did';
import { ethers } from 'ethers';
import type { NextRequest } from 'next/server';
import type { DIDDocument as DIDDocumentType } from '@/utils/crypto/did';

const __mockDocs: Record<string, DIDDocumentType> = {};

jest.mock('@/services/did.db.service', () => {
  return {
    getDIDDatabaseService: () => ({
      getDIDDocument: async (did: string) => __mockDocs[did] || null,
      __setDoc: (did: string, doc: DIDDocumentType) => (__mockDocs[did] = doc),
    }),
  };
});

jest.mock('@/services/vc.db.service', () => ({
  getVCDatabaseService: () => ({
    verifyVCOnChain: async () => true,
    getVCStatus: async () => 'ACTIVE',
  }),
}));

function setDidDoc(did: string, doc: DIDDocumentType) {
  __mockDocs[did] = doc;
}

/**
 * 시나리오(VP 검증)
 * - holder가 VP에 서명, issuer가 VC에 서명
 * - VC subject.id와 VP holder DID 일치 확인
 * - 유효기간, on-chain 상태(mock) 검증 포함
 */
describe('POST /api/vps/verify', () => {
  afterAll(() => {
    resetChallengeService();
  });

  it('holder/issuer 서명, subject-holder 매칭, 유효기간, on-chain을 모두 검증한다', async () => {
    const issuer = ethers.Wallet.createRandom();
    const holder = ethers.Wallet.createRandom();
    const { did: issuerDID } = createDIDWithAddress('issuer', issuer.address);
    const { did: holderDID } = createDIDWithAddress('user', holder.address);

    const issuerDoc = createDIDDocument(issuerDID, issuer.address, issuer.signingKey.publicKey);
    const holderDoc = createDIDDocument(holderDID, holder.address, holder.signingKey.publicKey);
    setDidDoc(issuerDID, issuerDoc);
    setDidDoc(holderDID, holderDoc);

    const { generateUndpVCId } = await import('@/utils/crypto/did');
    const vcId = generateUndpVCId();
    const vc: VerifiableCredential = createVC(issuerDID, holderDID, 'UndpKycCredential', { level: 'basic' }, vcId, 365);
    const signedVC = await signVC(vc, issuer.privateKey, `${issuerDID}#keys-1`);

    const challengeService = getChallengeService();
    const challenge = challengeService.create();

    const vp = createVP(holderDID, [signedVC], challenge);
    const { signVP } = await import('@/utils/crypto/did');
    const signedVP = await signVP(vp, holder.privateKey);

    const req = new Request('http://localhost/api/vps/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vp: signedVP, challenge }),
    });

    const res = await POST(req as unknown as NextRequest);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.checks.isSubjectMatchesHolder).toBe(true);
  });

  it('VC subject.id가 VP holder DID와 다르면 실패해야 한다', async () => {
    const issuer = ethers.Wallet.createRandom();
    const holder = ethers.Wallet.createRandom();
    const anotherUser = ethers.Wallet.createRandom();

    const { did: issuerDID } = createDIDWithAddress('issuer', issuer.address);
    const { did: holderDID } = createDIDWithAddress('user', holder.address);
    const { did: wrongSubjectDID } = createDIDWithAddress('user', anotherUser.address);

    const issuerDoc = createDIDDocument(issuerDID, issuer.address, issuer.signingKey.publicKey);
    const holderDoc = createDIDDocument(holderDID, holder.address, holder.signingKey.publicKey);
    setDidDoc(issuerDID, issuerDoc);
    setDidDoc(holderDID, holderDoc);

    const { generateUndpVCId: gen } = await import('@/utils/crypto/did');
    const vcId = gen();
    const vc = createVC(issuerDID, wrongSubjectDID, 'UndpKycCredential', { level: 'basic' }, vcId, 365);
    const signedVC = await signVC(vc, issuer.privateKey, `${issuerDID}#keys-1`);

    const challenge = getChallengeService().create();
    const vp = createVP(holderDID, [signedVC], challenge);
    const { signVP } = await import('@/utils/crypto/did');
    const signedVP = await signVP(vp, holder.privateKey);

    const req = new Request('http://localhost/api/vps/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vp: signedVP, challenge }),
    });

    const res = await POST(req as unknown as NextRequest);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(false);
    expect(body.checks.isSubjectMatchesHolder).toBe(false);
    expect(body.reason).toMatch(/does not match/i);
  });
});
