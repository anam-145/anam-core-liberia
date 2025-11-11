#!/usr/bin/env ts-node

/**
 * Script to test DID API endpoints
 * Run with: npx ts-node scripts/test-did-api.ts
 */

import { ethers } from 'ethers';

const API_BASE = 'http://localhost:3000/api';

async function testDIDAPI() {
  console.log('🧪 Testing DID API...\n');

  // Generate test wallet
  const testWallet = ethers.Wallet.createRandom();
  console.log('Generated test wallet:');
  console.log('  Address:', testWallet.address);
  console.log('  Public Key:', testWallet.publicKey);
  console.log();

  // Test 1: Create User DID
  console.log('1️⃣ Creating User DID...');
  try {
    const createResponse = await fetch(`${API_BASE}/did`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: testWallet.address,
        publicKeyHex: testWallet.publicKey,
        type: 'user',
      }),
    });

    const createResult = await createResponse.json();

    if (!createResponse.ok) {
      console.error('❌ Failed to create DID:', createResult.error);
      return;
    }

    console.log('✅ DID created successfully:');
    console.log('  DID:', createResult.did);
    console.log('  Document Hash:', createResult.documentHash);
    console.log('  Mock TX Hash:', createResult.txHash);
    console.log();

    const createdDID = createResult.did;

    // Test 2: Get DID by address
    console.log('2️⃣ Getting DID by wallet address...');
    const getByAddressResponse = await fetch(`${API_BASE}/did?address=${testWallet.address}`);
    const getByAddressResult = await getByAddressResponse.json();

    if (!getByAddressResponse.ok) {
      console.error('❌ Failed to get DID by address:', getByAddressResult.error);
    } else {
      console.log('✅ Found DID:', getByAddressResult.did);
    }
    console.log();

    // Test 3: Get DID Document
    console.log('3️⃣ Getting DID Document...');
    const getDocumentResponse = await fetch(`${API_BASE}/did?did=${encodeURIComponent(createdDID)}`);
    const documentResult = await getDocumentResponse.json();

    if (!getDocumentResponse.ok) {
      console.error('❌ Failed to get DID Document:', documentResult.error);
    } else {
      console.log('✅ DID Document retrieved:');
      console.log(JSON.stringify(documentResult, null, 2));
    }
    console.log();

    // Test 4: Get DID via dynamic route
    console.log('4️⃣ Getting DID via dynamic route...');
    const dynamicRouteResponse = await fetch(`${API_BASE}/did/${encodeURIComponent(createdDID)}`);
    const dynamicResult = await dynamicRouteResponse.json();

    if (!dynamicRouteResponse.ok) {
      console.error('❌ Failed to get DID via dynamic route:', dynamicResult.error);
    } else {
      console.log('✅ DID retrieved via dynamic route:');
      console.log('  Verified:', dynamicResult.verified);
      console.log('  Retrieved At:', dynamicResult.metadata.retrievedAt);
    }
    console.log();

    // Test 5: List all DIDs
    console.log('5️⃣ Listing all DIDs...');
    const listResponse = await fetch(`${API_BASE}/did`);
    const listResult = await listResponse.json();

    if (!listResponse.ok) {
      console.error('❌ Failed to list DIDs:', listResult.error);
    } else {
      console.log('✅ Total DIDs:', listResult.dids.length);
      listResult.dids.forEach((did: { did: string; type: string }, index: number) => {
        console.log(`  ${index + 1}. ${did.did} (${did.type})`);
      });
    }
    console.log();

    // Test 6: Duplicate DID creation (should fail)
    console.log('6️⃣ Testing duplicate DID prevention...');
    const duplicateResponse = await fetch(`${API_BASE}/did`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: testWallet.address,
        publicKeyHex: testWallet.publicKey,
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

    // Test 7: Create Issuer DID
    console.log('7️⃣ Creating Issuer DID...');
    const issuerWallet = ethers.Wallet.createRandom();
    const issuerResponse = await fetch(`${API_BASE}/did`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: issuerWallet.address,
        publicKeyHex: issuerWallet.publicKey,
        type: 'issuer',
      }),
    });

    const issuerResult = await issuerResponse.json();

    if (!issuerResponse.ok) {
      console.error('❌ Failed to create Issuer DID:', issuerResult.error);
    } else {
      console.log('✅ Issuer DID created:');
      console.log('  DID:', issuerResult.did);
    }
    console.log();

    console.log('✨ All tests completed!');
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test
testDIDAPI().catch(console.error);
