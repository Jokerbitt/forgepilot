/**
 * File Lock Registry — LEGACY
 *
 * @deprecated Use `scope-lock.ts` instead. This module is kept as a
 * compatibility shim for existing call sites (and its test). New code
 * should use `claimScope` / `heartbeatScope` / `releaseScope` from
 * `./scope-lock`, plus the `agent-coord.mjs` CLI.
 *
 * Differences vs scope-lock:
 *  - exact file paths only (no glob `**`)
 *  - static 2h timeout (no heartbeat, no pid check)
 *  - no branch-isolation check
 *
 * `generateForbiddenFilesBlock()` below merges BOTH stores so legacy
 * prompts still see modern scope-lock claims.
 */

import fs from 'fs'
import path from 'path'
import { getActiveClaims } from './scope-lock'

const LOCK_FILE = path.join(process.cwd(), 'config', 'agent-file-locks.json')
const STALE_AFTER_MS = 2 * 60 * 60 * 1000 // 2 hours

export interface FileLock {
  agentId: string
  agentName: string
  files: string[]
  branch: string
  lockedAt: string
  taskDescription: string
}

interface LockStore {
  locks: FileLock[]
  lastUpdated: string
}

function readStore(): LockStore {
  try {
    const raw = fs.readFileSync(LOCK_FILE, 'utf-8')
    const data = JSON.parse(raw) as LockStore
    // Auto-clean stale locks
    const now = Date.now()
    data.locks = (data.locks ?? []).filter(
      l => now - new Date(l.lockedAt).getTime() < STALE_AFTER_MS
    )
    return data
  } catch {
    return { locks: [], lastUpdated: new Date().toISOString() }
  }
}

function writeStore(store: LockStore): void {
  const dir = path.dirname(LOCK_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = LOCK_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify({ ...store, lastUpdated: new Date().toISOString() }, null, 2))
  fs.renameSync(tmp, LOCK_FILE)
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').toLowerCase()
}

/** Try to acquire file locks. Returns conflicts if files are already locked. */
export function acquireFileLocks(
  agentId: string,
  agentName: string,
  files: string[],
  branch: string,
  taskDescription: string,
): { success: boolean; conflicts: FileLock[] } {
  const store = readStore()
  const normalizedNew = files.map(normalizePath)

  const conflicts = store.locks.filter(lock =>
    lock.files.some(f => normalizedNew.includes(normalizePath(f)))
  )

  if (conflicts.length > 0) {
    return { success: false, conflicts }
  }

  store.locks.push({ agentId, agentName, files, branch, lockedAt: new Date().toISOString(), taskDescription })
  writeStore(store)
  return { success: true, conflicts: [] }
}

/** Release all locks held by an agent. */
export function releaseFileLocks(agentId: string): void {
  const store = readStore()
  store.locks = store.locks.filter(l => l.agentId !== agentId)
  writeStore(store)
}

/** Get all currently active locks. */
export function getActiveLocks(): FileLock[] {
  return readStore().locks
}

/** Check which locks conflict with the given file list. */
export function checkConflicts(files: string[]): FileLock[] {
  const store = readStore()
  const normalized = files.map(normalizePath)
  return store.locks.filter(lock =>
    lock.files.some(f => normalized.includes(normalizePath(f)))
  )
}

/** Remove stale locks older than maxAgeHours. Returns count removed. */
export function cleanStaleLocks(maxAgeHours = 2): number {
  const store = readStore()
  const before = store.locks.length
  const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000
  store.locks = store.locks.filter(l => new Date(l.lockedAt).getTime() > cutoff)
  writeStore(store)
  return before - store.locks.length
}

/**
 * Generate a "FORBIDDEN FILES" block for agent prompts.
 * Reads BOTH the legacy lock store and the modern `scope-lock` claims so
 * old prompts surface conflicts written by either system.
 */
export function generateForbiddenFilesBlock(): string {
  const lines: string[] = []

  for (const l of getActiveLocks()) {
    const ageMin = Math.round((Date.now() - new Date(l.lockedAt).getTime()) / 60000)
    const remaining = Math.max(0, 120 - ageMin)
    for (const f of l.files) {
      lines.push(`  - ${f}  (legacy lock — ${l.agentName}, ~${remaining}min remaining)`)
    }
  }

  for (const c of getActiveClaims()) {
    const expiresIn = Math.max(0, Math.round((new Date(c.expiresAt).getTime() - Date.now()) / 60000))
    for (const pattern of c.filePatterns) {
      lines.push(`  - ${pattern}  (scope-lock — ${c.agentId} on ${c.branch}, ~${expiresIn}min remaining)`)
    }
  }

  if (lines.length === 0) return ''

  return [
    '⚠️  LOCKED FILES — do NOT edit these (another agent is working on them):',
    ...lines,
    '',
    'Editing locked files will cause merge conflicts. Skip them or wait.',
  ].join('\n')
}
