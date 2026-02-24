import { createHash } from 'crypto';

export function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

export function isValidSha256(hash) {
  return /^[a-f0-9]{64}$/i.test(hash);
}
