import type { KeyType } from './types.js';

export const VERSION = '0.1.0';

export const DEFAULT_STATE_DIR = '~/.keyless';
export const INDEX_FILENAME = 'index.json';
export const VAULT_FILENAME = 'vault.enc';
export const AUDIT_FILENAME = 'audit.jsonl';
export const CONFIG_FILENAME = 'config.json';

export const DEFAULT_AUDIT_MAX_ENTRIES = 10000;
export const PBKDF2_ITERATIONS = 100_000;
export const PBKDF2_DIGEST = 'sha512';
export const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
export const KEY_LENGTH = 32;
export const IV_LENGTH = 16;
export const SALT_LENGTH = 32;
export const AUTH_TAG_LENGTH = 16;

export const KEY_ID_PREFIX = 'k_';
export const KEY_ID_LENGTH = 12;

// Provider auto-detection: pattern -> { provider, envVar, type }
export interface ProviderInfo {
  pattern: RegExp;
  provider: string;
  envVar: string;
  type: KeyType;
}

export const PROVIDER_MAP: ProviderInfo[] = [
  { pattern: /^sk-proj-[a-zA-Z0-9]{20,}/, provider: 'openai', envVar: 'OPENAI_API_KEY', type: 'api_key' },
  { pattern: /^sk-[a-zA-Z0-9]{20,}/, provider: 'openai', envVar: 'OPENAI_API_KEY', type: 'api_key' },
  { pattern: /^sk-ant-[a-zA-Z0-9_-]{20,}/, provider: 'anthropic', envVar: 'ANTHROPIC_API_KEY', type: 'api_key' },
  { pattern: /^ghp_[a-zA-Z0-9]{36}/, provider: 'github', envVar: 'GITHUB_TOKEN', type: 'pat' },
  { pattern: /^gho_[a-zA-Z0-9]{36}/, provider: 'github', envVar: 'GITHUB_TOKEN', type: 'oauth_token' },
  { pattern: /^github_pat_[a-zA-Z0-9_]{22,}/, provider: 'github', envVar: 'GITHUB_TOKEN', type: 'pat' },
  { pattern: /^glpat-[a-zA-Z0-9_-]{20}/, provider: 'gitlab', envVar: 'GITLAB_TOKEN', type: 'pat' },
  { pattern: /^AKIA[0-9A-Z]{16}/, provider: 'aws', envVar: 'AWS_ACCESS_KEY_ID', type: 'api_key' },
  { pattern: /^vercel_[a-zA-Z0-9]{24}/, provider: 'vercel', envVar: 'VERCEL_TOKEN', type: 'api_key' },
  { pattern: /^hf_[a-zA-Z0-9]{34}/, provider: 'huggingface', envVar: 'HF_TOKEN', type: 'api_key' },
  { pattern: /^xai-[a-zA-Z0-9]{20,}/, provider: 'xai', envVar: 'XAI_API_KEY', type: 'api_key' },
  { pattern: /^gsk_[a-zA-Z0-9]{20,}/, provider: 'groq', envVar: 'GROQ_API_KEY', type: 'api_key' },
];

// Patterns used by guards.ts to detect key leakage in responses
export const KEY_LEAK_PATTERNS: RegExp[] = [
  /sk-proj-[a-zA-Z0-9]{20,}/,
  /sk-[a-zA-Z0-9]{20,}/,
  /sk-ant-[a-zA-Z0-9_-]{20,}/,
  /ghp_[a-zA-Z0-9]{36}/,
  /gho_[a-zA-Z0-9]{36}/,
  /github_pat_[a-zA-Z0-9_]{22,}/,
  /glpat-[a-zA-Z0-9_-]{20}/,
  /AKIA[0-9A-Z]{16}/,
  /vercel_[a-zA-Z0-9]{24}/,
  /hf_[a-zA-Z0-9]{34}/,
  /xai-[a-zA-Z0-9]{20,}/,
  /gsk_[a-zA-Z0-9]{20,}/,
];

// Auto-detect provider from key value
export function detectProvider(value: string): { provider: string; envVar: string; type: KeyType } | null {
  for (const info of PROVIDER_MAP) {
    if (info.pattern.test(value)) {
      return { provider: info.provider, envVar: info.envVar, type: info.type };
    }
  }
  return null;
}
