import { readFile, writeFile, appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { AuditEntry, AuditAction, AuditActor } from '../types.js';
import { AUDIT_FILENAME } from '../constants.js';

export interface AuditFilter {
  keyId?: string;
  keyName?: string;
  action?: AuditAction;
  actor?: AuditActor;
  since?: string;   // ISO 8601
  until?: string;   // ISO 8601
  success?: boolean;
}

export class AuditLogger {
  private readonly stateDir: string;
  private readonly logPath: string;
  private readonly maxEntries: number;

  constructor(stateDir: string, maxEntries: number) {
    this.stateDir = stateDir;
    this.logPath = join(stateDir, AUDIT_FILENAME);
    this.maxEntries = maxEntries;
  }

  async log(entry: AuditEntry): Promise<void> {
    await mkdir(this.stateDir, { recursive: true });
    const line = JSON.stringify(entry) + '\n';
    await appendFile(this.logPath, line, { mode: 0o600 });
  }

  async query(filter?: AuditFilter): Promise<AuditEntry[]> {
    let lines: string[];
    try {
      const raw = await readFile(this.logPath, 'utf8');
      lines = raw.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }

    let entries = lines.map(line => JSON.parse(line) as AuditEntry);

    if (filter) {
      if (filter.keyId) {
        entries = entries.filter(e => e.keyId === filter.keyId);
      }
      if (filter.keyName) {
        entries = entries.filter(e => e.keyName === filter.keyName);
      }
      if (filter.action) {
        entries = entries.filter(e => e.action === filter.action);
      }
      if (filter.actor) {
        entries = entries.filter(e => e.actor === filter.actor);
      }
      if (filter.since) {
        const since = new Date(filter.since).getTime();
        entries = entries.filter(e => new Date(e.timestamp).getTime() >= since);
      }
      if (filter.until) {
        const until = new Date(filter.until).getTime();
        entries = entries.filter(e => new Date(e.timestamp).getTime() <= until);
      }
      if (filter.success !== undefined) {
        entries = entries.filter(e => e.success === filter.success);
      }
    }

    return entries;
  }

  async prune(keepDays: number): Promise<number> {
    const cutoff = Date.now() - keepDays * 86_400_000;
    let lines: string[];
    try {
      const raw = await readFile(this.logPath, 'utf8');
      lines = raw.trim().split('\n').filter(Boolean);
    } catch {
      return 0;
    }

    const kept: string[] = [];
    let pruned = 0;

    for (const line of lines) {
      const entry = JSON.parse(line) as AuditEntry;
      if (new Date(entry.timestamp).getTime() >= cutoff) {
        kept.push(line);
      } else {
        pruned++;
      }
    }

    // Also enforce maxEntries
    while (kept.length > this.maxEntries) {
      kept.shift();
      pruned++;
    }

    await mkdir(this.stateDir, { recursive: true });
    await writeFile(this.logPath, kept.join('\n') + (kept.length ? '\n' : ''), { mode: 0o600 });

    return pruned;
  }
}
