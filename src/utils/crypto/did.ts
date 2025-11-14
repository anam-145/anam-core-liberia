/**
 * DID (Decentralized Identifier) Utilities
 *
 * Implements did:anam DID creation and management (ethr-did style)
 * as specified in section 5.4.2 of the system design document
 *
 * DID Format: did:anam:<type>:<address>
 * - type: 'user' or 'issuer'
 * - address: Ethereum address (0x...)
 */

import { ethers } from 'ethers';
import { randomBytes } from 'crypto';
import { getAddressFromPrivateKey } from './wallet';

// DID Types as defined in system design
export type DIDType = 'user' | 'issuer';

// DID Method constant
const DID_METHOD = 'anam';

export interface DIDDocument {
  '@context': string | string[];
  id: string;
  type: DIDType;
  created: string;
  updated: string;
  controller: string;
  verificationMethod: VerificationMethod[];
  authentication?: string[];
  assertionMethod?: string[];
}

export interface VerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyHex?: string;
  blockchainAccountId?: string;
}

// VC/VP related interfaces
export interface VCProof {
  type: string;
  verificationMethod: string;
  proofPurpose: string;
  created: string;
  proofValue: string;
}

export interface VPProof {
  type: string;
  verificationMethod: string;
  proofPurpose: string;
  created: string;
  challenge: string;
  domain?: string;
  jws?: string;
}

export interface VerifiableCredential {
  '@context': string[];
  id: string;
  type: string[];
  issuer: {
    id: string;
    name?: string;
  };
  issuanceDate: string;
  validFrom?: string;
  validUntil?: string;
  credentialSubject: Record<string, unknown>;
  credentialStatus?: {
    id: string;
    type: string;
  };
  proof?: VCProof;
  expirationDate?: string;
}

export interface VerifiablePresentation {
  '@context': string[];
  type: string[];
  holder: string;
  verifiableCredential: VerifiableCredential[];
  proof?: VPProof;
}

/**
 * Canonical JSON stringify with recursive key sorting
 * Ensures deterministic serialization for signing/verification
 * @param obj - Object to stringify
 * @returns Canonicalized JSON string
 */
export function canonicalStringify(obj: unknown): string {
  // Handle primitives and null
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    const items = obj.map((item) => canonicalStringify(item));
    return '[' + items.join(',') + ']';
  }

  // Handle objects - sort keys and recursively stringify values
  const record = obj as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const pairs = sortedKeys.map((key) => {
    const value = record[key];
    const stringifiedValue = canonicalStringify(value);
    return JSON.stringify(key) + ':' + stringifiedValue;
  });

  return '{' + pairs.join(',') + '}';
}

/**
 * Creates a DID using the anam method
 * @param type - Type of DID (user or issuer)
 * @param address - Ethereum wallet address
 * @returns DID string in did:anam:<type>:<address> format
 */
export function createDID(type: DIDType, address: string): string {
  const checksumAddress = ethers.getAddress(address);
  return `did:${DID_METHOD}:${type}:${checksumAddress}`;
}

/**
 * Creates a deterministic DID with associated wallet address
 * Same wallet address always produces the same DID (deterministic)
 * @param type - Type of DID
 * @param walletAddress - Ethereum wallet address
 * @returns Object with DID and wallet address
 */
export function createDIDWithAddress(type: DIDType, walletAddress: string): { did: string; address: string } {
  const checksumAddress = ethers.getAddress(walletAddress);
  const did = createDID(type, checksumAddress);
  return { did, address: checksumAddress };
}

/**
 * Parses a DID string into components
 * @param did - DID string
 * @returns Parsed components
 */
export function parseDID(did: string): {
  method: string;
  type: DIDType;
  address: string;
} {
  const parts = did.split(':');
  if (parts.length !== 4 || parts[0] !== 'did' || parts[1] !== DID_METHOD) {
    throw new Error(`Invalid DID format. Expected did:${DID_METHOD}:<type>:<address>`);
  }

  const type = parts[2];
  if (type !== 'user' && type !== 'issuer') {
    throw new Error('Invalid DID type. Must be "user" or "issuer"');
  }

  const address = parts[3];
  if (!address || !address.startsWith('0x')) {
    throw new Error('Invalid DID address format');
  }

  // Validate address format
  try {
    ethers.getAddress(address);
  } catch {
    throw new Error('Invalid Ethereum address in DID');
  }

  return {
    method: parts[1],
    type: type as DIDType,
    address,
  };
}

/**
 * Creates a DID Document according to system design spec
 * @param did - The DID
 * @param walletAddress - Associated wallet address
 * @param publicKeyHex - Public key hex string (65 bytes uncompressed)
 * @param controller - Optional controller DID (defaults to self)
 * @returns DID Document
 */
export function createDIDDocument(
  did: string,
  walletAddress: string,
  publicKeyHex: string,
  controller?: string,
): DIDDocument {
  const parsedDID = parseDID(did);
  const controllerDID = controller || did;
  const checksumAddress = ethers.getAddress(walletAddress);

  const now = new Date().toISOString();
  const verificationMethodId = `${did}#keys-1`;

  const document: DIDDocument = {
    '@context': 'https://www.w3.org/ns/did/v1',
    id: did,
    type: parsedDID.type.toUpperCase() as DIDType,
    created: now,
    updated: now,
    controller: controllerDID,
    verificationMethod: [
      {
        id: verificationMethodId,
        type: 'EcdsaSecp256k1VerificationKey2019',
        controller: controllerDID,
        blockchainAccountId: `eip155:${process.env.BASE_CHAIN_ID || '84532'}:${checksumAddress}`,
        publicKeyHex: publicKeyHex,
      },
    ],
  };

  // Add authentication/assertionMethod based on type
  if (parsedDID.type === 'user') {
    document.authentication = [verificationMethodId];
  } else if (parsedDID.type === 'issuer') {
    document.assertionMethod = [verificationMethodId];
  }

  return document;
}

/**
 * Calculates the hash of a DID Document for on-chain storage
 * @param document - DID Document
 * @returns Keccak256 hash as hex string
 */
export function hashDIDDocument(document: DIDDocument): string {
  // Serialize document deterministically
  const serialized = JSON.stringify(document, Object.keys(document).sort());
  // Calculate Keccak256 hash
  return ethers.keccak256(ethers.toUtf8Bytes(serialized));
}

/**
 * Creates a Verifiable Credential (VC) structure
 * @param issuerDID - Issuer's DID
 * @param subjectDID - Subject's DID
 * @param credentialType - Type of credential (e.g., 'UndpKycCredential')
 * @param credentialSubject - Subject data
 * @param vcId - Unique VC identifier
 * @param validityPeriodDays - Validity period in days (default: 730 = 2 years)
 * @returns Unsigned VC structure (proof to be added by signing)
 */
export function createVC(
  issuerDID: string,
  subjectDID: string,
  credentialType: string,
  credentialSubject: Record<string, unknown>,
  vcId: string,
  validityPeriodDays: number = 730,
): VerifiableCredential {
  const now = new Date();
  const expiryDate = new Date(now);
  expiryDate.setDate(expiryDate.getDate() + validityPeriodDays);

  return {
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    id: vcId,
    type: ['VerifiableCredential', credentialType],
    issuer: {
      id: issuerDID,
      name: 'UNDP Liberia',
    },
    issuanceDate: now.toISOString(),
    expirationDate: expiryDate.toISOString(), // W3C 표준 필드
    credentialSubject: {
      id: subjectDID,
      ...credentialSubject,
    },
    credentialStatus: {
      id: `eip155:${process.env.BASE_CHAIN_ID || '84532'}:${process.env.VC_STATUS_REGISTRY_ADDRESS}/${vcId}`,
      type: 'EthereumRevocationRegistry2023',
    },
  };
}

/**
 * Signs a Verifiable Credential with the issuer's private key
 * @param vc - The VC to sign
 * @param issuerPrivateKey - Issuer's private key
 * @param verificationMethod - Verification method ID
 * @returns Signed VC with proof
 */
export async function signVC(
  vc: VerifiableCredential,
  issuerPrivateKey: string,
  verificationMethod: string,
): Promise<VerifiableCredential> {
  const wallet = new ethers.Wallet(issuerPrivateKey);

  // Create a copy of VC without proof
  const vcCopy = { ...vc };
  delete vcCopy.proof;

  // Serialize VC for signing using canonical JSON
  const message = canonicalStringify(vcCopy);

  // Sign the message
  const signature = await wallet.signMessage(message);

  // Add proof to VC
  return {
    ...vc,
    proof: {
      type: 'EcdsaSecp256k1Signature2019',
      created: new Date().toISOString(),
      verificationMethod,
      proofPurpose: 'assertionMethod',
      proofValue: signature,
    },
  };
}

/**
 * Creates a Verifiable Presentation (VP) structure
 * @param holderDID - Holder's DID
 * @param verifiableCredentials - VCs to include
 * @param challenge - Challenge/nonce for anti-replay
 * @returns Unsigned VP structure (proof to be added by signing)
 */
export function createVP(
  holderDID: string,
  verifiableCredentials: VerifiableCredential[],
  challenge: string,
): VerifiablePresentation {
  return {
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
      verificationMethod: `${holderDID}#keys-1`,
    },
  };
}

/**
 * Signs a Verifiable Presentation with the holder's private key
 * @param vp - The VP to sign
 * @param holderPrivateKey - Holder's private key
 * @returns Signed VP with proof
 */
export async function signVP(vp: VerifiablePresentation, holderPrivateKey: string): Promise<VerifiablePresentation> {
  const wallet = new ethers.Wallet(holderPrivateKey);

  // Create a copy for signing (proof without signature)
  const vpForSigning = {
    ...vp,
    proof: {
      ...vp.proof,
      jws: undefined,
    },
  };

  // Serialize VP for signing using canonical JSON
  const message = canonicalStringify(vpForSigning);

  // Sign the message
  const signature = await wallet.signMessage(message);

  // Add signature to proof
  return {
    ...vp,
    proof: {
      ...vp.proof!,
      jws: signature,
    },
  };
}

/**
 * Verifies a VC signature
 * @param vc - The signed VC
 * @param issuerAddress - Expected issuer address
 * @returns true if signature is valid
 */
export function verifyVCSignature(vc: VerifiableCredential, issuerAddress: string): boolean {
  try {
    if (!vc.proof || !vc.proof.proofValue) {
      return false;
    }

    // Create VC copy without proof for verification
    const vcCopy = { ...vc };
    delete vcCopy.proof;

    // Recreate the signed message using canonical JSON
    const message = canonicalStringify(vcCopy);

    // Recover signer address
    const recoveredAddress = ethers.verifyMessage(message, vc.proof.proofValue);

    // Compare addresses
    return recoveredAddress.toLowerCase() === issuerAddress.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Verifies a VP signature
 * @param vp - The signed VP
 * @param holderAddress - Expected holder address
 * @returns true if signature is valid
 */
export function verifyVPSignature(vp: VerifiablePresentation, holderAddress: string): boolean {
  try {
    if (!vp.proof || !vp.proof.jws) {
      return false;
    }

    // Create VP copy for verification
    const vpForVerification = {
      ...vp,
      proof: {
        ...vp.proof,
        jws: undefined,
      },
    };

    // Recreate the signed message using canonical JSON
    const message = canonicalStringify(vpForVerification);

    // Recover signer address
    const recoveredAddress = ethers.verifyMessage(message, vp.proof.jws);

    // Compare addresses
    return recoveredAddress.toLowerCase() === holderAddress.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Generates a cryptographically secure challenge for VP
 * @param length - Number of random bytes (default: 32)
 * @returns Hex-encoded challenge string
 */
export function generateChallenge(length: number = 32): string {
  return '0x' + randomBytes(length).toString('hex');
}

/**
 * Extract Ethereum address from DID Document's blockchainAccountId
 * @param didDocument - DID Document
 * @returns Ethereum address (0x...) or null if not found
 */
export function extractAddressFromDIDDocument(didDocument: DIDDocument): string | null {
  const blockchainAccountId = didDocument.verificationMethod?.[0]?.blockchainAccountId;
  if (!blockchainAccountId) {
    return null;
  }

  // blockchainAccountId format: "eip155:{chainId}:0x1234..."
  // Extract address after second colon
  const parts = blockchainAccountId.split(':');
  if (parts.length !== 3 || !parts[2] || !parts[2].startsWith('0x')) {
    return null;
  }

  return parts[2];
}

// Legacy support for migration (maps to new format)
export function createDIDFromPrivateKey(privateKey: string, type: DIDType = 'user'): string {
  const address = getAddressFromPrivateKey(privateKey);
  return createDIDWithAddress(type, address).did;
}

export function createDIDDocumentFromPrivateKey(
  privateKey: string,
  type: DIDType = 'user',
  controller?: string,
): DIDDocument {
  const wallet = new ethers.Wallet(privateKey);
  const signingKey = wallet.signingKey;
  const publicKey = signingKey.publicKey;
  const did = createDIDWithAddress(type, wallet.address).did;
  return createDIDDocument(did, wallet.address, publicKey, controller);
}
