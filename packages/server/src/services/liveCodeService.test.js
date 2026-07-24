import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initializeDataLayer } from '../data/index.js';
import { generateLiveCode, verifyLiveCode, normalizeCode } from './liveCodeService.js';
import { ForbiddenError } from '../utils/errors.js';

// Live codes are the anti-impersonation surface: single-use, short-lived,
// hash-only storage. These tests pin the full outcome vocabulary — a code
// that verifies twice, or verifies after expiry, is a security bug, not a
// UX bug.

const VERIFIED_USER = {
  email: 'ceo@example.test',
  displayName: 'Ana CEO',
  isVerified: true,
  humanId: 'hid-ceo',
  verifiedAt: '2026-07-01T00:00:00Z',
  verificationProvider: 'mock-demo',
  credentialCount: 0,
  joinedAt: '2026-06-01T00:00:00Z',
};

describe('liveCodeService', () => {
  /** @type {import('../data/memory.js').MemoryDataLayer} */
  let db;
  let user;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-24T12:00:00Z'));
    db = await initializeDataLayer({ demoMode: true });
    await db.createUser('uid-ceo', VERIFIED_USER);
    user = await db.getUser('uid-ceo');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('generates a formatted single-use code with the configured TTL', async () => {
    const { code, expiresAt, ttlSeconds } = await generateLiveCode(user);

    // XXXX-XXXX over the unambiguous alphabet (no 0/O, 1/I/L, or U).
    expect(code).toMatch(/^[A-HJ-KM-NP-TV-Z2-9]{4}-[A-HJ-KM-NP-TV-Z2-9]{4}$/);
    expect(ttlSeconds).toBe(120);
    expect(new Date(expiresAt).getTime()).toBe(Date.now() + 120 * 1000);
  });

  it('stores only the hash, never the plaintext code', async () => {
    const { code } = await generateLiveCode(user);
    const stored = JSON.stringify([...db.liveCodes.entries()]);
    expect(stored).not.toContain(normalizeCode(code));
  });

  it('round-trips: a fresh code verifies and reveals the owner', async () => {
    const { code } = await generateLiveCode(user, { note: 'call re: Q3 wire' });
    const result = await verifyLiveCode(code);

    expect(result.valid).toBe(true);
    expect(result.note).toBe('call re: Q3 wire');
    expect(result.generatedAt).toBe('2026-07-24T12:00:00.000Z');
    expect(result.person).toEqual({
      displayName: 'Ana CEO',
      humanId: 'hid-ceo',
      verifiedAt: '2026-07-01T00:00:00Z',
      verificationProvider: 'mock-demo',
    });
  });

  it('accepts sloppy input: lowercase, spaces, missing dash', async () => {
    const { code } = await generateLiveCode(user);
    const sloppy = ` ${code.toLowerCase().replace('-', ' ')} `;
    const result = await verifyLiveCode(sloppy);
    expect(result.valid).toBe(true);
  });

  it('is single-use: the second verification reports already_used, without the owner', async () => {
    const { code } = await generateLiveCode(user);
    await verifyLiveCode(code);

    const replay = await verifyLiveCode(code);
    expect(replay.valid).toBe(false);
    expect(replay.reason).toBe('already_used');
    expect(replay.usedAt).toBe('2026-07-24T12:00:00.000Z');
    expect(replay.person).toBeUndefined();
  });

  it('expires: a code past its TTL reports expired and stays unconsumed-looking', async () => {
    const { code } = await generateLiveCode(user);
    vi.advanceTimersByTime(121 * 1000);

    const result = await verifyLiveCode(code);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('expired');
    expect(result.person).toBeUndefined();
  });

  it('rejects an unknown code as invalid', async () => {
    const result = await verifyLiveCode('AAAA-2222');
    expect(result).toEqual({ valid: false, reason: 'invalid' });
  });

  it('rejects malformed input before touching the data layer', async () => {
    const spy = vi.spyOn(db, 'consumeLiveCode');
    for (const garbage of ['', 'short', 'AAAA-AAA0', "'; DROP TABLE users;--", 'A'.repeat(64)]) {
      const result = await verifyLiveCode(garbage);
      expect(result).toEqual({ valid: false, reason: 'invalid' });
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it('refuses to generate for an unverified user', async () => {
    await db.createUser('uid-unverified', {
      ...VERIFIED_USER,
      isVerified: false,
      humanId: null,
    });
    const unverified = await db.getUser('uid-unverified');
    await expect(generateLiveCode(unverified)).rejects.toThrow(ForbiddenError);
  });

  it('stops vouching if the owner loses verified status after generation', async () => {
    const { code } = await generateLiveCode(user);
    await db.updateUser('uid-ceo', { isVerified: false });

    const result = await verifyLiveCode(code);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('invalid');
  });

  it('caps the note length at 140 characters', async () => {
    const { code } = await generateLiveCode(user, { note: 'x'.repeat(500) });
    const result = await verifyLiveCode(code);
    expect(result.note).toHaveLength(140);
  });
});

describe('liveCodeService concurrency', () => {
  it('two racing verifications resolve to exactly one consumed', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-24T12:00:00Z'));
    const db = await initializeDataLayer({ demoMode: true });
    await db.createUser('uid-race', VERIFIED_USER);
    const user = await db.getUser('uid-race');

    const { code } = await generateLiveCode(user);
    const [a, b] = await Promise.all([verifyLiveCode(code), verifyLiveCode(code)]);

    const valids = [a, b].filter((r) => r.valid);
    expect(valids).toHaveLength(1);
    vi.useRealTimers();
  });
});
