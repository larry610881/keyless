import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { KeychainAdapter } from '../types.js';

const execFileAsync = promisify(execFile);
const SERVICE_NAME = 'keyless';

export class MacOSKeychainAdapter implements KeychainAdapter {
  readonly name = 'macos-keychain';

  async isAvailable(): Promise<boolean> {
    if (process.platform !== 'darwin') return false;
    try {
      await execFileAsync('security', ['list-keychains']);
      return true;
    } catch {
      return false;
    }
  }

  async getSecret(keyId: string): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync('security', [
        'find-generic-password',
        '-s', SERVICE_NAME,
        '-a', keyId,
        '-w',
      ]);
      return stdout.trimEnd();
    } catch {
      return null;
    }
  }

  async setSecret(keyId: string, value: string): Promise<void> {
    // Delete existing entry first (ignore errors if it doesn't exist)
    try {
      await execFileAsync('security', [
        'delete-generic-password',
        '-s', SERVICE_NAME,
        '-a', keyId,
      ]);
    } catch {
      // Key didn't exist, that's fine
    }

    await execFileAsync('security', [
      'add-generic-password',
      '-s', SERVICE_NAME,
      '-a', keyId,
      '-w', value,
      '-U',
    ]);
  }

  async deleteSecret(keyId: string): Promise<boolean> {
    try {
      await execFileAsync('security', [
        'delete-generic-password',
        '-s', SERVICE_NAME,
        '-a', keyId,
      ]);
      return true;
    } catch {
      return false;
    }
  }
}
