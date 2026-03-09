import Table from 'cli-table3';
import chalk from 'chalk';
import { loadStore } from '../load-store.js';
import { info } from '../utils.js';
import type { AuditAction } from '../../types.js';

export async function auditCommand(options: {
  key?: string;
  action?: string;
  limit?: string;
}) {
  const store = await loadStore();
  const audit = store.getAuditLogger();
  const limit = parseInt(options.limit || '20', 10);

  let entries = await audit.query({
    keyName: options.key,
    action: options.action as AuditAction | undefined,
  });

  // Apply limit (most recent first)
  entries = entries.slice(-limit).reverse();

  if (entries.length === 0) {
    info('No audit entries found.');
    return;
  }

  const table = new Table({
    head: [
      chalk.bold('TIME'),
      chalk.bold('ACTION'),
      chalk.bold('KEY'),
      chalk.bold('ACTOR'),
      chalk.bold('TARGET'),
      chalk.bold('OK'),
    ],
    style: { head: [] },
  });

  for (const e of entries) {
    table.push([
      e.timestamp.replace('T', ' ').slice(0, 19),
      e.action,
      e.keyName,
      e.actor,
      e.target || chalk.dim('-'),
      e.success ? chalk.green('yes') : chalk.red('no'),
    ]);
  }

  console.log(table.toString());
}
