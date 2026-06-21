// Typed, file-based JSON settings store with atomic writes (.tmp + rename).
// Destination: src/lib/settings/settings-store.ts

import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * A minimal, dependency-free settings store backed by a single JSON file.
 *
 * Writes are atomic: data is written to a temporary sibling file first, then
 * renamed over the target. `rename(2)` is atomic on POSIX filesystems, so a
 * crash mid-write can never leave a half-written settings file.
 *
 * PRODUCTION NOTE: A flat JSON file is fine for single-instance/dev use. For
 * multi-instance deployments or concurrent writers, swap the read/write
 * internals for a database (e.g. a `settings` table or a KV store). The public
 * API (`get` / `update` / `reset`) is intentionally storage-agnostic so callers
 * never need to change.
 */
export interface SettingsStore<T> {
  /** Returns the current settings, falling back to defaults if unset/corrupt. */
  get(): T;
  /** Shallow-merges `partial` into the current settings and persists the result. */
  update(partial: Partial<T>): T;
  /** Resets the store back to the provided defaults and persists them. */
  reset(): T;
}

export function defineSettings<T extends Record<string, unknown>>(
  defaults: T,
  path: string,
): SettingsStore<T> {
  function readFromDisk(): T {
    try {
      const raw = readFileSync(path, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      if (parsed === null || typeof parsed !== 'object') {
        return { ...defaults };
      }
      // Merge over defaults so newly added keys are always present.
      return { ...defaults, ...(parsed as Partial<T>) };
    } catch {
      // Missing file or invalid JSON -> fall back to defaults.
      return { ...defaults };
    }
  }

  function writeToDisk(value: T): void {
    mkdirSync(dirname(path), { recursive: true });
    const tmpPath = `${path}.${randomBytes(6).toString('hex')}.tmp`;
    writeFileSync(tmpPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    renameSync(tmpPath, path);
  }

  return {
    get(): T {
      return readFromDisk();
    },
    update(partial: Partial<T>): T {
      const next = { ...readFromDisk(), ...partial };
      writeToDisk(next);
      return next;
    },
    reset(): T {
      const next = { ...defaults };
      writeToDisk(next);
      return next;
    },
  };
}
