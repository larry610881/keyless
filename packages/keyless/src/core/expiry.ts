import type { KeyMeta } from '../types.js';

/**
 * Find keys that are expired or will expire within thresholdDays.
 */
export function checkExpiry(keys: KeyMeta[], thresholdDays = 30): KeyMeta[] {
  const cutoff = Date.now() + thresholdDays * 86_400_000;

  return keys.filter(k => {
    if (!k.expiresAt) return false;
    return new Date(k.expiresAt).getTime() <= cutoff;
  });
}
