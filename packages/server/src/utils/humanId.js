import { randomUUID } from 'crypto';

export function generateHumanId() {
  return randomUUID().replace(/-/g, '').toUpperCase().substring(0, 16);
}
