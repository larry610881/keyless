import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { AuditEntry } from '../types.js';
import { AuditLogger } from './audit.js';
import { AUDIT_FILENAME } from '../constants.js';

function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    timestamp: new Date().toISOString(),
    action: 'add',
    keyId: 'k_test123',
    keyName: 'test-key',
    actor: 'cli',
    success: true,
    ...overrides,
  };
}

describe('AuditLogger', () => {
  let tmpDir: string;
  let logger: AuditLogger;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'keyless-audit-'));
    logger = new AuditLogger(tmpDir, 10000);
  });

  describe('log', () => {
    it('should write an entry to the audit log', async () => {
      const entry = makeEntry();
      await logger.log(entry);

      const raw = await readFile(join(tmpDir, AUDIT_FILENAME), 'utf8');
      const parsed = JSON.parse(raw.trim());
      expect(parsed.action).toBe('add');
      expect(parsed.keyId).toBe('k_test123');
    });

    it('should append multiple entries', async () => {
      await logger.log(makeEntry({ action: 'add' }));
      await logger.log(makeEntry({ action: 'read' }));
      await logger.log(makeEntry({ action: 'remove' }));

      const raw = await readFile(join(tmpDir, AUDIT_FILENAME), 'utf8');
      const lines = raw.trim().split('\n');
      expect(lines.length).toBe(3);
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      await logger.log(makeEntry({ action: 'add', keyId: 'k_1', keyName: 'key-1', actor: 'cli' }));
      await logger.log(makeEntry({ action: 'read', keyId: 'k_1', keyName: 'key-1', actor: 'mcp' }));
      await logger.log(makeEntry({ action: 'use', keyId: 'k_2', keyName: 'key-2', actor: 'cli', success: false, error: 'not found' }));
      await logger.log(makeEntry({ action: 'remove', keyId: 'k_2', keyName: 'key-2', actor: 'skill' }));
    });

    it('should return all entries without filter', async () => {
      const entries = await logger.query();
      expect(entries.length).toBe(4);
    });

    it('should filter by keyId', async () => {
      const entries = await logger.query({ keyId: 'k_1' });
      expect(entries.length).toBe(2);
    });

    it('should filter by action', async () => {
      const entries = await logger.query({ action: 'use' });
      expect(entries.length).toBe(1);
      expect(entries[0].keyName).toBe('key-2');
    });

    it('should filter by actor', async () => {
      const entries = await logger.query({ actor: 'mcp' });
      expect(entries.length).toBe(1);
    });

    it('should filter by success', async () => {
      const entries = await logger.query({ success: false });
      expect(entries.length).toBe(1);
      expect(entries[0].error).toBe('not found');
    });

    it('should return empty array for empty log', async () => {
      const freshLogger = new AuditLogger(join(tmpDir, 'empty'), 10000);
      const entries = await freshLogger.query();
      expect(entries).toEqual([]);
    });
  });

  describe('prune', () => {
    it('should remove old entries', async () => {
      const oldDate = new Date(Date.now() - 100 * 86_400_000).toISOString();
      const recentDate = new Date().toISOString();

      await logger.log(makeEntry({ timestamp: oldDate, action: 'add' }));
      await logger.log(makeEntry({ timestamp: oldDate, action: 'read' }));
      await logger.log(makeEntry({ timestamp: recentDate, action: 'use' }));

      const pruned = await logger.prune(30);
      expect(pruned).toBe(2);

      const remaining = await logger.query();
      expect(remaining.length).toBe(1);
      expect(remaining[0].action).toBe('use');
    });

    it('should enforce maxEntries', async () => {
      const smallLogger = new AuditLogger(tmpDir, 2);
      await smallLogger.log(makeEntry({ action: 'add' }));
      await smallLogger.log(makeEntry({ action: 'read' }));
      await smallLogger.log(makeEntry({ action: 'use' }));
      await smallLogger.log(makeEntry({ action: 'remove' }));

      const pruned = await smallLogger.prune(365);
      expect(pruned).toBe(2);

      const remaining = await smallLogger.query();
      expect(remaining.length).toBe(2);
    });

    it('should return 0 for empty log', async () => {
      const freshLogger = new AuditLogger(join(tmpDir, 'fresh'), 10000);
      const pruned = await freshLogger.prune(30);
      expect(pruned).toBe(0);
    });
  });
});
