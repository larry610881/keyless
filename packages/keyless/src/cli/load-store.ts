import { join } from 'node:path';
import { homedir } from 'node:os';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { KeyStore } from '../core/store.js';
import { createKeychainAdapter } from '../adapters/keychain.js';
import type { KeylessConfig } from '../types.js';
import { error } from './utils.js';

export async function loadStore(stateDir?: string): Promise<KeyStore> {
  const dir = stateDir || process.env.KEYLESS_STATE_DIR || join(homedir(), '.keyless');
  const configPath = join(dir, 'config.json');

  if (!existsSync(configPath)) {
    error('keyless not initialized. Run "keyless init" first.');
    process.exit(1);
  }

  const config: KeylessConfig = JSON.parse(await readFile(configPath, 'utf-8'));
  const adapter = await createKeychainAdapter(config.stateDir, config.masterPasswordHash);
  return new KeyStore(config, adapter);
}
