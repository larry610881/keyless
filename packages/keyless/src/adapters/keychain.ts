import type { KeychainAdapter } from '../types.js';
import { MacOSKeychainAdapter } from './keychain-macos.js';
import { LinuxKeychainAdapter } from './keychain-linux.js';
import { WindowsKeychainAdapter } from './keychain-windows.js';
import { FallbackKeychainAdapter } from './keychain-fallback.js';

/**
 * Create the best available keychain adapter for the current platform.
 * Falls back to encrypted file vault if no OS keychain is available.
 */
export async function createKeychainAdapter(
  stateDir: string,
  masterPassword?: string,
): Promise<KeychainAdapter> {
  const candidates: KeychainAdapter[] = [];

  switch (process.platform) {
    case 'darwin':
      candidates.push(new MacOSKeychainAdapter());
      break;
    case 'linux':
      candidates.push(new LinuxKeychainAdapter());
      break;
    case 'win32':
      candidates.push(new WindowsKeychainAdapter());
      break;
  }

  for (const adapter of candidates) {
    if (await adapter.isAvailable()) {
      return adapter;
    }
  }

  // Fallback to encrypted file vault
  return new FallbackKeychainAdapter(stateDir, masterPassword);
}

export { MacOSKeychainAdapter } from './keychain-macos.js';
export { LinuxKeychainAdapter } from './keychain-linux.js';
export { WindowsKeychainAdapter } from './keychain-windows.js';
export { FallbackKeychainAdapter } from './keychain-fallback.js';
