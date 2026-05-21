/**
 * Config Backup Routine — M161
 *
 * Backs up all `config/*.json` files to `config/backups/YYYY-MM-DD/`.
 * Designed to be called manually, via API, or via Vercel Cron.
 *
 * Strategy:
 * - One backup per day max (idempotent — re-run safe)
 * - Excludes `config/backups/` itself (no recursive backup)
 * - Files named after their original basename
 * - Rotation: keeps last N days (default: 7)
 */

import fs from 'fs'
import path from 'path'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BackupEntry {
  date: string           // YYYY-MM-DD
  files: string[]        // basenames of backed-up files
  sizeBytes: number      // total size of backup dir
  createdAt: string      // ISO timestamp
}

export interface BackupListResult {
  backups: BackupEntry[]
  totalBackups: number
  oldestDate: string | null
  newestDate: string | null
}

export interface BackupResult {
  date: string
  filesBackedUp: string[]
  filesSkipped: string[]
  backupDir: string
  sizeBytes: number
  alreadyExisted: boolean
}

// ── Config ────────────────────────────────────────────────────────────────────

const CONFIG_DIR    = path.join(process.cwd(), 'config')
const BACKUPS_DIR   = path.join(CONFIG_DIR, 'backups')
const MAX_BACKUPS   = 7   // keep last 7 days

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateString(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function dirSizeBytes(dir: string): number {
  if (!fs.existsSync(dir)) return 0
  return fs.readdirSync(dir).reduce((sum, name) => {
    try {
      return sum + fs.statSync(path.join(dir, name)).size
    } catch {
      return sum
    }
  }, 0)
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run a config backup for today's date.
 * If a backup already exists for today, returns the existing backup info.
 */
export function runBackup(now = new Date()): BackupResult {
  const date = toDateString(now)
  const backupDir = path.join(BACKUPS_DIR, date)

  ensureDir(BACKUPS_DIR)

  const alreadyExisted = fs.existsSync(backupDir)
  if (!alreadyExisted) {
    ensureDir(backupDir)
  }

  // List all JSON files in config/ (excluding backups/ subdirectory)
  const allFiles = fs.readdirSync(CONFIG_DIR).filter(name => {
    if (!name.endsWith('.json')) return false
    // Safety: never backup temp files
    if (name.endsWith('.tmp')) return false
    return true
  })

  const filesBackedUp: string[] = []
  const filesSkipped: string[] = []

  for (const name of allFiles) {
    const src = path.join(CONFIG_DIR, name)
    const dst = path.join(backupDir, name)
    try {
      fs.copyFileSync(src, dst)
      filesBackedUp.push(name)
    } catch {
      filesSkipped.push(name)
    }
  }

  // Rotate: remove backups older than MAX_BACKUPS days
  rotateBackups()

  return {
    date,
    filesBackedUp,
    filesSkipped,
    backupDir,
    sizeBytes: dirSizeBytes(backupDir),
    alreadyExisted,
  }
}

/**
 * List all existing backups, newest first.
 */
export function listBackups(): BackupListResult {
  if (!fs.existsSync(BACKUPS_DIR)) {
    return { backups: [], totalBackups: 0, oldestDate: null, newestDate: null }
  }

  const dateDirs = fs.readdirSync(BACKUPS_DIR)
    .filter(name => /^\d{4}-\d{2}-\d{2}$/.test(name))
    .sort()
    .reverse() // newest first

  const backups: BackupEntry[] = dateDirs.map(date => {
    const dir = path.join(BACKUPS_DIR, date)
    let files: string[] = []
    let sizeBytes = 0
    let createdAt = `${date}T00:00:00.000Z`
    try {
      files = fs.readdirSync(dir).filter(f => f.endsWith('.json'))
      sizeBytes = dirSizeBytes(dir)
      const stat = fs.statSync(dir)
      createdAt = stat.birthtime.toISOString()
    } catch { /* ignore */ }
    return { date, files, sizeBytes, createdAt }
  })

  return {
    backups,
    totalBackups: backups.length,
    oldestDate: dateDirs.length > 0 ? dateDirs[dateDirs.length - 1] : null,
    newestDate: dateDirs.length > 0 ? dateDirs[0] : null,
  }
}

/**
 * Restore a specific backup date to the config directory.
 * Existing files are overwritten. Returns list of restored files.
 */
export function restoreBackup(date: string): string[] {
  const backupDir = path.join(BACKUPS_DIR, date)
  if (!fs.existsSync(backupDir)) {
    throw new Error(`Backup not found for date: ${date}`)
  }

  const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json'))
  const restored: string[] = []

  for (const name of files) {
    const src = path.join(backupDir, name)
    const dst = path.join(CONFIG_DIR, name)
    try {
      fs.copyFileSync(src, dst)
      restored.push(name)
    } catch { /* skip unwritable */ }
  }

  return restored
}

// ── Internal ──────────────────────────────────────────────────────────────────

function rotateBackups(): void {
  if (!fs.existsSync(BACKUPS_DIR)) return

  const dateDirs = fs.readdirSync(BACKUPS_DIR)
    .filter(name => /^\d{4}-\d{2}-\d{2}$/.test(name))
    .sort()
    .reverse() // newest first

  // Remove oldest beyond MAX_BACKUPS
  const toRemove = dateDirs.slice(MAX_BACKUPS)
  for (const dir of toRemove) {
    const fullPath = path.join(BACKUPS_DIR, dir)
    try {
      const files = fs.readdirSync(fullPath)
      for (const f of files) fs.unlinkSync(path.join(fullPath, f))
      fs.rmdirSync(fullPath)
    } catch { /* best effort */ }
  }
}
