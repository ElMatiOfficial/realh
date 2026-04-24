import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateKeyPair, exportSPKI, compactVerify, importJWK } from 'jose';
import { KmsGcpSigner } from './kms-gcp.js';

// Unit tests for the KMS-backed signer. We mock the @google-cloud/kms client
// so the test suite stays offline — real smoke tests against a live KMS key
// are an operator responsibility before production use.
//
// The trick: we generate a real Ed25519 keypair in-process, seed the mock
// client to return the PEM form as its public key, and implement
// asymmetricSign by delegating to jose.SignJWT against the in-process
// private key. That way the round-trip (signCompact → compactVerify with the
// cached public JWK) exercises the REAL crypto, not a no-op stub.

async function makeMockClient() {
  const pair = await generateKeyPair('EdDSA', { crv: 'Ed25519', extractable: true });
  const pem = await exportSPKI(pair.publicKey);

  return {
    _pair: pair, // exposed for assertions
    getPublicKey: vi.fn(async () => [{ pem }]),
    asymmetricSign: vi.fn(async ({ data }) => {
      // Produce a raw Ed25519 signature over `data`. Node's crypto.sign
      // returns the 64-byte raw signature for Ed25519 — no DER wrapper —
      // which matches what GCP KMS returns for EC_SIGN_ED25519.
      const { sign } = await import('node:crypto');
      const sig = sign(null, data, pair.privateKey);
      return [{ signature: sig }];
    }),
  };
}

describe('KmsGcpSigner', () => {
  const keyName =
    'projects/test-project/locations/us/keyRings/test-ring/cryptoKeys/test-key/cryptoKeyVersions/1';
  const kid = 'test-kms-key-1';

  let client;
  let signer;

  beforeEach(async () => {
    client = await makeMockClient();
    signer = new KmsGcpSigner({ keyName, kid, client });
    await signer.initialize();
  });

  it('constructs with required fields; throws when missing', () => {
    expect(() => new KmsGcpSigner({ kid })).toThrow(/keyName/);
    expect(() => new KmsGcpSigner({ keyName })).toThrow(/kid/);
  });

  it('exposes the public key as JWK with alg+use+kid set', () => {
    const jwk = signer.getPublicJwk();
    expect(jwk.kty).toBe('OKP');
    expect(jwk.crv).toBe('Ed25519');
    expect(jwk.alg).toBe('EdDSA');
    expect(jwk.use).toBe('sig');
    expect(jwk.kid).toBe(kid);
    expect(jwk.x).toBeDefined();
    // Must NOT include the private component `d`.
    expect(jwk.d).toBeUndefined();
  });

  it('produces a compact JWS that verifies against the published public key', async () => {
    const payload = new TextEncoder().encode(JSON.stringify({ hello: 'world' }));
    const jws = await signer.signCompact(payload);

    // Shape check: three base64url segments.
    expect(jws).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

    // Verify with the public JWK — the consumer path in credentialService.
    const publicKey = await importJWK(signer.getPublicJwk(), 'EdDSA');
    const { payload: verifiedPayload, protectedHeader } = await compactVerify(jws, publicKey);
    expect(JSON.parse(new TextDecoder().decode(verifiedPayload))).toEqual({ hello: 'world' });
    expect(protectedHeader.alg).toBe('EdDSA');
    expect(protectedHeader.kid).toBe(kid);
  });

  it('produces a JWT (typ=JWT) that decodes to the original claims', async () => {
    const claims = {
      sub: 'urn:realh:human:x',
      iss: 'did:web:example',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      humanVerified: true,
    };
    const jwt = await signer.signJwt(claims);

    const publicKey = await importJWK(signer.getPublicJwk(), 'EdDSA');
    const { payload, protectedHeader } = await compactVerify(jwt, publicKey);
    const decoded = JSON.parse(new TextDecoder().decode(payload));
    expect(decoded).toEqual(claims);
    expect(protectedHeader.typ).toBe('JWT');
    expect(protectedHeader.kid).toBe(kid);
  });

  it('forbids header overrides of alg/kid', async () => {
    const payload = new TextEncoder().encode('x');
    const jws = await signer.signCompact(payload, { alg: 'RS256', kid: 'attacker-kid' });
    const publicKey = await importJWK(signer.getPublicJwk(), 'EdDSA');
    const { protectedHeader } = await compactVerify(jws, publicKey);
    expect(protectedHeader.alg).toBe('EdDSA');
    expect(protectedHeader.kid).toBe(kid);
  });

  it('throws when used before initialize()', () => {
    const fresh = new KmsGcpSigner({ keyName, kid, client });
    expect(() => fresh.getPublicJwk()).toThrow(/initialize/);
  });

  it('passes the self-test using the real crypto round-trip', async () => {
    await expect(signer.selfTest()).resolves.toBeUndefined();
  });

  it('throws when KMS returns no signature', async () => {
    client.asymmetricSign.mockResolvedValueOnce([{ signature: null }]);
    await expect(signer.signCompact(new TextEncoder().encode('x'))).rejects.toThrow(/no signature/i);
  });
});
