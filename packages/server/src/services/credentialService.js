import { CompactSign, compactVerify, SignJWT } from 'jose';
import { randomUUID } from 'crypto';
import { getPrivateKey, getPublicKey, getKeyId } from './keyManager.js';

export function getIssuerDid(hostname) {
  return `did:web:${hostname}`;
}

export async function issueCredential({ humanId, title, contentHash, contentType, hostname }) {
  const now = new Date().toISOString();
  const credentialId = `urn:humanledger:credential:${randomUUID()}`;
  const issuerDid = getIssuerDid(hostname);

  const credential = {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://humanledger.org/ns/v1',
    ],
    id: credentialId,
    type: ['VerifiableCredential', 'HumanCreationCertificate'],
    issuer: issuerDid,
    validFrom: now,
    credentialSubject: {
      type: 'HumanCreatedWork',
      creator: {
        type: 'VerifiedHuman',
        id: `urn:humanledger:human:${humanId}`,
      },
      work: {
        title,
        contentHash: `sha256:${contentHash}`,
        contentType: contentType || 'application/octet-stream',
        registeredAt: now,
      },
    },
  };

  // Sign the credential
  const payload = new TextEncoder().encode(JSON.stringify(credential));
  const jws = await new CompactSign(payload)
    .setProtectedHeader({ alg: 'EdDSA', kid: getKeyId() })
    .sign(getPrivateKey());

  credential.proof = {
    type: 'DataIntegrityProof',
    cryptosuite: 'eddsa-jcs-2022',
    verificationMethod: `${issuerDid}#key-1`,
    created: now,
    proofPurpose: 'assertionMethod',
    jws,
  };

  return { credential, credentialId };
}

export async function verifyCredential(credential) {
  try {
    const jws = credential?.proof?.jws;
    if (!jws) {
      return { valid: false, error: 'No proof.jws found in credential' };
    }

    const { payload } = await compactVerify(jws, getPublicKey());
    const decoded = JSON.parse(new TextDecoder().decode(payload));

    // Check the signed payload matches the credential content (minus proof)
    const { proof, ...credentialWithoutProof } = credential;
    const original = JSON.stringify(decoded);
    const current = JSON.stringify(credentialWithoutProof);

    if (original !== current) {
      return { valid: false, error: 'Credential content has been tampered with' };
    }

    return {
      valid: true,
      issuer: credential.issuer,
      issuedAt: credential.validFrom,
      credentialId: credential.id,
      subject: credential.credentialSubject,
    };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

export async function issueHumanVerificationToken(humanId, hostname) {
  const issuerDid = getIssuerDid(hostname);
  const jwt = await new SignJWT({
    humanVerified: true,
  })
    .setProtectedHeader({ alg: 'EdDSA', kid: getKeyId() })
    .setSubject(`urn:humanledger:human:${humanId}`)
    .setIssuer(issuerDid)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(getPrivateKey());

  return jwt;
}
