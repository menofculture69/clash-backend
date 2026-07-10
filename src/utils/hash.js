import { createHash } from 'crypto';
export function hashToken(value) {
  return createHash('sha256').update(value).digest('hex');
}