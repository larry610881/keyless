import { success, error, info } from '../utils.js';
import { loadStore } from '../load-store.js';
import type { UseKeyTarget } from '../../types.js';

export async function useCommand(
  name: string,
  options: {
    dotenv?: string | boolean;
    exec?: string[];
    shell?: boolean;
    env?: boolean;
  },
) {
  const store = await loadStore();

  let target: UseKeyTarget;
  let dotenvPath: string | undefined;
  let command: string[] | undefined;

  if (options.shell) {
    // For shell mode, we retrieve the value and print export statement
    const meta = await store.getKeyMeta(name);
    if (!meta) {
      error(`Key "${name}" not found.`);
      process.exit(1);
    }
    const value = await store.getKeyValue(name);
    if (!value) {
      error(`Secret value not found for key "${name}".`);
      process.exit(1);
    }
    // Print export statement for eval $(keyless use <name> --shell)
    console.log(`export ${meta.envVar}=${value}`);
    return;
  } else if (options.exec) {
    target = 'subprocess';
    command = options.exec;
  } else if (options.env) {
    target = 'env';
  } else {
    // Default to dotenv
    target = 'dotenv';
    dotenvPath = typeof options.dotenv === 'string' ? options.dotenv : undefined;
  }

  try {
    const result = await store.useKey({
      keyName: name,
      target,
      dotenvPath,
      command,
    });

    if (target === 'subprocess') {
      process.exitCode = result.exitCode ?? 0;
    } else if (target === 'dotenv') {
      success(`Injected ${result.envVar} into ${dotenvPath || '.env'}`);
    } else {
      success(`Set ${result.envVar} in process environment.`);
    }
  } catch (err: any) {
    error(err.message);
    process.exit(1);
  }
}
