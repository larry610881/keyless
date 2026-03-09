import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { KeychainAdapter, VaultData, EncryptedEntry } from '../types.js';
import { VAULT_FILENAME } from '../constants.js';
import { deriveKey, generateSalt, encrypt, decrypt } from '../core/crypto.js';

/**
 * Fallback keychain adapter that stores secrets in an AES-256-GCM encrypted
 * vault file (~/.keyless/vault.enc). Used when no OS keychain is available.
 */
export class FallbackKeychainAdapter implements KeychainAdapter {
  readonly name = 'file-vault';
  private readonly stateDir: string;
  private readonly vaultPath: string;
  private masterPassword: string;
  private vault: VaultData | null = null;

  constructor(stateDir: string, masterPassword?: string) {
    this.stateDir = stateDir;
    this.vaultPath = join(stateDir, VAULT_FILENAME);
    this.masterPassword = masterPassword ?? '';
  }

  async isAvailable(): Promise<boolean> {
    return true; // Always available as last resort
  }

  setMasterPassword(password: string): void {
    this.masterPassword = password;
    this.vault = null; // Force reload with new password
  }

  async getSecret(keyId: string): Promise<string | null> {
    const vault = await this.loadVault();
    const entry = vault.entries[keyId];
    if (!entry) return null;

    const key = deriveKey(this.masterPassword, Buffer.from(vault.salt, 'hex'));
    return decrypt(entry, key);
  }

  async setSecret(keyId: string, value: string): Promise<void> {
    const vault = await this.loadVault();
    const key = deriveKey(this.masterPassword, Buffer.from(vault.salt, 'hex'));
    vault.entries[keyId] = encrypt(value, key);
    await this.saveVault(vault);
  }

  async deleteSecret(keyId: string): Promise<boolean> {
    const vault = await this.loadVault();
    if (!(keyId in vault.entries)) return false;
    delete vault.entries[keyId];
    await this.saveVault(vault);
    return true;
  }

  private async loadVault(): Promise<VaultData> {
    if (this.vault) return this.vault;

    try {
      const raw = await readFile(this.vaultPath, 'utf8');
      this.vault = JSON.parse(raw) as VaultData;
    } catch {
      // Create new vault
      const salt = generateSalt();
      this.vault = {
        version: 1,
        salt: salt.toString('hex'),
        entries: {},
      };
    }
    return this.vault;
  }

  private async saveVault(vault: VaultData): Promise<void> {
    await mkdir(this.stateDir, { recursive: true });
    await writeFile(this.vaultPath, JSON.stringify(vault, null, 2), { mode: 0o600 });
    this.vault = vault;
  }
}
