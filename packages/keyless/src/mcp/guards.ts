import { KEY_LEAK_PATTERNS } from '../constants.js';

/**
 * Scan text for known API key patterns and redact them.
 * This is the LAST LINE OF DEFENSE against key leakage to LLMs.
 */
export function sanitizeText(text: string): { text: string; redacted: boolean } {
  let redacted = false;
  let result = text;

  for (const pattern of KEY_LEAK_PATTERNS) {
    const globalPattern = new RegExp(pattern.source, 'g');
    if (globalPattern.test(result)) {
      redacted = true;
      // Reset lastIndex after test()
      const replacePattern = new RegExp(pattern.source, 'g');
      result = result.replace(replacePattern, '[REDACTED by keyless]');
    }
  }

  return { text: result, redacted };
}

/**
 * Wrap MCP tool response content through sanitization
 */
export function sanitizeToolResponse(
  content: Array<{ type: string; text?: string }>,
): Array<{ type: string; text?: string }> {
  return content.map(item => {
    if (item.type === 'text' && item.text) {
      const { text } = sanitizeText(item.text);
      return { ...item, text };
    }
    return item;
  });
}
