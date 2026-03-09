import chalk from 'chalk';
import { loadStore } from '../load-store.js';
import { success, warn, info } from '../utils.js';

export async function checkExpiryCommand(options: { days?: string }) {
  const days = parseInt(options.days || '30', 10);
  const store = await loadStore();
  const expiring = await store.checkExpiry(days);

  if (expiring.length === 0) {
    success(`No keys expiring within ${days} days.`);
    return;
  }

  warn(`${expiring.length} key(s) expiring within ${days} days:`);

  for (const k of expiring) {
    const expires = new Date(k.expiresAt!);
    const daysLeft = Math.ceil((expires.getTime() - Date.now()) / 86_400_000);
    const label = daysLeft <= 0
      ? chalk.red(`EXPIRED ${Math.abs(daysLeft)} day(s) ago`)
      : chalk.yellow(`${daysLeft} day(s) left`);
    info(`  ${k.name} (${k.provider}) - ${label}`);
  }
}
