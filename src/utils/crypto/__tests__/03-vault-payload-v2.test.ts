/** @jest-environment node */

import { generateWallet } from '../wallet';
import { encryptVault, decryptVault } from '../vault';
import { createDIDWithAddress, createVC, signVC, generateUndpVCId, type VerifiableCredential } from '../did';
import { ethers } from 'ethers';

/**
 * 시나리오(통합 Vault 페이로드)
 * - 월렛 볼트 + VC 볼트를 하나의 페이로드(JSON)로 구성한다
 * - 월렛 볼트는 니모닉을 암호화, VC 볼트는 서명된 VC JSON을 암호화
 * - 두 볼트의 iv/salt는 서로 달라야 하며, 복호화 시 원문이 정확히 복원되어야 한다
 * - 페이로드 구조는 VC-GOVERNANCE의 Paper Voucher 예시와 동일한 형태를 따른다
 */
describe('Vault Payload v2 – 월렛 볼트 + VC 볼트 구성', () => {
  it('지갑 니모닉과 서명된 VC를 각각 Vault로 암호화하여 단일 페이로드로 묶는다', async () => {
    // 1) User wallet (mnemonic)
    const userWallet = generateWallet();
    const userAddress = userWallet.address;
    const password = 'VoucherPassw0rd!';

    // 2) Issuer + subject DID
    const issuer = ethers.Wallet.createRandom();
    const { did: issuerDID } = createDIDWithAddress('issuer', issuer.address);
    const { did: userDID } = createDIDWithAddress('user', userAddress);

    // 3) VC (서명)
    const vcId = generateUndpVCId();
    const unsigned: VerifiableCredential = createVC(
      issuerDID,
      userDID,
      'UndpAdminCredential',
      { username: 'john.doe', fullName: 'John Doe' },
      vcId,
      730,
    );
    const signedVC = await signVC(unsigned, issuer.privateKey, `${issuerDID}#keys-1`);

    // 4) Encrypt to vaults
    const walletVault = encryptVault(userWallet.mnemonic, password);
    const vcVault = encryptVault(JSON.stringify(signedVC), password);

    // 5) Build payload (Paper Voucher 스타일)
    const payload = {
      address: userAddress,
      vault: walletVault,
      vc: {
        id: signedVC.id,
        ...vcVault,
      },
    };

    // 6) 형식 검사
    const b64 = /^[A-Za-z0-9+/=]+$/;
    expect(payload.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(payload.vault.ciphertext).toMatch(b64);
    expect(payload.vault.iv).toMatch(b64);
    expect(payload.vault.salt).toMatch(b64);
    expect(payload.vault.authTag).toMatch(b64);
    expect(payload.vc.id).toBe(vcId);
    expect(payload.vc.ciphertext).toMatch(b64);
    expect(payload.vc.iv).toMatch(b64);
    expect(payload.vc.salt).toMatch(b64);
    expect(payload.vc.authTag).toMatch(b64);

    // 7) 보안: 서로 다른 데이터는 서로 다른 iv/salt를 가져야 한다
    expect(payload.vault.iv).not.toBe(payload.vc.iv);
    expect(payload.vault.salt).not.toBe(payload.vc.salt);

    // 8) 복호화 → 원문 복원
    const restoredMnemonic = decryptVault(payload.vault, password);
    expect(restoredMnemonic).toBe(userWallet.mnemonic);

    const restoredVCJson = decryptVault(payload.vc, password);
    const restoredVC = JSON.parse(restoredVCJson) as VerifiableCredential;
    expect(restoredVC.id).toBe(signedVC.id);
    expect(restoredVC.proof?.jws).toBe(signedVC.proof?.jws);
  });
});
