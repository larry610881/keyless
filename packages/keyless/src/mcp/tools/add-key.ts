import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { KeyStore } from '../../core/store.js';
import type { KeyType } from '../../types.js';
import { sanitizeToolResponse } from '../guards.js';

export function registerAddKeyTool(server: McpServer, store: KeyStore) {
  server.tool(
    'add_key',
    'Store a new API key or PAT securely. The key value is encrypted immediately and NEVER returned in responses.',
    {
      name: z.string().describe('Human-readable name (e.g. "openai-prod")'),
      value: z.string().describe('The actual secret value'),
      type: z.enum(['api_key', 'pat', 'oauth_token', 'ssh_key', 'custom']).optional(),
      provider: z.string().optional().describe('Provider name (auto-detected if omitted)'),
      envVar: z.string().optional().describe('Environment variable name (auto-detected if omitted)'),
      tags: z.array(z.string()).optional().describe('Tags for organization'),
      expiresAt: z.string().optional().describe('Expiration date (ISO 8601)'),
    },
    async (params: {
      name: string;
      value: string;
      type?: string;
      provider?: string;
      envVar?: string;
      tags?: string[];
      expiresAt?: string;
    }) => {
      const meta = await store.addKey(params.name, params.value, {
        type: params.type as KeyType | undefined,
        provider: params.provider,
        envVar: params.envVar,
        tags: params.tags,
        expiresAt: params.expiresAt,
      });

      return {
        content: sanitizeToolResponse([
          {
            type: 'text',
            text: JSON.stringify(
              {
                status: 'stored',
                id: meta.id,
                name: meta.name,
                provider: meta.provider,
                type: meta.type,
                envVar: meta.envVar,
                masked: meta.masked,
                message:
                  'The key value has been encrypted. Please delete it from this conversation.',
              },
              null,
              2,
            ),
          },
        ]),
      };
    },
  );
}
