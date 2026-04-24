import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryDataLayer } from './memory.js';

// MemoryDataLayer is the reference implementation the other backends are
// compared against. Covering it here also anchors the DataLayer contract —
// any regression in the shape gets caught here first.

describe('MemoryDataLayer.findVerifiedUserByHumanId', () => {
  /** @type {MemoryDataLayer} */
  let db;

  beforeEach(() => {
    db = new MemoryDataLayer();
  });

  it('returns the user when humanId matches and isVerified is true', async () => {
    await db.createUser('uid-1', {
      email: 'a@example.test',
      isVerified: true,
      humanId: 'hid-abc',
      verifiedAt: '2026-04-24T00:00:00Z',
      verificationProvider: 'mock-demo',
      credentialCount: 0,
      joinedAt: '2026-04-20T00:00:00Z',
    });

    const found = await db.findVerifiedUserByHumanId('hid-abc');
    expect(found).not.toBeNull();
    expect(found.id).toBe('uid-1');
    expect(found.humanId).toBe('hid-abc');
  });

  it('returns null when the humanId matches but the user is NOT verified', async () => {
    await db.createUser('uid-2', {
      email: 'b@example.test',
      isVerified: false,
      humanId: 'hid-xyz',
      verifiedAt: null,
      verificationProvider: null,
      credentialCount: 0,
      joinedAt: '2026-04-20T00:00:00Z',
    });

    const found = await db.findVerifiedUserByHumanId('hid-xyz');
    expect(found).toBeNull();
  });

  it('returns null when no user has that humanId', async () => {
    await db.createUser('uid-3', {
      email: 'c@example.test',
      isVerified: true,
      humanId: 'hid-other',
      verifiedAt: '2026-04-24T00:00:00Z',
      verificationProvider: 'mock-demo',
      credentialCount: 0,
      joinedAt: '2026-04-20T00:00:00Z',
    });

    const found = await db.findVerifiedUserByHumanId('hid-missing');
    expect(found).toBeNull();
  });
});
