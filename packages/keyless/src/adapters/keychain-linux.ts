import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { KeychainAdapter } from '../types.js';

const execFileAsync = promisify(execFile);
const SCHEMA_NAME = 'keyless';

export class LinuxKeychainAdapter implements KeychainAdapter {
  readonly name = 'linux-secret-service';

  async isAvailable(): Promise<boolean> {
    if (process.platform !== 'linux') return false;
    try {
      await execFileAsync('which', ['secret-tool']);
      return true;
    } catch {
      return false;
    }
  }

  async getSecret(keyId: string): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync('secret-tool', [
        'lookup',
        'application', SCHEMA_NAME,
        'key-id', keyId,
      ]);
      return stdout.trimEnd() || null;
    } catch {
      return null;
    }
  }

  async setSecret(keyId: string, value: string): Promise<void> {
    const child = execFileAsync('secret-tool', [
      'store',
      '--label', `keyless:${keyId}`,
      'application', SCHEMA_NAME,
      'key-id', keyId,
    ]);
    // secret-tool reads the secret from stdin
    child.child.stdin?.write(value);
    child.child.stdin?.end();
    await child;
  }

  async deleteSecret(keyId: string): Promise<boolean> {
    try {
      await execFileAsync('secret-tool', [
        'clear',
        'application', SCHEMA_NAME,
        'key-id', keyId,
      ]);
      return true;
    } catch {
      return false;
    }
  }
}
