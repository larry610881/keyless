import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { KeylessConfig } from '../../types.js';
import { success, info, warn, error, promptPassword } from '../utils.js';
import { createKeychainAdapter } from '../../adapters/keychain.js';

export async function initCommand(options: { backend?: string; stateDir?: string }) {
  const stateDir = options.stateDir || join(homedir(), '.keyless');

  if (existsSync(join(stateDir, 'config.json'))) {
    warn('keyless is already initialized at ' + stateDir);
    return;
  }

  // Create state directory
  await mkdir(stateDir, { recursive: true });

  // Determine backend
  const config: KeylessConfig = {
    stateDir,
    preferredBackend: (options.backend as 'keychain' | 'file' | 'auto') || 'auto',
    auditLogEnabled: true,
    auditLogMaxEntries: 10000,
    createdAt: new Date().toISOString(),
    version: 1,
  };

  const adapter = await createKeychainAdapter(stateDir);
  info(`Using backend: ${adapter.name}`);

  // If fallback, need master password
  if (adapter.name === 'file-vault') {
    info('No OS keychain detected. Using encrypted file storage.');
    const password = await promptPassword('Set master password: ');
    if (!password) { error('Master password is required for file backend.'); return; }
    const confirm = await promptPassword('Confirm master password: ');
    if (password !== confirm) { error('Passwords do not match.'); return; }
    const { createHash } = await import('node:crypto');
    config.masterPasswordHash = createHash('sha256').update(password).digest('hex');
  }

  // Write config
  await writeFile(join(stateDir, 'config.json'), JSON.stringify(config, null, 2));
  // Write empty index
  await writeFile(join(stateDir, 'index.json'), JSON.stringify({ version: 1, keys: [] }, null, 2));

  success(`keyless initialized at ${stateDir}`);
  info(`Backend: ${adapter.name}`);
}
