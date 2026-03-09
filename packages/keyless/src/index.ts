// Types
export type {
  KeyType,
  KeyMeta,
  KeylessConfig,
  KeychainAdapter,
  AuditEntry,
  AuditActor,
  AuditAction,
  UseKeyOptions,
  UseKeyTarget,
  UseKeyResult,
  EncryptedEntry,
  VaultData,
  IndexData,
  KeyFilter,
} from './types.js';

// Constants
export {
  VERSION,
  DEFAULT_STATE_DIR,
  PROVIDER_MAP,
  KEY_LEAK_PATTERNS,
  detectProvider,
} from './constants.js';

// Crypto utilities
export {
  encrypt,
  decrypt,
  deriveKey,
  generateSalt,
  fingerprint,
  mask,
} from './core/crypto.js';

// Core store
export { KeyStore } from './core/store.js';

// Audit logger
export { AuditLogger } from './core/audit.js';
export type { AuditFilter } from './core/audit.js';

// Expiry helper
export { checkExpiry } from './core/expiry.js';

// Keychain adapters
export { createKeychainAdapter } from './adapters/keychain.js';
export { FallbackKeychainAdapter } from './adapters/keychain-fallback.js';
