#!/usr/bin/env node
import { Command } from 'commander';
import { VERSION } from './constants.js';

const program = new Command();

program
  .name('keyless')
  .description('Local API key and PAT manager for AI coding agents')
  .version(VERSION);

program
  .command('init')
  .description('Initialize keyless (setup keychain backend)')
  .option('--backend <type>', 'Force backend: keychain | file')
  .option('--state-dir <path>', 'Override state directory')
  .action(async (options) => {
    const { initCommand } = await import('./cli/commands/init.js');
    await initCommand(options);
  });

program
  .command('add <name>')
  .description('Store a new API key or PAT')
  .option('-t, --type <type>', 'Key type: api_key | pat | oauth_token | ssh_key | custom', 'api_key')
  .option('-p, --provider <name>', 'Provider name')
  .option('-e, --env-var <name>', 'Environment variable name')
  .option('--tags <tags>', 'Comma-separated tags')
  .option('--expires <date>', 'Expiration date (ISO 8601)')
  .option('--from-env <var>', 'Read value from environment variable')
  .option('--stdin', 'Read value from stdin')
  .action(async (name, options) => {
    const { addCommand } = await import('./cli/commands/add.js');
    await addCommand(name, options);
  });

program
  .command('list')
  .description('List stored keys (metadata only)')
  .option('-p, --provider <name>', 'Filter by provider')
  .option('-t, --type <type>', 'Filter by type')
  .option('--tag <tag>', 'Filter by tag')
  .option('--json', 'Output as JSON')
  .option('--expired', 'Show only expired keys')
  .action(async (options) => {
    const { listCommand } = await import('./cli/commands/list.js');
    await listCommand(options);
  });

program
  .command('use <name>')
  .description('Inject a key into env var or .env file')
  .option('--dotenv [path]', 'Write to .env file')
  .option('--exec <cmd...>', 'Run command with key injected')
  .option('--shell', 'Print export statement')
  .option('--env', 'Set process environment variable')
  .action(async (name, options) => {
    const { useCommand } = await import('./cli/commands/use.js');
    await useCommand(name, options);
  });

program
  .command('remove <name>')
  .description('Delete a stored key')
  .option('--force', 'Skip confirmation')
  .action(async (name, options) => {
    const { removeCommand } = await import('./cli/commands/remove.js');
    await removeCommand(name, options);
  });

program
  .command('rotate <name>')
  .description('Replace a key with a new value')
  .action(async (name) => {
    const { rotateCommand } = await import('./cli/commands/rotate.js');
    await rotateCommand(name);
  });

program
  .command('import <file>')
  .description('Import keys from a .env file')
  .action(async (file) => {
    const { importCommand } = await import('./cli/commands/import-keys.js');
    await importCommand(file);
  });

program
  .command('audit')
  .description('View access audit log')
  .option('--key <name>', 'Filter by key name')
  .option('--action <type>', 'Filter by action')
  .option('--limit <n>', 'Max entries', '20')
  .action(async (options) => {
    const { auditCommand } = await import('./cli/commands/audit.js');
    await auditCommand(options);
  });

program
  .command('check-expiry')
  .description('Check for expiring keys')
  .option('--days <n>', 'Threshold days', '30')
  .action(async (options) => {
    const { checkExpiryCommand } = await import('./cli/commands/check-expiry.js');
    await checkExpiryCommand(options);
  });

program
  .command('serve')
  .description('Start MCP server (stdio transport)')
  .action(async () => {
    const { serveCommand } = await import('./cli/commands/serve.js');
    await serveCommand();
  });

program.parse();
