import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { KeyStore } from '../../core/store.js';
import type { AuditAction } from '../../types.js';

export function registerAuditLogTool(server: McpServer, store: KeyStore) {
  server.tool(
    'audit_log',
    'Query the audit log for key operations. Returns filtered entries showing who did what and when.',
    {
      keyName: z.string().optional().describe('Filter by key name'),
      action: z
        .enum(['add', 'read', 'use', 'remove', 'rotate', 'export', 'import'])
        .optional()
        .describe('Filter by action type'),
      limit: z
        .number()
        .optional()
        .default(20)
        .describe('Max entries to return (default: 20)'),
    },
    async (params: { keyName?: string; action?: string; limit?: number }) => {
      const audit = store.getAuditLogger();
      const entries = await audit.query({
        keyName: params.keyName,
        action: params.action as AuditAction | undefined,
      });

      const limit = params.limit ?? 20;
      const limited = entries.slice(-limit);

      return {
        content: [
          {
            type: 'text' as const,
            text:
              limited.length === 0
                ? 'No audit log entries found.'
                : JSON.stringify(limited, null, 2),
          },
        ],
      };
    },
  );
}
