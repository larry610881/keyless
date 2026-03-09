import { describe, it, expect } from 'vitest';
import { sanitizeText, sanitizeToolResponse } from './guards.js';

describe('sanitizeText', () => {
  it('should redact OpenAI keys (sk-proj-)', () => {
    const input = 'Key is sk-proj-abcdefghij1234567890abcdefghij ok?';
    const { text, redacted } = sanitizeText(input);
    expect(redacted).toBe(true);
    expect(text).toBe('Key is [REDACTED by keyless] ok?');
    expect(text).not.toContain('sk-proj-');
  });

  it('should redact OpenAI keys (sk-)', () => {
    const input = 'Key: sk-abcdefghij1234567890abcdefghij';
    const { text, redacted } = sanitizeText(input);
    expect(redacted).toBe(true);
    expect(text).not.toContain('sk-abcdefghij');
  });

  it('should redact Anthropic keys (sk-ant-)', () => {
    const input = 'sk-ant-api03-abcdefghij1234567890abcdefghij';
    const { text, redacted } = sanitizeText(input);
    expect(redacted).toBe(true);
    expect(text).toBe('[REDACTED by keyless]');
  });

  it('should redact GitHub PATs (ghp_)', () => {
    const input = 'token=ghp_abcdefghijklmnopqrstuvwxyz1234567890';
    const { text, redacted } = sanitizeText(input);
    expect(redacted).toBe(true);
    expect(text).not.toContain('ghp_');
  });

  it('should redact GitHub OAuth tokens (gho_)', () => {
    const input = 'gho_abcdefghijklmnopqrstuvwxyz1234567890';
    const { text, redacted } = sanitizeText(input);
    expect(redacted).toBe(true);
    expect(text).toBe('[REDACTED by keyless]');
  });

  it('should redact GitHub fine-grained PATs (github_pat_)', () => {
    const input = 'github_pat_abcdefghijklmnopqrstuvwxyz';
    const { text, redacted } = sanitizeText(input);
    expect(redacted).toBe(true);
    expect(text).toBe('[REDACTED by keyless]');
  });

  it('should redact GitLab PATs (glpat-)', () => {
    const input = 'glpat-abcdefghij1234567890';
    const { text, redacted } = sanitizeText(input);
    expect(redacted).toBe(true);
    expect(text).toBe('[REDACTED by keyless]');
  });

  it('should redact AWS access key IDs (AKIA)', () => {
    const input = 'aws_key=AKIAIOSFODNN7EXAMPLE';
    const { text, redacted } = sanitizeText(input);
    expect(redacted).toBe(true);
    expect(text).not.toContain('AKIA');
  });

  it('should redact Vercel tokens', () => {
    const input = 'vercel_abcdefghijklmnopqrstuvwx';
    const { text, redacted } = sanitizeText(input);
    expect(redacted).toBe(true);
    expect(text).toBe('[REDACTED by keyless]');
  });

  it('should redact HuggingFace tokens (hf_)', () => {
    const input = 'hf_abcdefghijklmnopqrstuvwxyz12345678';
    const { text, redacted } = sanitizeText(input);
    expect(redacted).toBe(true);
    expect(text).toBe('[REDACTED by keyless]');
  });

  it('should redact xAI keys (xai-)', () => {
    const input = 'xai-abcdefghij1234567890abcdefghij';
    const { text, redacted } = sanitizeText(input);
    expect(redacted).toBe(true);
    expect(text).toBe('[REDACTED by keyless]');
  });

  it('should redact Groq keys (gsk_)', () => {
    const input = 'gsk_abcdefghij1234567890abcdefghij';
    const { text, redacted } = sanitizeText(input);
    expect(redacted).toBe(true);
    expect(text).toBe('[REDACTED by keyless]');
  });

  it('should pass normal text through unchanged', () => {
    const input = 'This is just a normal response with no secrets.';
    const { text, redacted } = sanitizeText(input);
    expect(redacted).toBe(false);
    expect(text).toBe(input);
  });

  it('should handle text with short prefixes that do not match', () => {
    const input = 'sk-short or ghp_short';
    const { text, redacted } = sanitizeText(input);
    expect(redacted).toBe(false);
    expect(text).toBe(input);
  });

  it('should redact multiple keys in the same text', () => {
    const input = [
      'OPENAI_API_KEY=sk-proj-abcdefghij1234567890abcdefghij',
      'GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz1234567890',
      'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE',
    ].join('\n');
    const { text, redacted } = sanitizeText(input);
    expect(redacted).toBe(true);
    expect(text).not.toContain('sk-proj-');
    expect(text).not.toContain('ghp_');
    expect(text).not.toContain('AKIA');
    expect((text.match(/\[REDACTED by keyless\]/g) ?? []).length).toBe(3);
  });

  it('should handle empty string', () => {
    const { text, redacted } = sanitizeText('');
    expect(redacted).toBe(false);
    expect(text).toBe('');
  });
});

describe('sanitizeToolResponse', () => {
  it('should sanitize text items in response content', () => {
    const content = [
      { type: 'text', text: 'Key is sk-proj-abcdefghij1234567890abcdefghij' },
    ];
    const result = sanitizeToolResponse(content);
    expect(result[0].text).not.toContain('sk-proj-');
    expect(result[0].text).toContain('[REDACTED by keyless]');
  });

  it('should leave non-text items unchanged', () => {
    const content = [
      { type: 'image', text: undefined },
    ];
    const result = sanitizeToolResponse(content);
    expect(result[0]).toEqual(content[0]);
  });

  it('should handle mixed content', () => {
    const content = [
      { type: 'text', text: 'Safe text' },
      { type: 'text', text: 'ghp_abcdefghijklmnopqrstuvwxyz1234567890' },
    ];
    const result = sanitizeToolResponse(content);
    expect(result[0].text).toBe('Safe text');
    expect(result[1].text).not.toContain('ghp_');
  });
});
