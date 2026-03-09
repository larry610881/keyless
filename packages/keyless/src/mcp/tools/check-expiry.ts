import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { KeyStore } from '../../core/store.js';

export function registerCheckExpiryTool(server: McpServer, store: KeyStore) {
  server.tool(
    'check_expiry',
    'Check for keys that are expired or expiring within a threshold. Returns key names and days until expiry.',
    {
      thresholdDays: z
        .number()
        .optional()
        .default(30)
        .describe('Number of days to look ahead (default: 30)'),
    },
    async (params: { thresholdDays?: number }) => {
      const threshold = params.thresholdDays ?? 30;
      const expiringKeys = await store.checkExpiry(threshold);
      const now = Date.now();

      const results = expiringKeys.map(k => {
        const expiresMs = new Date(k.expiresAt!).getTime();
        const daysUntilExpiry = Math.ceil((expiresMs - now) / 86_400_000);
        return {
          name: k.name,
          provider: k.provider,
          expiresAt: k.expiresAt,
          daysUntilExpiry,
          expired: daysUntilExpiry <= 0,
        };
      });

      const text =
        results.length === 0
          ? `No keys expiring within ${threshold} days.`
          : JSON.stringify(results, null, 2);

      return {
        content: [{ type: 'text' as const, text }],
      };
    },
  );
}
