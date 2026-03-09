# Security Model

## Overview

keyless is built around a single invariant: **API key values never reach the LLM**. Every design decision flows from this principle. Keys are stored in the OS keychain or an encrypted vault, exposed through MCP tools that return only metadata, and protected by a response guard that redacts any key patterns that slip through.

## Threat Model

| Threat | Mitigation | Status |
|---|---|---|
| LLM sees key value in tool response | Tool responses NEVER contain raw values. `list_keys` returns masked values only. `use_key` injects directly to target. | Active |
| Key value persists in conversation | `add_key` and `rotate_key` responses instruct LLM to forget the raw value immediately | Active |
| Key value in `.env` read by LLM | `.env` should be in `.gitignore`; use `use_key` to write on demand rather than persisting | Guidance |
| Audit log leaks values | Audit log stores only key IDs, key names, action types, and timestamps | Active |
| Disk-based vault theft | AES-256-GCM encryption with PBKDF2 key derivation (100K iterations, SHA-512) | Active |
| Pattern detection bypass | `guards.ts` regex patterns for 12 known provider key formats | Active |
| Master password brute force | PBKDF2 with 100K iterations; OS keychain preferred over file vault | Active |
| Unauthorized key deletion | `remove_key` requires explicit `confirm=true` parameter | Active |
| Index file tampering | Index contains only metadata, never secret values; stored with mode `0600` | Active |

## Defense in Depth

keyless uses five layers of defense, any one of which prevents key leakage:

### 1. Tool Design

MCP tools are designed so key values never appear in responses:

- `list_keys` returns metadata: name, provider, type, masked value (`sk-...abc3`)
- `use_key` injects the key directly into the environment or `.env` file and responds only with confirmation
- `add_key` and `rotate_key` encrypt the value immediately and return only metadata
- No tool exists that returns a raw key value

### 2. Response Guard

All MCP tool responses pass through `sanitizeToolResponse()` in `guards.ts`, which scans output text against 12 known API key regex patterns:

- OpenAI (`sk-proj-...`, `sk-...`)
- Anthropic (`sk-ant-...`)
- GitHub (`ghp_...`, `gho_...`, `github_pat_...`)
- GitLab (`glpat-...`)
- AWS (`AKIA...`)
- Vercel (`vercel_...`)
- Hugging Face (`hf_...`)
- xAI (`xai-...`)
- Groq (`gsk_...`)

Any match is replaced with `[REDACTED by keyless]`.

### 3. Storage Encryption

- **OS Keychain (preferred)**: Keys are stored in macOS Keychain, Linux libsecret, or Windows Credential Manager. Access is controlled by the OS.
- **File Vault (fallback)**: When no keychain is available, keys are encrypted with AES-256-GCM. The encryption key is derived from a master password using PBKDF2 (100K iterations, SHA-512, 32-byte salt).

### 4. Audit Trail

Every key operation is logged to `audit.jsonl`:

```json
{
  "timestamp": "2026-03-09T12:00:00.000Z",
  "action": "use",
  "keyId": "k_a1b2c3d4",
  "keyName": "openai-prod",
  "actor": "mcp",
  "target": ".env",
  "success": true
}
```

The audit log never records key values — only IDs, names, actions, targets, and success status. Maximum entries default to 10,000.

### 5. Key Hygiene

- Provider auto-detection sets sensible defaults for env var names
- Expiry tracking alerts you before keys become stale
- Key rotation overwrites the old value in place
- SHA-256 fingerprinting prevents storing duplicate keys

## Known Limitations

1. **`add_key` paradox**: The LLM must pass the key value to the `add_key` MCP tool — this is an inherent MCP limitation. The value appears in the tool call arguments, which are visible in the MCP transport. For maximum security, use the CLI (`keyless add`) instead of the MCP tool.

2. **Pattern-based detection**: The response guard uses regex patterns for known provider key formats. Custom or unusual key formats may not be detected. The guard is a safety net, not the primary defense — the primary defense is that tools never include values in responses.

3. **File vault strength**: The file-based fallback encryption is only as strong as the master password chosen by the user. A weak password makes the vault vulnerable to brute force. The OS keychain is strongly preferred.

4. **In-memory exposure**: While a key is being injected (the brief moment between reading from the keychain and writing to the target), the value exists in process memory. This is an inherent limitation of any secret management tool.

5. **`.env` file persistence**: When `use_key` writes to a `.env` file, the key value persists on disk in plaintext. The `.env` file should be in `.gitignore` and have restrictive permissions.

## Responsible Disclosure

If you discover a security vulnerability in keyless, please report it responsibly:

1. **Do not** open a public GitHub issue for security vulnerabilities
2. Email the maintainers with a description of the vulnerability
3. Include steps to reproduce if possible
4. Allow reasonable time for a fix before public disclosure

We take all security reports seriously and will respond promptly.
