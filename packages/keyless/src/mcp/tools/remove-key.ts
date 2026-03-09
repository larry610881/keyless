import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { KeyStore } from '../../core/store.js';

export function registerRemoveKeyTool(server: McpServer, store: KeyStore) {
  server.tool(
    'remove_key',
    'Permanently delete a stored key. Requires explicit confirmation.',
    {
      name: z.string().describe('Key name to remove'),
      confirm: z.boolean().describe('Must be true to confirm deletion'),
    },
    async (params: { name: string; confirm: boolean }) => {
      if (!params.confirm) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Deletion cancelled. Set confirm=true to permanently remove the key.',
            },
          ],
        };
      }

      const deleted = await store.removeKey(params.name);

      if (!deleted) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Key "${params.name}" not found.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: `Key "${params.name}" has been permanently deleted from the store and keychain.`,
          },
        ],
      };
    },
  );
}
