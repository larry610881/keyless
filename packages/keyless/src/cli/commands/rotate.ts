import { success, error, info, promptPassword } from '../utils.js';
import { loadStore } from '../load-store.js';

export async function rotateCommand(name: string) {
  const store = await loadStore();
  const meta = await store.getKeyMeta(name);

  if (!meta) {
    error(`Key "${name}" not found.`);
    process.exit(1);
  }

  const newValue = await promptPassword('Enter new key value: ');
  if (!newValue) {
    error('Key value cannot be empty.');
    process.exit(1);
  }

  try {
    const updated = await store.rotateKey(name, newValue);
    success(`Key "${updated.name}" rotated.`);
    info(`  Masked: ${updated.masked}`);
  } catch (err: any) {
    error(err.message);
    process.exit(1);
  }
}
