import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { KeyStore } from '../../core/store.js';
import type { KeyType } from '../../types.js';
import { sanitizeToolResponse } from '../guards.js';

export function registerListKeysTool(server: McpServer, store: KeyStore) {
  server.tool(
    'list_keys',
    'List all stored API keys and PATs. Returns metadata only (name, provider, type, masked value). NEVER returns actual key values.',
    {
      provider: z.string().optional().describe('Filter by provider (e.g. "openai", "github")'),
      type: z.enum(['api_key', 'pat', 'oauth_token', 'ssh_key', 'custom']).optional(),
      tag: z.string().optional().describe('Filter by tag'),
    },
    async ({ provider, type, tag }: { provider?: string; type?: string; tag?: string }) => {
      const keys = await store.listKeys({
        provider,
        type: type as KeyType | undefined,
        tags: tag ? [tag] : undefined,
      });
      const table = keys.map(k => ({
        id: k.id,
        name: k.name,
        provider: k.provider,
        type: k.type,
        envVar: k.envVar,
        masked: k.masked,
        tags: k.tags,
        expiresAt: k.expiresAt ?? 'never',
        lastUsedAt: k.lastUsedAt ?? 'never',
      }));
      return {
        content: sanitizeToolResponse([
          { type: 'text', text: JSON.stringify(table, null, 2) },
        ]),
      };
    },
  );
}
