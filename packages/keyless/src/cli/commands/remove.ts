import { success, error, warn, promptConfirm } from '../utils.js';
import { loadStore } from '../load-store.js';

export async function removeCommand(
  name: string,
  options: { force?: boolean },
) {
  const store = await loadStore();
  const meta = await store.getKeyMeta(name);

  if (!meta) {
    error(`Key "${name}" not found.`);
    process.exit(1);
  }

  if (!options.force) {
    const confirmed = await promptConfirm(`Delete key "${meta.name}" (${meta.provider})?`);
    if (!confirmed) {
      warn('Aborted.');
      return;
    }
  }

  const deleted = await store.removeKey(name);
  if (deleted) {
    success(`Key "${meta.name}" removed.`);
  } else {
    error(`Failed to remove key "${meta.name}".`);
    process.exit(1);
  }
}
