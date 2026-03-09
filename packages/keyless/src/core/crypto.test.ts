import { describe, it, expect } from 'vitest';
import { deriveKey, generateSalt, encrypt, decrypt, fingerprint, mask } from './crypto.js';

describe('crypto', () => {
  describe('deriveKey', () => {
    it('should derive a 32-byte key from password and salt', () => {
      const salt = generateSalt();
      const key = deriveKey('test-password', salt);
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    it('should produce same key for same password and salt', () => {
      const salt = generateSalt();
      const key1 = deriveKey('test-password', salt);
      const key2 = deriveKey('test-password', salt);
      expect(key1.equals(key2)).toBe(true);
    });

    it('should produce different keys for different passwords', () => {
      const salt = generateSalt();
      const key1 = deriveKey('password-1', salt);
      const key2 = deriveKey('password-2', salt);
      expect(key1.equals(key2)).toBe(false);
    });

    it('should produce different keys for different salts', () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      const key1 = deriveKey('same-password', salt1);
      const key2 = deriveKey('same-password', salt2);
      expect(key1.equals(key2)).toBe(false);
    });
  });

  describe('encrypt / decrypt', () => {
    it('should round-trip encrypt and decrypt', () => {
      const salt = generateSalt();
      const key = deriveKey('test-password', salt);
      const plaintext = 'sk-proj-abc123xyz789secretkey';

      const encrypted = encrypt(plaintext, key);
      const decrypted = decrypt(encrypted, key);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext each time (random IV)', () => {
      const salt = generateSalt();
      const key = deriveKey('test-password', salt);
      const plaintext = 'same-value';

      const e1 = encrypt(plaintext, key);
      const e2 = encrypt(plaintext, key);

      expect(e1.ciphertext).not.toBe(e2.ciphertext);
      expect(e1.iv).not.toBe(e2.iv);
    });

    it('should fail to decrypt with wrong key', () => {
      const salt = generateSalt();
      const key1 = deriveKey('correct-password', salt);
      const key2 = deriveKey('wrong-password', salt);

      const encrypted = encrypt('secret', key1);

      expect(() => decrypt(encrypted, key2)).toThrow();
    });

    it('should fail to decrypt with tampered ciphertext', () => {
      const salt = generateSalt();
      const key = deriveKey('password', salt);

      const encrypted = encrypt('secret', key);
      // Tamper with ciphertext
      const tampered = { ...encrypted, ciphertext: encrypted.ciphertext.replace(/[0-9a-f]/, 'x') };

      expect(() => decrypt(tampered, key)).toThrow();
    });

    it('should handle empty string', () => {
      const salt = generateSalt();
      const key = deriveKey('password', salt);

      const encrypted = encrypt('', key);
      const decrypted = decrypt(encrypted, key);

      expect(decrypted).toBe('');
    });

    it('should handle unicode content', () => {
      const salt = generateSalt();
      const key = deriveKey('password', salt);
      const plaintext = '密鑰值 🔐 キー';

      const encrypted = encrypt(plaintext, key);
      const decrypted = decrypt(encrypted, key);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('fingerprint', () => {
    it('should return a hex SHA-256 hash', () => {
      const fp = fingerprint('test-value');
      expect(fp).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should be deterministic', () => {
      expect(fingerprint('same')).toBe(fingerprint('same'));
    });

    it('should differ for different values', () => {
      expect(fingerprint('a')).not.toBe(fingerprint('b'));
    });
  });

  describe('mask', () => {
    it('should mask a long key value', () => {
      expect(mask('sk-proj-abc123xyz789')).toBe('sk-p...z789');
    });

    it('should mask GitHub PAT', () => {
      expect(mask('ghp_abcdefghijklmnopqrstuvwxyz1234567890')).toBe('ghp_...7890');
    });

    it('should return asterisks for very short values', () => {
      expect(mask('short')).toBe('*****');
    });

    it('should handle custom prefix/suffix length', () => {
      expect(mask('sk-proj-abc123xyz789', 7, 4)).toBe('sk-proj...z789');
    });

    it('should return asterisks for empty string', () => {
      expect(mask('')).toBe('');
    });
  });
});
