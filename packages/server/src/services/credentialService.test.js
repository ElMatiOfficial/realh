import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { initializeKeys } from './keyManager.js';
import {
  issueCredential,
  verifyCredential,
  issueHumanVerificationToken,
} from './credentialService.js';

// Round-trip test per CONTRIBUTING.md: every credential-related change must
// cover issue → serialize → verify → detect tampering. The real jose crypto
// path is exercised; no mocks — the project explicitly forbids mocking the
// signing layer because past bugs have lived inside signature verification.

describe('credentialService round-trip', () => {
  let keysDir;

  beforeAll(async () => {
    keysDir = mkdtempSync(join(tmpdir(), 'realh-cred-test-'));
    await initializeKeys(keysDir);
  });

  afterAll(() => {
    if (keysDir) rmSync(keysDir, { recursive: true, force: true });
  });

  const validHash = 'a'.repeat(64);
  const host = 'test.example';

  it('issues a VC with the expected shape', async () => {
    const { credential, credentialId } = await issueCredential({
      humanId: 'human-abc',
      title: 'My work',
      contentHash: validHash,
      contentType: 'text/plain',
      hostname: host,
    });

    expect(credentialId).toMatch(/^urn:realh:credential:[0-9a-f-]{36}$/);
    expect(credential.issuer).toBe(`did:web:${host}`);
    expect(credential.type).toEqual(['VerifiableCredential', 'HumanCreationCertificate']);
    expect(credential.credentialSubject.creator.id).toBe('urn:realh:human:human-abc');
    expect(credential.credentialSubject.work.contentHash).toBe(`sha256:${validHash}`);
    expect(credential.proof.type).toBe('DataIntegrityProof');
    // The cryptosuite label is intentionally non-standard while we serialize
    // with JSON.stringify instead of RFC 8785 JCS. If this ever gets changed
    // back to 'eddsa-jcs-2022' without actually wiring JCS, the proof is
    // lying about the canonicalization — this test exists to catch that.
    expect(credential.proof.cryptosuite).toBe('realh-eddsa-jws-v1');
    expect(credential.proof.jws).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+$/);
  });

  it('rejects a credential that claims a cryptosuite we do not implement', async () => {
    const { credential } = await issueCredential({
      humanId: 'human-suite',
      title: 'Mislabeled',
      contentHash: 'e'.repeat(64),
      contentType: 'text/plain',
      hostname: host,
    });

    // Same payload + signature, but the proof claims a different suite.
    const relabeled = JSON.parse(JSON.stringify(credential));
    relabeled.proof.cryptosuite = 'eddsa-jcs-2022';

    const result = await verifyCredential(relabeled);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/cryptosuite/i);
  });

  it('verifies an untouched credential', async () => {
    const { credential } = await issueCredential({
      humanId: 'human-xyz',
      title: 'Essay',
      contentHash: 'b'.repeat(64),
      contentType: 'text/markdown',
      hostname: host,
    });

    const result = await verifyCredential(credential);

    expect(result.valid).toBe(true);
    expect(result.issuer).toBe(`did:web:${host}`);
    expect(result.subject.creator.id).toBe('urn:realh:human:human-xyz');
  });

  it('detects tampering of the credential subject', async () => {
    const { credential } = await issueCredential({
      humanId: 'human-tamper',
      title: 'Original',
      contentHash: 'c'.repeat(64),
      contentType: 'text/plain',
      hostname: host,
    });

    // Mutate a field the signature covers — the JWS payload won't match the
    // re-serialized credential anymore.
    const tampered = JSON.parse(JSON.stringify(credential));
    tampered.credentialSubject.work.title = 'Replaced';

    const result = await verifyCredential(tampered);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/tampered/i);
  });

  it('detects a forged signature', async () => {
    const { credential } = await issueCredential({
      humanId: 'human-forge',
      title: 'Original',
      contentHash: 'd'.repeat(64),
      contentType: 'text/plain',
      hostname: host,
    });

    const forged = JSON.parse(JSON.stringify(credential));
    // Swap in a syntactically-valid but cryptographically-invalid JWS.
    forged.proof.jws =
      'eyJhbGciOiJFZERTQSIsImtpZCI6InJlYWxoLWtleS0xIn0.YmFk.' +
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

    const result = await verifyCredential(forged);
    expect(result.valid).toBe(false);
  });

  it('rejects input without a proof', async () => {
    const result = await verifyCredential({ id: 'urn:realh:credential:none' });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/proof\.jws/i);
  });

  it('issues a human-verification JWT with a 1-hour expiry (no audience by default)', async () => {
    const token = await issueHumanVerificationToken('human-abc', host);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

    // JWT header should declare EdDSA + our kid.
    const [headerB64] = token.split('.');
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());
    expect(header.alg).toBe('EdDSA');
    expect(header.kid).toBe('realh-key-1');

    // Payload: sub / iss / iat / exp with exp == iat + 3600s. No aud claim
    // when the caller didn't specify one.
    const [, payloadB64] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    expect(payload.sub).toBe('urn:realh:human:human-abc');
    expect(payload.iss).toBe(`did:web:${host}`);
    expect(payload.exp - payload.iat).toBe(3600);
    expect(payload.humanVerified).toBe(true);
    expect(payload.aud).toBeUndefined();
  });

  it('scopes the JWT to an audience when one is supplied', async () => {
    const token = await issueHumanVerificationToken(
      'human-abc',
      host,
      'https://rp.example'
    );
    const [, payloadB64] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    expect(payload.aud).toBe('https://rp.example');
  });
});
