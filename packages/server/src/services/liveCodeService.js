import { createHash, randomBytes } from 'crypto';
import { getDataLayer } from '../data/index.js';
import { config } from '../config.js';
import { ForbiddenError } from '../utils/errors.js';

// Live codes are the anti-impersonation primitive: a verified user generates a
// short-lived, single-use code and says it over whatever channel they're being
// challenged on (call, WhatsApp, email). The challenger checks it on the public
// /verify page. Design constraints, in order:
//
//   - Single-use + short TTL is the security model. A code that has been
//     spoken aloud is burned; replaying it must fail loudly (reason
//     'already_used'), because a replay is exactly what an impersonator
//     relaying a stolen code would produce.
//   - Only the SHA-256 of the normalized code is stored. A data-layer dump
//     must not yield redeemable codes.
//   - The alphabet excludes 0/O, 1/I/L, and U (Crockford's reasoning): codes
//     get read out loud over bad phone lines. normalizeCode() is the single
//     place input is canonicalized so "k7m2-p4qr" and "K7M2 P4QR" both verify.
//   - 8 chars over a 30-symbol alphabet ≈ 39 bits. Brute force is not the
//     threat model for a single-use secret that lives ~2 minutes behind a
//     per-IP rate limiter; keeping the code speakable is worth more than the
//     extra bits.

const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
const CODE_LENGTH = 8;
const CODE_RE = new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`);
const NOTE_MAX_LENGTH = 140;

function randomCode() {
  // Rejection sampling: 256 % 30 != 0, so a plain modulo would skew toward the
  // low end of the alphabet. Accept only bytes below the largest multiple of
  // the alphabet size.
  const limit = 256 - (256 % ALPHABET.length);
  let code = '';
  while (code.length < CODE_LENGTH) {
    for (const byte of randomBytes(CODE_LENGTH * 2)) {
      if (byte < limit) {
        code += ALPHABET[byte % ALPHABET.length];
        if (code.length === CODE_LENGTH) break;
      }
    }
  }
  return code;
}

export function normalizeCode(raw) {
  return String(raw).toUpperCase().replace(/[\s-]/g, '');
}

export function formatCode(code) {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

function hashCode(normalized) {
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Generate a live code for a verified user.
 *
 * @param {import('../data/interface.js').UserRecord} user
 * @param {{ note?: string }} [options] Optional context note ("call with Ana
 *   re: Q3 wire"), shown to whoever verifies the code. Binding the code to a
 *   stated purpose raises the cost of the relay attack where a scammer
 *   convinces the real owner to generate a code for them mid-call.
 */
export async function generateLiveCode(user, { note } = {}) {
  if (!user.isVerified || !user.humanId) {
    throw new ForbiddenError();
  }

  const code = randomCode();
  const now = new Date();
  const ttlSeconds = config.liveCode.ttlSeconds;
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

  const db = getDataLayer();
  await db.createLiveCode(hashCode(code), {
    userId: user.id,
    humanId: user.humanId,
    note: note?.trim().slice(0, NOTE_MAX_LENGTH) || null,
    status: 'active',
    createdAt: now.toISOString(),
    expiresAt,
  });

  return { code: formatCode(code), expiresAt, ttlSeconds };
}

/**
 * Verify (and consume) a live code. Public — no auth.
 *
 * Outcome vocabulary is deliberate:
 *   - 'invalid'       unknown or malformed. No detail beyond that.
 *   - 'expired'       existed but its window passed. Ask for a fresh one.
 *   - 'already_used'  consumed before this call — the replay red flag. Only
 *                     usedAt is disclosed, never who owned the code; the
 *                     legitimate first verifier already saw the owner, and a
 *                     second caller has no business learning it.
 *
 * The consume is atomic in the data layer: two concurrent verifications of
 * the same code must resolve to exactly one 'consumed'.
 */
export async function verifyLiveCode(rawCode) {
  const normalized = normalizeCode(rawCode);
  if (!CODE_RE.test(normalized)) {
    return { valid: false, reason: 'invalid' };
  }

  const db = getDataLayer();
  const { outcome, record } = await db.consumeLiveCode(hashCode(normalized), new Date());

  if (outcome === 'expired') return { valid: false, reason: 'expired' };
  if (outcome === 'used') return { valid: false, reason: 'already_used', usedAt: record.usedAt };
  if (outcome !== 'consumed') return { valid: false, reason: 'invalid' };

  // Re-check the owner at verification time: if the account was unverified or
  // deleted between generation and verification, the code must not vouch.
  const owner = await db.getUser(record.userId);
  if (!owner || !owner.isVerified) {
    return { valid: false, reason: 'invalid' };
  }

  return {
    valid: true,
    generatedAt: record.createdAt,
    note: record.note,
    person: {
      displayName: owner.displayName || null,
      humanId: owner.humanId,
      verifiedAt: owner.verifiedAt,
      verificationProvider: owner.verificationProvider,
    },
  };
}
