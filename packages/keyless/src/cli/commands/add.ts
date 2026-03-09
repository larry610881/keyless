import { success, error, info, promptPassword } from '../utils.js';
import { loadStore } from '../load-store.js';
import { detectProvider } from '../../constants.js';
import type { KeyType } from '../../types.js';

export async function addCommand(
  name: string,
  options: {
    type?: string;
    provider?: string;
    envVar?: string;
    tags?: string;
    expires?: string;
    fromEnv?: string;
    stdin?: boolean;
  },
) {
  let value: string;

  if (options.fromEnv) {
    const envVal = process.env[options.fromEnv];
    if (!envVal) {
      error(`Environment variable "${options.fromEnv}" is not set.`);
      process.exit(1);
    }
    value = envVal;
  } else if (options.stdin) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    value = Buffer.concat(chunks).toString('utf-8').trim();
  } else {
    value = await promptPassword('Enter key value: ');
    if (!value) {
      error('Key value cannot be empty.');
      process.exit(1);
    }
  }

  const detected = detectProvider(value);
  const store = await loadStore();

  try {
    const meta = await store.addKey(name, value, {
      type: (options.type as KeyType) ?? detected?.type,
      provider: options.provider ?? detected?.provider,
      envVar: options.envVar ?? detected?.envVar,
      tags: options.tags ? options.tags.split(',').map(t => t.trim()) : undefined,
      expiresAt: options.expires,
    });

    success(`Key "${meta.name}" stored.`);
    info(`  Provider: ${meta.provider}`);
    info(`  Type:     ${meta.type}`);
    info(`  Env var:  ${meta.envVar}`);
    info(`  Masked:   ${meta.masked}`);
    if (meta.expiresAt) info(`  Expires:  ${meta.expiresAt}`);
  } catch (err: any) {
    error(err.message);
    process.exit(1);
  }
}
