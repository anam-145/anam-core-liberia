/**
 * DID (Decentralized Identifier) Utilities
 *
 * Implements did:anam:undp-lr DID creation and management
 * as specified in section 5.4.2 of the system design document
 *
 * DID Format: did:anam:undp-lr:<type>:<identifier>
 * - type: 'user' or 'issuer'
 * - identifier: Base58 encoded 20-byte random value
 */

import { ethers } from 'ethers';
import bs58 from 'bs58';
import { randomBytes } from 'crypto';
import { getAddressFromPrivateKey } from './wallet';

// DID Types as defined in system design
export type DIDType = 'user' | 'issuer';

// DID Method and Namespace constants
const DID_METHOD = 'anam';
const DID_NAMESPACE = 'undp-lr';

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
  credentialSubject: any;
  credentialStatus?: {
    id: string;
    type: string;
  };
  proof?: any;
}

export interface VerifiablePresentation {
  '@context': string[];
  type: string[];
  holder: string;
  verifiableCredential: VerifiableCredential[];
  proof?: any;
}

/**
 * Canonical JSON stringify with recursive key sorting
 * Ensures deterministic serialization for signing/verification
 * @param obj - Object to stringify
 * @returns Canonicalized JSON string
 */
function canonicalStringify(obj: any): string {
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
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map((key) => {
    const value = obj[key];
    const stringifiedValue = canonicalStringify(value);
    return JSON.stringify(key) + ':' + stringifiedValue;
  });

  return '{' + pairs.join(',') + '}';
}

/**
 * Generates a random DID identifier
 * @returns Base58 encoded 20-byte identifier
 */
export function generateDIDIdentifier(): string {
  // Generate 20 bytes of random data (160 bits)
  const randomData = randomBytes(20);
  // Encode to Base58 for human-readable format
  return bs58.encode(randomData);
}

/**
 * Creates a DID using the anam method
 * @param type - Type of DID (user or issuer)
 * @param identifier - Optional identifier, generates random if not provided
 * @returns DID string in did:anam:undp-lr format
 */
export function createDID(type: DIDType, identifier?: string): string {
  const didIdentifier = identifier || generateDIDIdentifier();
  return `did:${DID_METHOD}:${DID_NAMESPACE}:${type}:${didIdentifier}`;
}

/**
 * Creates a DID with associated wallet address
 * @param type - Type of DID
 * @param walletAddress - Ethereum wallet address
 * @param identifier - Optional identifier
 * @returns Object with DID and wallet address
 */
export function createDIDWithAddress(
  type: DIDType,
  walletAddress: string,
  identifier?: string,
): { did: string; address: string } {
  const checksumAddress = ethers.getAddress(walletAddress);
  const did = createDID(type, identifier);
  return { did, address: checksumAddress };
}

/**
 * Parses a DID string into components
 * @param did - DID string
 * @returns Parsed components
 */
export function parseDID(did: string): {
  method: string;
  namespace: string;
  type: DIDType;
  identifier: string;
} {
  const parts = did.split(':');
  if (parts.length !== 5 || parts[0] !== 'did' || parts[1] !== DID_METHOD || parts[2] !== DID_NAMESPACE) {
    throw new Error(`Invalid DID format. Expected did:${DID_METHOD}:${DID_NAMESPACE}:<type>:<identifier>`);
  }

  const type = parts[3];
  if (type !== 'user' && type !== 'issuer') {
    throw new Error('Invalid DID type. Must be "user" or "issuer"');
  }

  const identifier = parts[4];
  if (!identifier) {
    throw new Error('Missing DID identifier');
  }

  return {
    method: parts[1],
    namespace: parts[2],
    type: type as DIDType,
    identifier,
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
        blockchainAccountId: `eip155:8453:${checksumAddress}`,
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
  credentialSubject: any,
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
    validFrom: now.toISOString(),
    validUntil: expiryDate.toISOString(),
    credentialSubject: {
      id: subjectDID,
      ...credentialSubject,
    },
    credentialStatus: {
      id: `eip155:8453:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb/${vcId}`,
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
