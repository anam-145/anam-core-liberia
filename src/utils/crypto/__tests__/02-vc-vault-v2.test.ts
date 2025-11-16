/** @jest-environment node */

import { ethers } from 'ethers';
import { encryptVault, decryptVault } from '../vault';
import { createDIDWithAddress, createVC, signVC, type VerifiableCredential, generateUndpVCId } from '../did';

/**
 * 시나리오(VC 볼트)
 * - 서명된 VC(JSON)를 AES-256-GCM으로 암호화/복호화한다
 * - 복호화 결과가 원본 VC(jws 포함)와 동일해야 한다
 */
describe('VC Vault v2 – 서명된 VC 암복호화', () => {
  const issuer = ethers.Wallet.createRandom();
  const user = ethers.Wallet.createRandom();

  it('서명된 VC JSON을 암호화/복호화하면 동일한 jws가 복원된다', async () => {
    const { did: issuerDID } = createDIDWithAddress('issuer', issuer.address);
    const { did: userDID } = createDIDWithAddress('user', user.address);

    const vc = createVC(
      issuerDID,
      userDID,
      'UndpAdminCredential',
      { username: 'john.doe', fullName: 'John Doe' },
      generateUndpVCId(),
      730,
    );
    const signedVC = await signVC(vc, issuer.privateKey, `${issuerDID}#keys-1`);

    const json = JSON.stringify(signedVC);
    const vault = encryptVault(json, 'StrongPassword!123');

    const restored = JSON.parse(decryptVault(vault, 'StrongPassword!123')) as VerifiableCredential;
    expect(restored.id).toBe(signedVC.id);
    expect(restored.proof?.jws).toBe(signedVC.proof?.jws);
  });
});
