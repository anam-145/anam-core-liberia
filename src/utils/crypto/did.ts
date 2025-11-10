/**
 * DID (Decentralized Identifier) Utilities
 *
 * Implements did:ethr DID creation and management
 * as specified in section 5.4.2 of the system design document
 */

import { ethers } from 'ethers';
import { getAddressFromPrivateKey } from './wallet';

export interface DIDDocument {
  '@context': string[];
  id: string;
  controller: string;
  verificationMethod: VerificationMethod[];
  authentication: string[];
  assertionMethod?: string[];
}

export interface VerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyHex?: string;
  blockchainAccountId?: string;
}

export type DIDRole = 'user' | 'admin' | 'approver' | 'issuer';

/**
 * Creates a DID from an Ethereum address
 * @param address - Ethereum address
 * @param network - Network identifier (default: 'base' for Base network)
 * @returns DID string in did:ethr format
 */
export function createDID(address: string, network: string = 'base'): string {
  // Ensure address is checksummed
  const checksumAddress = ethers.getAddress(address);
  return `did:ethr:${network}:${checksumAddress}`;
}

/**
 * Creates a DID from a private key
 * @param privateKey - Private key
 * @param network - Network identifier
 * @returns DID string
 */
export function createDIDFromPrivateKey(privateKey: string, network: string = 'base'): string {
  const address = getAddressFromPrivateKey(privateKey);
  return createDID(address, network);
}

/**
 * Parses a DID string into components
 * @param did - DID string
 * @returns Parsed components
 */
export function parseDID(did: string): {
  method: string;
  network: string;
  address: string;
} {
  const parts = did.split(':');
  if (parts.length !== 4 || parts[0] !== 'did' || parts[1] !== 'ethr') {
    throw new Error('Invalid DID format. Expected did:ethr:network:address');
  }

  return {
    method: parts[1],
    network: parts[2],
    address: parts[3],
  };
}

/**
 * Creates a DID Document
 * @param did - The DID
 * @param publicKey - Public key hex string
 * @param controller - Controller DID (defaults to self)
 * @returns DID Document
 */
export function createDIDDocument(did: string, publicKey: string, controller?: string): DIDDocument {
  const parsedDID = parseDID(did);
  const controllerDID = controller || did;

  const verificationMethodId = `${did}#controller`;

  return {
    '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/suites/secp256k1-2019/v1'],
    id: did,
    controller: controllerDID,
    verificationMethod: [
      {
        id: verificationMethodId,
        type: 'EcdsaSecp256k1VerificationKey2019',
        controller: controllerDID,
        publicKeyHex: publicKey,
      },
      {
        id: `${did}#controllerAccount`,
        type: 'EcdsaSecp256k1RecoveryMethod2020',
        controller: controllerDID,
        blockchainAccountId: `eip155:${parsedDID.network}:${parsedDID.address}`,
      },
    ],
    authentication: [verificationMethodId],
    assertionMethod: [verificationMethodId],
  };
}

/**
 * Creates a DID Document from a private key
 * @param privateKey - Private key
 * @param network - Network identifier
 * @param controller - Optional controller DID
 * @returns DID Document
 */
export function createDIDDocumentFromPrivateKey(
  privateKey: string,
  network: string = 'base',
  controller?: string,
): DIDDocument {
  const wallet = new ethers.Wallet(privateKey);
  const did = createDID(wallet.address, network);
  return createDIDDocument(did, wallet.publicKey, controller);
}

/**
 * Creates a role-based DID
 * @param address - Ethereum address
 * @param role - Role identifier
 * @param network - Network identifier
 * @returns Role-based DID string
 */
export function createRoleDID(address: string, role: DIDRole, _network: string = 'base'): string {
  // Format: did:anam:role:name
  // This is for internal use, actual DID is still did:ethr
  const checksumAddress = ethers.getAddress(address);
  return `did:anam:${role}:${checksumAddress}`;
}

/**
 * Verifies if a DID matches an address
 * @param did - DID string
 * @param address - Ethereum address to verify
 * @returns true if DID corresponds to the address
 */
export function verifyDIDAddress(did: string, address: string): boolean {
  try {
    const parsed = parseDID(did);
    const checksumDIDAddress = ethers.getAddress(parsed.address);
    const checksumAddress = ethers.getAddress(address);
    return checksumDIDAddress === checksumAddress;
  } catch {
    return false;
  }
}

/**
 * Signs a DID authentication challenge
 * @param did - The DID
 * @param challenge - Challenge string
 * @param privateKey - Private key for signing
 * @returns Signature
 */
export async function signDIDChallenge(did: string, challenge: string, privateKey: string): Promise<string> {
  const wallet = new ethers.Wallet(privateKey);

  // Verify the DID matches the private key
  if (!verifyDIDAddress(did, wallet.address)) {
    throw new Error('DID does not match the private key');
  }

  const message = `DID Authentication\nDID: ${did}\nChallenge: ${challenge}\nTimestamp: ${Date.now()}`;
  return await wallet.signMessage(message);
}

/**
 * Verifies a DID authentication signature
 * @param did - The DID
 * @param challenge - Challenge string
 * @param signature - Signature to verify
 * @returns true if signature is valid
 */
export function verifyDIDSignature(did: string, challenge: string, signature: string, timestamp: number): boolean {
  try {
    const parsed = parseDID(did);
    const message = `DID Authentication\nDID: ${did}\nChallenge: ${challenge}\nTimestamp: ${timestamp}`;
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === parsed.address.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Creates a Verifiable Presentation (VP)
 * @param holderDID - Holder's DID
 * @param verifiableCredentials - VCs to include
 * @param challenge - Challenge/nonce
 * @param privateKey - Private key for signing
 * @returns Signed VP
 */
export async function createVP(
  holderDID: string,
  verifiableCredentials: any[],
  challenge: string,
  privateKey: string,
): Promise<any> {
  const wallet = new ethers.Wallet(privateKey);

  const vp = {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiablePresentation'],
    holder: holderDID,
    verifiableCredential: verifiableCredentials,
    proof: {
      type: 'EcdsaSecp256k1Signature2019',
      created: new Date().toISOString(),
      challenge,
      domain: 'anam.liberia',
      proofPurpose: 'authentication',
      verificationMethod: `${holderDID}#controller`,
    },
  };

  // Sign the VP
  const signature = await wallet.signMessage(JSON.stringify(vp));
  vp.proof['jws'] = signature;

  return vp;
}
