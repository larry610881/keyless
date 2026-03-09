import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { nanoid } from 'nanoid';
import type {
  KeyMeta,
  KeylessConfig,
  KeychainAdapter,
  KeyFilter,
  UseKeyOptions,
  UseKeyResult,
  IndexData,
  KeyType,
} from '../types.js';
import {
  INDEX_FILENAME,
  KEY_ID_PREFIX,
  KEY_ID_LENGTH,
  DEFAULT_STATE_DIR,
  DEFAULT_AUDIT_MAX_ENTRIES,
  detectProvider,
} from '../constants.js';
import { fingerprint, mask } from './crypto.js';
import { AuditLogger } from './audit.js';
import { checkExpiry as checkExpiryHelper } from './expiry.js';

const execFileAsync = promisify(execFile);

function resolveStateDir(dir: string): string {
  if (dir.startsWith('~')) {
    return join(homedir(), dir.slice(1));
  }
  return resolve(dir);
}

function generateKeyId(): string {
  return `${KEY_ID_PREFIX}${nanoid(KEY_ID_LENGTH)}`;
}

export class KeyStore {
  private config: KeylessConfig;
  private adapter: KeychainAdapter;
  private index: IndexData = { version: 1, keys: [] };
  private indexPath: string;
  private stateDir: string;
  private audit: AuditLogger;
  private loaded = false;

  constructor(config: KeylessConfig, adapter: KeychainAdapter) {
    this.config = config;
    this.adapter = adapter;
    this.stateDir = resolveStateDir(config.stateDir);
    this.indexPath = join(this.stateDir, INDEX_FILENAME);
    this.audit = new AuditLogger(this.stateDir, config.auditLogMaxEntries);
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    await this.loadIndex();
    this.loaded = true;
  }

  private async loadIndex(): Promise<void> {
    try {
      const raw = await readFile(this.indexPath, 'utf8');
      this.index = JSON.parse(raw) as IndexData;
    } catch {
      this.index = { version: 1, keys: [] };
    }
  }

  private async saveIndex(): Promise<void> {
    await mkdir(this.stateDir, { recursive: true });
    await writeFile(this.indexPath, JSON.stringify(this.index, null, 2), { mode: 0o600 });
  }

  private findKey(idOrName: string): KeyMeta | null {
    return (
      this.index.keys.find(k => k.id === idOrName) ??
      this.index.keys.find(k => k.name === idOrName) ??
      null
    );
  }

  async addKey(
    name: string,
    value: string,
    meta?: {
      type?: KeyType;
      provider?: string;
      envVar?: string;
      tags?: string[];
      expiresAt?: string;
    },
  ): Promise<KeyMeta> {
    await this.ensureLoaded();

    // Check for duplicate name
    if (this.index.keys.some(k => k.name === name)) {
      throw new Error(`Key with name "${name}" already exists`);
    }

    // Auto-detect provider info
    const detected = detectProvider(value);
    const now = new Date().toISOString();
    const id = generateKeyId();
    const storageBackend = this.adapter.name === 'file-vault' ? 'file' as const : 'keychain' as const;

    const keyMeta: KeyMeta = {
      id,
      name,
      type: meta?.type ?? detected?.type ?? 'custom',
      provider: meta?.provider ?? detected?.provider ?? 'unknown',
      tags: meta?.tags ?? [],
      envVar: meta?.envVar ?? detected?.envVar ?? name.toUpperCase().replace(/[^A-Z0-9]/g, '_'),
      createdAt: now,
      updatedAt: now,
      expiresAt: meta?.expiresAt,
      masked: mask(value),
      fingerprint: fingerprint(value),
      storageBackend,
    };

    // Store the actual secret value
    await this.adapter.setSecret(id, value);

    // Add to index
    this.index.keys.push(keyMeta);
    await this.saveIndex();

    if (this.config.auditLogEnabled) {
      await this.audit.log({
        timestamp: now,
        action: 'add',
        keyId: id,
        keyName: name,
        actor: 'cli',
        success: true,
      });
    }

    return keyMeta;
  }

  async getKeyMeta(idOrName: string): Promise<KeyMeta | null> {
    await this.ensureLoaded();
    return this.findKey(idOrName);
  }

  async listKeys(filter?: KeyFilter): Promise<KeyMeta[]> {
    await this.ensureLoaded();
    let keys = [...this.index.keys];

    if (filter) {
      if (filter.provider) {
        keys = keys.filter(k => k.provider === filter.provider);
      }
      if (filter.type) {
        keys = keys.filter(k => k.type === filter.type);
      }
      if (filter.tags && filter.tags.length > 0) {
        keys = keys.filter(k => filter.tags!.some(t => k.tags.includes(t)));
      }
      if (filter.expired !== undefined) {
        const now = Date.now();
        if (filter.expired) {
          keys = keys.filter(k => k.expiresAt && new Date(k.expiresAt).getTime() < now);
        } else {
          keys = keys.filter(k => !k.expiresAt || new Date(k.expiresAt).getTime() >= now);
        }
      }
    }

    return keys;
  }

  async removeKey(idOrName: string): Promise<boolean> {
    await this.ensureLoaded();
    const key = this.findKey(idOrName);
    if (!key) return false;

    const deleted = await this.adapter.deleteSecret(key.id);
    this.index.keys = this.index.keys.filter(k => k.id !== key.id);
    await this.saveIndex();

    if (this.config.auditLogEnabled) {
      await this.audit.log({
        timestamp: new Date().toISOString(),
        action: 'remove',
        keyId: key.id,
        keyName: key.name,
        actor: 'cli',
        success: deleted,
      });
    }

    return deleted;
  }

  async rotateKey(
    idOrName: string,
    newValue: string,
    meta?: { expiresAt?: string },
  ): Promise<KeyMeta> {
    await this.ensureLoaded();
    const oldKey = this.findKey(idOrName);
    if (!oldKey) {
      throw new Error(`Key "${idOrName}" not found`);
    }

    const now = new Date().toISOString();

    // Store new secret
    await this.adapter.setSecret(oldKey.id, newValue);

    // Update metadata
    oldKey.masked = mask(newValue);
    oldKey.fingerprint = fingerprint(newValue);
    oldKey.updatedAt = now;
    oldKey.rotatedFrom = oldKey.id;
    if (meta?.expiresAt !== undefined) {
      oldKey.expiresAt = meta.expiresAt;
    }

    await this.saveIndex();

    if (this.config.auditLogEnabled) {
      await this.audit.log({
        timestamp: now,
        action: 'rotate',
        keyId: oldKey.id,
        keyName: oldKey.name,
        actor: 'cli',
        success: true,
      });
    }

    return oldKey;
  }

  /**
   * Get the actual secret value. INTERNAL USE ONLY — never expose directly to users.
   */
  async getKeyValue(idOrName: string): Promise<string | null> {
    await this.ensureLoaded();
    const key = this.findKey(idOrName);
    if (!key) return null;

    const value = await this.adapter.getSecret(key.id);

    // Update lastUsedAt
    if (value) {
      key.lastUsedAt = new Date().toISOString();
      await this.saveIndex();
    }

    if (this.config.auditLogEnabled) {
      await this.audit.log({
        timestamp: new Date().toISOString(),
        action: 'read',
        keyId: key.id,
        keyName: key.name,
        actor: 'cli',
        success: value !== null,
      });
    }

    return value;
  }

  async useKey(options: UseKeyOptions): Promise<UseKeyResult> {
    await this.ensureLoaded();

    const idOrName = options.keyId ?? options.keyName;
    if (!idOrName) {
      throw new Error('Either keyId or keyName must be provided');
    }

    const key = this.findKey(idOrName);
    if (!key) {
      throw new Error(`Key "${idOrName}" not found`);
    }

    const value = await this.adapter.getSecret(key.id);
    if (!value) {
      throw new Error(`Secret value not found for key "${key.name}"`);
    }

    const envVar = options.envVar ?? key.envVar;
    let result: UseKeyResult;

    switch (options.target) {
      case 'env':
        process.env[envVar] = value;
        result = { envVar, injected: true, target: 'env' };
        break;

      case 'dotenv': {
        const dotenvPath = resolve(options.dotenvPath ?? '.env');
        let content = '';
        try {
          content = await readFile(dotenvPath, 'utf8');
        } catch {
          // File doesn't exist yet
        }

        // Replace existing entry or append
        const regex = new RegExp(`^${envVar}=.*$`, 'm');
        const line = `${envVar}=${value}`;
        if (regex.test(content)) {
          content = content.replace(regex, line);
        } else {
          content = content ? `${content.trimEnd()}\n${line}\n` : `${line}\n`;
        }

        await writeFile(dotenvPath, content);
        result = { envVar, injected: true, target: 'dotenv' };
        break;
      }

      case 'subprocess': {
        if (!options.command || options.command.length === 0) {
          throw new Error('command is required for subprocess target');
        }
        const [cmd, ...args] = options.command;
        const { status } = await new Promise<{ status: number }>((res) => {
          const child = execFile(cmd, args, {
            env: { ...process.env, [envVar]: value },
          }, (error) => {
            res({ status: error ? (error as any).code ?? 1 : 0 });
          });
        });
        result = { envVar, injected: true, target: 'subprocess', exitCode: status };
        break;
      }
    }

    // Update lastUsedAt
    key.lastUsedAt = new Date().toISOString();
    await this.saveIndex();

    if (this.config.auditLogEnabled) {
      await this.audit.log({
        timestamp: new Date().toISOString(),
        action: 'use',
        keyId: key.id,
        keyName: key.name,
        actor: 'cli',
        target: options.target === 'dotenv' ? options.dotenvPath ?? '.env' : `ENV:${envVar}`,
        success: true,
      });
    }

    return result;
  }

  async importFromDotenv(path: string): Promise<KeyMeta[]> {
    const content = await readFile(resolve(path), 'utf8');
    const imported: KeyMeta[] = [];

    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;

      const envVar = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();

      // Strip surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      if (!value) continue;

      const detected = detectProvider(value);
      const name = envVar.toLowerCase().replace(/_/g, '-');

      try {
        const meta = await this.addKey(name, value, {
          envVar,
          provider: detected?.provider,
          type: detected?.type,
        });
        imported.push(meta);
      } catch {
        // Skip duplicates silently
      }
    }

    if (this.config.auditLogEnabled) {
      await this.audit.log({
        timestamp: new Date().toISOString(),
        action: 'import',
        keyId: '*',
        keyName: `dotenv:${path}`,
        actor: 'cli',
        target: path,
        success: true,
      });
    }

    return imported;
  }

  async checkExpiry(thresholdDays = 30): Promise<KeyMeta[]> {
    await this.ensureLoaded();
    return checkExpiryHelper(this.index.keys, thresholdDays);
  }

  getAuditLogger(): AuditLogger {
    return this.audit;
  }
}
