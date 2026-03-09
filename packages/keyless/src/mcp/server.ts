import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { KeyStore } from '../core/store.js';
import { createKeychainAdapter } from '../adapters/keychain.js';
import type { KeylessConfig } from '../types.js';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { CONFIG_FILENAME, VERSION } from '../constants.js';
import { registerListKeysTool } from './tools/list-keys.js';
import { registerAddKeyTool } from './tools/add-key.js';
import { registerUseKeyTool } from './tools/use-key.js';
import { registerRemoveKeyTool } from './tools/remove-key.js';
import { registerRotateKeyTool } from './tools/rotate-key.js';
import { registerCheckExpiryTool } from './tools/check-expiry.js';
import { registerAuditLogTool } from './tools/audit-log.js';

export async function createMcpServer(): Promise<McpServer> {
  const stateDir = process.env.KEYLESS_STATE_DIR || join(homedir(), '.keyless');

  // Load or create default config
  let config: KeylessConfig;
  const configPath = join(stateDir, CONFIG_FILENAME);
  if (existsSync(configPath)) {
    config = JSON.parse(await readFile(configPath, 'utf-8'));
  } else {
    config = {
      stateDir,
      preferredBackend: (process.env.KEYLESS_BACKEND as KeylessConfig['preferredBackend']) || 'auto',
      auditLogEnabled: process.env.KEYLESS_AUDIT !== 'false',
      auditLogMaxEntries: 10000,
      createdAt: new Date().toISOString(),
      version: 1,
    };
  }

  const adapter = await createKeychainAdapter(config.stateDir);
  const store = new KeyStore(config, adapter);

  const server = new McpServer({
    name: 'keyless',
    version: VERSION,
  });

  // Register all tools
  registerListKeysTool(server, store);
  registerAddKeyTool(server, store);
  registerUseKeyTool(server, store);
  registerRemoveKeyTool(server, store);
  registerRotateKeyTool(server, store);
  registerCheckExpiryTool(server, store);
  registerAuditLogTool(server, store);

  return server;
}
