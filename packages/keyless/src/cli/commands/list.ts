import Table from 'cli-table3';
import chalk from 'chalk';
import { loadStore } from '../load-store.js';
import { info } from '../utils.js';
import type { KeyFilter, KeyType } from '../../types.js';

export async function listCommand(options: {
  provider?: string;
  type?: string;
  tag?: string;
  json?: boolean;
  expired?: boolean;
}) {
  const store = await loadStore();

  const filter: KeyFilter = {};
  if (options.provider) filter.provider = options.provider;
  if (options.type) filter.type = options.type as KeyType;
  if (options.tag) filter.tags = [options.tag];
  if (options.expired) filter.expired = true;

  const keys = await store.listKeys(filter);

  if (keys.length === 0) {
    info('No keys found.');
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(keys, null, 2));
    return;
  }

  const table = new Table({
    head: [
      chalk.bold('NAME'),
      chalk.bold('PROVIDER'),
      chalk.bold('TYPE'),
      chalk.bold('ENV_VAR'),
      chalk.bold('MASKED'),
      chalk.bold('EXPIRES'),
      chalk.bold('TAGS'),
    ],
    style: { head: [] },
  });

  for (const k of keys) {
    const isExpired = k.expiresAt && new Date(k.expiresAt).getTime() < Date.now();
    const expiresStr = k.expiresAt
      ? (isExpired ? chalk.red(k.expiresAt) : k.expiresAt)
      : chalk.dim('-');

    table.push([
      k.name,
      k.provider,
      k.type,
      k.envVar,
      chalk.dim(k.masked),
      expiresStr,
      k.tags.length ? k.tags.join(', ') : chalk.dim('-'),
    ]);
  }

  console.log(table.toString());
}
