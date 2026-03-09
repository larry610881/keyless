// Key types
export type KeyType = 'api_key' | 'pat' | 'oauth_token' | 'ssh_key' | 'custom';

// Actor types for audit
export type AuditActor = 'cli' | 'mcp' | 'skill';

// Audit actions
export type AuditAction = 'add' | 'read' | 'use' | 'remove' | 'rotate' | 'export' | 'import';

// Use key target
export type UseKeyTarget = 'env' | 'dotenv' | 'subprocess';

// Key metadata — stored in plaintext index, NEVER contains actual secret values
export interface KeyMeta {
  id: string;                          // nanoid, e.g. "k_a1b2c3d4"
  name: string;                        // human label, e.g. "openai-prod"
  type: KeyType;
  provider: string;                    // "github" | "openai" | "anthropic" | "aws" | custom
  tags: string[];                      // e.g. ["prod", "ci"]
  envVar: string;                      // default env var name, e.g. "OPENAI_API_KEY"
  createdAt: string;                   // ISO 8601
  updatedAt: string;                   // ISO 8601
  expiresAt?: string;                  // ISO 8601, optional
  lastUsedAt?: string;                 // ISO 8601
  rotatedFrom?: string;                // ID of previous version
  masked: string;                      // "sk-...abc3" (first chars + last chars)
  fingerprint: string;                 // SHA-256 hash of the value (for dedup)
  storageBackend: 'keychain' | 'file'; // where the actual value lives
}

// Audit log entry
export interface AuditEntry {
  timestamp: string;                   // ISO 8601
  action: AuditAction;
  keyId: string;
  keyName: string;
  actor: AuditActor;
  target?: string;                     // e.g. ".env", "ENV:OPENAI_API_KEY"
  success: boolean;
  error?: string;
}

// Keychain adapter interface — strategy pattern
export interface KeychainAdapter {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  getSecret(keyId: string): Promise<string | null>;
  setSecret(keyId: string, value: string): Promise<void>;
  deleteSecret(keyId: string): Promise<boolean>;
}

// Store configuration
export interface KeylessConfig {
  stateDir: string;                    // default: ~/.keyless
  preferredBackend: 'keychain' | 'file' | 'auto';
  masterPasswordHash?: string;         // bcrypt hash for file-based fallback
  auditLogEnabled: boolean;
  auditLogMaxEntries: number;          // default: 10000
  createdAt: string;
  version: number;
}

// Use key options
export interface UseKeyOptions {
  keyId?: string;
  keyName?: string;
  envVar?: string;                     // override the stored envVar
  target: UseKeyTarget;
  dotenvPath?: string;                 // default: .env
  command?: string[];                  // for subprocess injection
}

// Encrypted entry in vault.enc
export interface EncryptedEntry {
  iv: string;       // hex
  ciphertext: string; // hex
  tag: string;      // hex
}

// Vault file structure
export interface VaultData {
  version: number;
  salt: string;      // hex
  entries: Record<string, EncryptedEntry>;
}

// Index file structure
export interface IndexData {
  version: number;
  keys: KeyMeta[];
}

// Key filter for list operations
export interface KeyFilter {
  provider?: string;
  type?: KeyType;
  tags?: string[];
  expired?: boolean;
}

// Result of use_key operation
export interface UseKeyResult {
  envVar: string;
  injected: boolean;
  target: UseKeyTarget;
  exitCode?: number;  // for subprocess target
}
