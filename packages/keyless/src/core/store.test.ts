import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { KeychainAdapter, KeylessConfig } from '../types.js';
import { KeyStore } from './store.js';

function createMockAdapter(): KeychainAdapter & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    name: 'mock',
    store,
    async isAvailable() { return true; },
    async getSecret(keyId: string) { return store.get(keyId) ?? null; },
    async setSecret(keyId: string, value: string) { store.set(keyId, value); },
    async deleteSecret(keyId: string) { return store.delete(keyId); },
  };
}

function createConfig(stateDir: string): KeylessConfig {
  return {
    stateDir,
    preferredBackend: 'file',
    auditLogEnabled: true,
    auditLogMaxEntries: 10000,
    createdAt: new Date().toISOString(),
    version: 1,
  };
}

describe('KeyStore', () => {
  let tmpDir: string;
  let adapter: ReturnType<typeof createMockAdapter>;
  let store: KeyStore;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'keyless-test-'));
    adapter = createMockAdapter();
    store = new KeyStore(createConfig(tmpDir), adapter);
  });

  describe('addKey', () => {
    it('should add a key and return metadata', async () => {
      const meta = await store.addKey('openai-prod', 'sk-proj-abcdefghij1234567890abcdefghij');
      expect(meta.name).toBe('openai-prod');
      expect(meta.id).toMatch(/^k_/);
      expect(meta.provider).toBe('openai');
      expect(meta.type).toBe('api_key');
      expect(meta.envVar).toBe('OPENAI_API_KEY');
      expect(meta.masked).toMatch(/^sk-p\.\.\..*$/);
      expect(meta.fingerprint).toMatch(/^[0-9a-f]{64}$/);
      expect(meta.storageBackend).toBe('keychain');
    });

    it('should auto-detect GitHub PAT', async () => {
      const meta = await store.addKey('github-ci', 'ghp_abcdefghijklmnopqrstuvwxyz1234567890');
      expect(meta.provider).toBe('github');
      expect(meta.type).toBe('pat');
      expect(meta.envVar).toBe('GITHUB_TOKEN');
    });

    it('should use custom metadata when provided', async () => {
      const meta = await store.addKey('my-key', 'some-value', {
        type: 'ssh_key',
        provider: 'custom-provider',
        envVar: 'MY_CUSTOM_VAR',
        tags: ['prod', 'ci'],
      });
      expect(meta.type).toBe('ssh_key');
      expect(meta.provider).toBe('custom-provider');
      expect(meta.envVar).toBe('MY_CUSTOM_VAR');
      expect(meta.tags).toEqual(['prod', 'ci']);
    });

    it('should reject duplicate names', async () => {
      await store.addKey('my-key', 'value-1');
      await expect(store.addKey('my-key', 'value-2')).rejects.toThrow('already exists');
    });

    it('should store the secret in the adapter', async () => {
      const meta = await store.addKey('test-key', 'secret-value');
      expect(adapter.store.get(meta.id)).toBe('secret-value');
    });

    it('should generate envVar from name for unknown providers', async () => {
      const meta = await store.addKey('my-custom-service', 'unknown-value-format');
      expect(meta.envVar).toBe('MY_CUSTOM_SERVICE');
      expect(meta.provider).toBe('unknown');
      expect(meta.type).toBe('custom');
    });
  });

  describe('getKeyMeta', () => {
    it('should find key by name', async () => {
      const added = await store.addKey('test-key', 'value');
      const found = await store.getKeyMeta('test-key');
      expect(found).toBeTruthy();
      expect(found!.id).toBe(added.id);
    });

    it('should find key by id', async () => {
      const added = await store.addKey('test-key', 'value');
      const found = await store.getKeyMeta(added.id);
      expect(found).toBeTruthy();
      expect(found!.name).toBe('test-key');
    });

    it('should return null for unknown key', async () => {
      const found = await store.getKeyMeta('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('listKeys', () => {
    beforeEach(async () => {
      await store.addKey('openai-prod', 'sk-proj-abcdefghij1234567890abcdefghij', { tags: ['prod'] });
      await store.addKey('github-ci', 'ghp_abcdefghijklmnopqrstuvwxyz1234567890', { tags: ['ci'] });
      await store.addKey('custom-key', 'some-value', { provider: 'custom', tags: ['prod', 'ci'] });
    });

    it('should list all keys', async () => {
      const keys = await store.listKeys();
      expect(keys.length).toBe(3);
    });

    it('should filter by provider', async () => {
      const keys = await store.listKeys({ provider: 'openai' });
      expect(keys.length).toBe(1);
      expect(keys[0].name).toBe('openai-prod');
    });

    it('should filter by type', async () => {
      const keys = await store.listKeys({ type: 'pat' });
      expect(keys.length).toBe(1);
      expect(keys[0].name).toBe('github-ci');
    });

    it('should filter by tags', async () => {
      const keys = await store.listKeys({ tags: ['prod'] });
      expect(keys.length).toBe(2);
    });
  });

  describe('removeKey', () => {
    it('should remove a key by name', async () => {
      await store.addKey('to-remove', 'value');
      const result = await store.removeKey('to-remove');
      expect(result).toBe(true);
      const found = await store.getKeyMeta('to-remove');
      expect(found).toBeNull();
    });

    it('should return false for unknown key', async () => {
      const result = await store.removeKey('nonexistent');
      expect(result).toBe(false);
    });

    it('should remove from adapter', async () => {
      const meta = await store.addKey('to-remove', 'secret');
      expect(adapter.store.has(meta.id)).toBe(true);
      await store.removeKey('to-remove');
      expect(adapter.store.has(meta.id)).toBe(false);
    });
  });

  describe('rotateKey', () => {
    it('should update the secret value', async () => {
      const meta = await store.addKey('rotate-me', 'old-value');
      const oldFingerprint = meta.fingerprint;
      const rotated = await store.rotateKey('rotate-me', 'new-value');
      expect(rotated.id).toBe(meta.id);
      expect(rotated.fingerprint).not.toBe(oldFingerprint);
      expect(adapter.store.get(meta.id)).toBe('new-value');
    });

    it('should update the masked display', async () => {
      await store.addKey('rotate-me', 'sk-proj-abcdefghij1234567890abcdefghij');
      const rotated = await store.rotateKey('rotate-me', 'ghp_abcdefghijklmnopqrstuvwxyz1234567890');
      expect(rotated.masked).toBe('ghp_...7890');
    });

    it('should throw for unknown key', async () => {
      await expect(store.rotateKey('nonexistent', 'value')).rejects.toThrow('not found');
    });
  });

  describe('getKeyValue', () => {
    it('should return the secret value', async () => {
      await store.addKey('secret-key', 'my-secret-value');
      const value = await store.getKeyValue('secret-key');
      expect(value).toBe('my-secret-value');
    });

    it('should update lastUsedAt', async () => {
      const meta = await store.addKey('used-key', 'value');
      expect(meta.lastUsedAt).toBeUndefined();
      await store.getKeyValue('used-key');
      const updated = await store.getKeyMeta('used-key');
      expect(updated!.lastUsedAt).toBeTruthy();
    });

    it('should return null for unknown key', async () => {
      const value = await store.getKeyValue('nonexistent');
      expect(value).toBeNull();
    });
  });

  describe('useKey', () => {
    it('should inject key into process.env', async () => {
      await store.addKey('env-key', 'env-secret', { envVar: 'TEST_KEYLESS_VAR' });
      const result = await store.useKey({
        keyName: 'env-key',
        target: 'env',
      });
      expect(result.injected).toBe(true);
      expect(result.envVar).toBe('TEST_KEYLESS_VAR');
      expect(process.env.TEST_KEYLESS_VAR).toBe('env-secret');
      // Cleanup
      delete process.env.TEST_KEYLESS_VAR;
    });

    it('should allow overriding envVar', async () => {
      await store.addKey('override-key', 'value', { envVar: 'ORIGINAL_VAR' });
      const result = await store.useKey({
        keyName: 'override-key',
        target: 'env',
        envVar: 'OVERRIDE_VAR',
      });
      expect(result.envVar).toBe('OVERRIDE_VAR');
      expect(process.env.OVERRIDE_VAR).toBe('value');
      delete process.env.OVERRIDE_VAR;
    });

    it('should throw for missing key', async () => {
      await expect(store.useKey({
        keyName: 'missing',
        target: 'env',
      })).rejects.toThrow('not found');
    });

    it('should write to dotenv file', async () => {
      await store.addKey('dotenv-key', 'dotenv-secret', { envVar: 'DOTENV_VAR' });
      const dotenvPath = join(tmpDir, '.env');
      await store.useKey({
        keyName: 'dotenv-key',
        target: 'dotenv',
        dotenvPath,
      });
      const content = await readFile(dotenvPath, 'utf8');
      expect(content).toContain('DOTENV_VAR=dotenv-secret');
    });
  });

  describe('checkExpiry', () => {
    it('should find keys expiring soon', async () => {
      const soon = new Date(Date.now() + 7 * 86_400_000).toISOString();
      await store.addKey('expiring', 'value', { expiresAt: soon });
      await store.addKey('not-expiring', 'value2');

      const expiring = await store.checkExpiry(30);
      expect(expiring.length).toBe(1);
      expect(expiring[0].name).toBe('expiring');
    });

    it('should find already expired keys', async () => {
      const past = new Date(Date.now() - 86_400_000).toISOString();
      await store.addKey('expired', 'value', { expiresAt: past });

      const expiring = await store.checkExpiry(0);
      expect(expiring.length).toBe(1);
    });
  });

  describe('importFromDotenv', () => {
    it('should import keys from .env file', async () => {
      const dotenvPath = join(tmpDir, 'import.env');
      const { writeFile: wf } = await import('node:fs/promises');
      await wf(dotenvPath, [
        '# Comment',
        'OPENAI_API_KEY=sk-proj-abcdefghij1234567890abcdefghij',
        'GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz1234567890',
        '',
        'CUSTOM_VAR="some-value"',
      ].join('\n'));

      const imported = await store.importFromDotenv(dotenvPath);
      expect(imported.length).toBe(3);

      const openai = imported.find(k => k.provider === 'openai');
      expect(openai).toBeTruthy();
      expect(openai!.envVar).toBe('OPENAI_API_KEY');
    });
  });

  describe('persistence', () => {
    it('should persist index across instances', async () => {
      await store.addKey('persist-test', 'value');

      // Create new store pointing to same dir
      const store2 = new KeyStore(createConfig(tmpDir), adapter);
      const found = await store2.getKeyMeta('persist-test');
      expect(found).toBeTruthy();
      expect(found!.name).toBe('persist-test');
    });
  });
});
