import { CompactSign, compactVerify, SignJWT } from 'jose';
import { randomUUID } from 'crypto';
import { getPrivateKey, getPublicKey, getKeyId } from './keyManager.js';

export function getIssuerDid(hostname) {
  return `did:web:${hostname}`;
}

export async function issueCredential({ humanId, title, contentHash, contentType, hostname }) {
  const now = new Date().toISOString();
  const credentialId = `urn:realh:credential:${randomUUID()}`;
  const issuerDid = getIssuerDid(hostname);

  const credential = {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://realh.org/ns/v1',
    ],
    id: credentialId,
    type: ['VerifiableCredential', 'HumanCreationCertificate'],
    issuer: issuerDid,
    validFrom: now,
    credentialSubject: {
      type: 'HumanCreatedWork',
      creator: {
        type: 'VerifiedHuman',
        id: `urn:realh:human:${humanId}`,
      },
      work: {
        title,
        contentHash: `sha256:${contentHash}`,
        contentType: contentType || 'application/octet-stream',
        registeredAt: now,
      },
    },
  };

  // Sign the credential.
  //
  // We serialize with `JSON.stringify` rather than RFC 8785 JCS, which means
  // two parties re-serializing the same credential may produce different
  // bytes and fail verification (key ordering, whitespace, Unicode escapes).
  // Until JCS is wired in, the proof declares a deliberately-non-standard
  // cryptosuite name (`realh-eddsa-jws-v1`) so no W3C-conforming verifier
  // treats this as a standard `eddsa-jcs-2022` proof and silently accepts
  // interop that isn't actually there. The verifier in this repo is the
  // authoritative consumer while this label remains in use.
  const payload = new TextEncoder().encode(JSON.stringify(credential));
  const jws = await new CompactSign(payload)
    .setProtectedHeader({ alg: 'EdDSA', kid: getKeyId() })
    .sign(getPrivateKey());

  credential.proof = {
    type: 'DataIntegrityProof',
    cryptosuite: 'realh-eddsa-jws-v1',
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

    // Reject proofs that claim a cryptosuite we don't implement. Without this
    // guard, a caller could submit a credential carrying a JCS-canonicalized
    // signature and this verifier would treat it as our custom JSON.stringify
    // form (or vice-versa), silently accepting or rejecting the wrong things.
    const suite = credential?.proof?.cryptosuite;
    if (suite !== 'realh-eddsa-jws-v1') {
      return { valid: false, error: `Unsupported proof.cryptosuite: ${suite ?? '(missing)'}` };
    }

    const { payload } = await compactVerify(jws, getPublicKey());
    const decoded = JSON.parse(new TextDecoder().decode(payload));

    // Check the signed payload matches the credential content (minus proof).
    // The stringify comparison here uses the same non-canonical serialization
    // that produced the signature, which is why this check only holds
    // round-trip within this server — see the comment in issueCredential().
    const { proof: _proof, ...credentialWithoutProof } = credential;
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

/**
 * Issue a short-lived JWT attesting that `humanId` is a verified human.
 *
 * `audience` is strongly recommended in production. Without it, the token is
 * semantically "valid for any relying party", which defeats scope checks and
 * means a token obtained by one RP can be replayed against another. Callers
 * should pass the specific RP identifier (URL or opaque string) they intend
 * the token to be consumed by; relying parties MUST verify the `aud` claim
 * matches their own expected value.
 */
export async function issueHumanVerificationToken(humanId, hostname, audience) {
  const issuerDid = getIssuerDid(hostname);
  let builder = new SignJWT({ humanVerified: true })
    .setProtectedHeader({ alg: 'EdDSA', kid: getKeyId() })
    .setSubject(`urn:realh:human:${humanId}`)
    .setIssuer(issuerDid)
    .setIssuedAt()
    .setExpirationTime('1h');

  if (audience) {
    builder = builder.setAudience(audience);
  }

  return builder.sign(getPrivateKey());
}
