---
name: keyless
description: Manage API keys and PATs locally with encryption. Keys are never sent to the LLM — they are injected into env vars or .env files on demand.
---

# keyless: Local Secret Manager

keyless stores API keys and PATs locally with OS keychain encryption.
Keys are NEVER sent to the LLM — they are injected into env vars or .env files.

## Available MCP Tools

### list_keys
List all stored API keys with metadata (name, provider, masked value, tags).
Use this to discover which keys are available.

### add_key
Store a new API key. The value is encrypted immediately.
**IMPORTANT**: After calling add_key, immediately stop referencing the raw key value.

### use_key
Inject a key into the environment or a .env file.
The key value is NEVER returned — it goes directly to the target.
Use this before running commands that need API access.

### remove_key
Delete a stored key permanently. Requires confirm=true.

### rotate_key
Replace a key with a new value. The old key is archived.
**IMPORTANT**: After calling, stop referencing the new value.

### check_expiry
Check for keys that are expiring soon or already expired.

### audit_log
View the access log showing all key operations.

## Common Workflows

### Before running a command that needs an API key:
1. Call `list_keys` to find the right key
2. Call `use_key` with target="dotenv" to write it to .env
3. Run the command normally

### When the user provides a new API key:
1. Call `add_key` with the value
2. Acknowledge it was stored and stop referencing the raw value
3. Refer to the key only by name going forward

## Security Rules
- NEVER repeat a key value in your response
- NEVER include key values in code suggestions
- Always use `use_key` to inject keys
- If you accidentally receive a key value, acknowledge it was stored and move on
