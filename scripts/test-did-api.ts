#!/usr/bin/env ts-node

/**
 * Script to test DID Service API endpoints
 * Run with: npx ts-node scripts/test-did-api.ts
 */

import { ethers } from 'ethers';
import { createVP, signVP, type VerifiableCredential } from '../src/utils/crypto/did';

const API_BASE = 'http://localhost:3000/api';

async function testDIDAPI() {
  console.log('🧪 Testing DID Service API...\n');

  // Generate test wallets
  const userWallet = ethers.Wallet.createRandom();
  const issuerWallet = ethers.Wallet.createRandom();

  console.log('Generated test wallets:');
  console.log('  User Address:', userWallet.address);
  console.log('  User Public Key:', userWallet.publicKey);
  console.log('  Issuer Address:', issuerWallet.address);
  console.log('  Issuer Public Key:', issuerWallet.publicKey);
  console.log();

  let userDid = '';
  let userVc: VerifiableCredential | null = null;

  // Test 1: Register User DID
  console.log('1️⃣  Registering User DID...');
  try {
    const registerResponse = await fetch(`${API_BASE}/dids/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: userWallet.address,
        publicKeyHex: userWallet.publicKey,
        type: 'user',
      }),
    });

    const registerResult = await registerResponse.json();

    if (!registerResponse.ok) {
      console.error('❌ Failed to register DID:', registerResult.error);
      return;
    }

    userDid = registerResult.did;
    console.log('✅ User DID registered:');
    console.log('  DID:', registerResult.did);
    console.log('  Document Hash:', registerResult.documentHash);
    console.log('  TX Hash:', registerResult.txHash);
    console.log();
  } catch (error) {
    console.error('❌ Test failed:', error);
    return;
  }

  // Test 2: Get DID Document
  console.log('2️⃣  Getting DID Document...');
  try {
    const getDocResponse = await fetch(`${API_BASE}/dids/${encodeURIComponent(userDid)}`);
    const docResult = await getDocResponse.json();

    if (!getDocResponse.ok) {
      console.error('❌ Failed to get DID Document:', docResult.error);
    } else {
      console.log('✅ DID Document retrieved:');
      console.log('  DID:', docResult.id);
      console.log('  Type:', docResult.type);
      console.log('  Verified:', docResult.verified);
    }
    console.log();
  } catch (error) {
    console.error('❌ Test failed:', error);
  }

  // Test 3: Issue VC (KYC)
  console.log('3️⃣  Issuing KYC VC...');
  try {
    const issueResponse = await fetch(`${API_BASE}/vcs/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: userWallet.address,
        publicKeyHex: userWallet.publicKey,
        vcType: 'KYC',
        data: {
          name: 'John Doe',
          role: 'participant',
          kycLevel: 'basic',
        },
      }),
    });

    const issueResult = await issueResponse.json();

    if (!issueResponse.ok) {
      console.error('❌ Failed to issue VC:', issueResult.error);
    } else {
      userVc = issueResult.vc; // VC 저장
      console.log('✅ VC issued successfully:');
      console.log('  DID:', issueResult.did);
      console.log('  VC ID:', issueResult.vc.id);
      console.log('  VC Hash:', issueResult.vcHash);
      console.log('  TX Hashes:');
      console.log('    DID Registry:', issueResult.txHashes.didRegistry);
      console.log('    VC Registry:', issueResult.txHashes.vcRegistry);
    }
    console.log();
  } catch (error) {
    console.error('❌ Test failed:', error);
  }

  // Test 4: Get VP Challenge
  console.log('4️⃣  Getting VP Challenge...');
  let challenge = '';
  try {
    const challengeResponse = await fetch(`${API_BASE}/vps/challenge`);
    const challengeResult = await challengeResponse.json();

    if (!challengeResponse.ok) {
      console.error('❌ Failed to get challenge:', challengeResult.error);
    } else {
      challenge = challengeResult.challenge;
      console.log('✅ Challenge generated:');
      console.log('  Challenge:', challengeResult.challenge);
      console.log('  Expires At:', challengeResult.expiresAt);
    }
    console.log();
  } catch (error) {
    console.error('❌ Test failed:', error);
  }

  // Test 5: Create and Verify VP
  console.log('5️⃣  Creating and Verifying VP...');
  if (!userVc || !challenge) {
    console.log('⚠️  Skipped: VC or challenge not available');
    console.log();
  } else {
    try {
      // Create VP (user wallet signs with their private key)
      const unsignedVP = createVP(userDid, [userVc], challenge);
      const signedVP = await signVP(unsignedVP, userWallet.privateKey);

      console.log('✅ VP created and signed');
      console.log('  Holder:', signedVP.holder);
      console.log('  Challenge:', signedVP.proof?.challenge);

      // Verify VP
      const verifyResponse = await fetch(`${API_BASE}/vps/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vp: signedVP,
          challenge: challenge,
        }),
      });

      const verifyResult = await verifyResponse.json();

      if (!verifyResponse.ok) {
        console.error('❌ VP verification failed:', verifyResult.error || verifyResult.reason);
        if (verifyResult.checks) {
          console.log('  Checks:', JSON.stringify(verifyResult.checks, null, 2));
        }
      } else {
        console.log('✅ VP verified successfully:');
        console.log('  Valid:', verifyResult.valid);
        console.log('  Checks:', JSON.stringify(verifyResult.checks, null, 2));
      }
      console.log();
    } catch (error) {
      console.error('❌ Test failed:', error);
    }
  }

  // Test 6: Revoke VC
  console.log('6️⃣  Revoking VC...');
  if (!userVc) {
    console.log('⚠️  Skipped: VC not available');
    console.log();
  } else {
    try {
      const revokeResponse = await fetch(`${API_BASE}/vcs/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vcId: userVc.id,
          reason: 'Testing revocation',
        }),
      });

      const revokeResult = await revokeResponse.json();

      if (!revokeResponse.ok) {
        console.error('❌ Failed to revoke VC:', revokeResult.error);
      } else {
        console.log('✅ VC revoked successfully:');
        console.log('  VC ID:', revokeResult.vcId);
        console.log('  Status:', revokeResult.status);
        console.log('  TX Hash:', revokeResult.txHash);
        console.log('  Revoked At:', revokeResult.revokedAt);
      }
      console.log();
    } catch (error) {
      console.error('❌ Test failed:', error);
    }
  }

  // Test 7: Register Issuer DID
  console.log('7️⃣  Registering Issuer DID...');
  try {
    const issuerRegisterResponse = await fetch(`${API_BASE}/dids/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: issuerWallet.address,
        publicKeyHex: issuerWallet.publicKey,
        type: 'issuer',
      }),
    });

    const issuerRegisterResult = await issuerRegisterResponse.json();

    if (!issuerRegisterResponse.ok) {
      console.error('❌ Failed to register Issuer DID:', issuerRegisterResult.error);
    } else {
      console.log('✅ Issuer DID registered:');
      console.log('  DID:', issuerRegisterResult.did);
    }
    console.log();
  } catch (error) {
    console.error('❌ Test failed:', error);
  }

  // Test 8: Duplicate DID prevention
  console.log('8️⃣  Testing duplicate DID prevention...');
  try {
    const duplicateResponse = await fetch(`${API_BASE}/dids/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: userWallet.address,
        publicKeyHex: userWallet.publicKey,
        type: 'user',
      }),
    });

    const duplicateResult = await duplicateResponse.json();

    if (duplicateResponse.ok) {
      console.error('❌ Duplicate DID was created (should have failed)');
    } else {
      console.log('✅ Duplicate prevention working:', duplicateResult.error);
    }
    console.log();
  } catch (error) {
    console.error('❌ Test failed:', error);
  }

  console.log('✨ All tests completed!');
  console.log('\n📝 Note: Full VP verification requires Wallet Service integration');
}

// Run the test
testDIDAPI().catch(console.error);
