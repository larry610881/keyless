import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { KeyStore } from '../../core/store.js';
import { sanitizeToolResponse } from '../guards.js';

export function registerRotateKeyTool(server: McpServer, store: KeyStore) {
  server.tool(
    'rotate_key',
    'Replace an existing key with a new value. The old value is overwritten. NEVER returns the actual key value.',
    {
      name: z.string().describe('Key name to rotate'),
      newValue: z.string().describe('The new secret value'),
      expiresAt: z.string().optional().describe('New expiration date (ISO 8601)'),
    },
    async (params: { name: string; newValue: string; expiresAt?: string }) => {
      const rotated = await store.rotateKey(params.name, params.newValue, {
        expiresAt: params.expiresAt,
      });

      return {
        content: sanitizeToolResponse([
          {
            type: 'text',
            text: JSON.stringify(
              {
                status: 'rotated',
                id: rotated.id,
                name: rotated.name,
                masked: rotated.masked,
                updatedAt: rotated.updatedAt,
                message:
                  'The new key value has been encrypted. Please delete it from this conversation.',
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
