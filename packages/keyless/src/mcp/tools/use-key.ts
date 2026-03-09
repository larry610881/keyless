import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { KeyStore } from '../../core/store.js';
import type { UseKeyTarget } from '../../types.js';

export function registerUseKeyTool(server: McpServer, store: KeyStore) {
  server.tool(
    'use_key',
    'Inject a stored key into the environment or a .env file. The secret value goes directly to the target — the LLM NEVER sees it.',
    {
      name: z.string().describe('Key name to use'),
      target: z.enum(['env', 'dotenv']).describe('"env" for process environment, "dotenv" for .env file'),
      envVar: z.string().optional().describe('Override the default env var name'),
      dotenvPath: z.string().optional().describe('Path to .env file (default: .env)'),
    },
    async (params: {
      name: string;
      target: string;
      envVar?: string;
      dotenvPath?: string;
    }) => {
      const result = await store.useKey({
        keyName: params.name,
        target: params.target as UseKeyTarget,
        envVar: params.envVar,
        dotenvPath: params.dotenvPath,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: `Injected ${result.envVar} into ${result.target}. The secret value was written directly — it was never included in this response.`,
          },
        ],
      };
    },
  );
}
