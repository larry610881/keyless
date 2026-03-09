import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  pbkdf2Sync,
  createHash,
} from 'node:crypto';
import {
  ENCRYPTION_ALGORITHM,
  KEY_LENGTH,
  IV_LENGTH,
  SALT_LENGTH,
  PBKDF2_ITERATIONS,
  PBKDF2_DIGEST,
} from '../constants.js';
import type { EncryptedEntry } from '../types.js';

/**
 * Derive an encryption key from a password and salt using PBKDF2
 */
export function deriveKey(password: string, salt: Buffer): Buffer {
  return pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, PBKDF2_DIGEST);
}

/**
 * Generate a random salt
 */
export function generateSalt(): Buffer {
  return randomBytes(SALT_LENGTH);
}

/**
 * Encrypt plaintext with AES-256-GCM
 */
export function encrypt(plaintext: string, key: Buffer): EncryptedEntry {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');

  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    ciphertext,
    tag: tag.toString('hex'),
  };
}

/**
 * Decrypt ciphertext with AES-256-GCM
 */
export function decrypt(entry: EncryptedEntry, key: Buffer): string {
  const iv = Buffer.from(entry.iv, 'hex');
  const tag = Buffer.from(entry.tag, 'hex');

  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let plaintext = decipher.update(entry.ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8');

  return plaintext;
}

/**
 * Generate SHA-256 fingerprint of a value (for dedup without storing plaintext)
 */
export function fingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Mask a key value for safe display: show first N and last N chars
 * e.g. "sk-proj-abc123xyz789" → "sk-p...z789"
 */
export function mask(value: string, prefixLen = 4, suffixLen = 4): string {
  if (value.length <= prefixLen + suffixLen + 3) {
    // Too short to meaningfully mask — just show asterisks
    return '*'.repeat(Math.min(value.length, 8));
  }
  return `${value.slice(0, prefixLen)}...${value.slice(-suffixLen)}`;
}
