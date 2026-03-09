import { info, error } from '../utils.js';

export async function serveCommand() {
  try {
    const { createMcpServer } = await import('../../mcp/server.js');
    const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
    const server = createMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    info('MCP server started on stdio transport.');
  } catch {
    info('MCP server starting...');
    info('MCP server module not yet available. Install and build first.');
  }
}
