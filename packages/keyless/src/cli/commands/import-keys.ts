import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { success, error, info } from '../utils.js';
import { loadStore } from '../load-store.js';

export async function importCommand(file: string) {
  const filePath = resolve(file);

  if (!existsSync(filePath)) {
    error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const store = await loadStore();

  try {
    const imported = await store.importFromDotenv(filePath);

    if (imported.length === 0) {
      info('No keys imported (file empty or all duplicates).');
      return;
    }

    success(`Imported ${imported.length} key(s):`);
    for (const meta of imported) {
      info(`  ${meta.name} (${meta.provider}) -> ${meta.envVar}`);
    }
  } catch (err: any) {
    error(err.message);
    process.exit(1);
  }
}
