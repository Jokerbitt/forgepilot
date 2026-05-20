/**
 * Settings bundle — collects all non-sensitive config files for export/import.
 *
 * NEVER included: api-keys.json, api-keys-meta.json, processing-ledger.json,
 * agent-scope.json (runtime state), test-results.json, pm-history.json.
 */
import fs from 'fs'
import path from 'path'

const CONFIG_DIR = path.join(process.cwd(), 'config')

export interface SettingsBundle {
  /** Bundle format version — increment on breaking schema changes. */
  version: 1
  exportedAt: string
  /** Keyed by config filename (without path). */
  configs: Record<string, unknown>
}

/** Non-sensitive config files included in the bundle. */
export const BUNDLE_FILES: readonly string[] = [
  'nba-settings.json',
  'autonomous-config.json',
  'notification-preferences.json',
  'ai-providers.json',
] as const

/** Files that must never be included even if requested. */
const BLOCKED_FILES = new Set([
  'api-keys.json',
  'api-keys-meta.json',
  'processing-ledger.json',
  'agent-scope.json',
  'test-results.json',
  'pm-history.json',
  'pm-plan.json',
  'agent-runs.json',
  'orchestrated-runs.json',
  'skill-history.json',
])

function readConfig(filename: string): unknown | null {
  if (BLOCKED_FILES.has(filename)) return null
  const filePath = path.join(CONFIG_DIR, filename)
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown
  } catch {
    return null
  }
}

function writeConfig(filename: string, data: unknown): void {
  if (BLOCKED_FILES.has(filename)) return
  const filePath = path.join(CONFIG_DIR, filename)
  const tmp = `${filePath}.tmp`
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8')
  fs.renameSync(tmp, filePath)
}

/** Build a bundle from all BUNDLE_FILES that currently exist. */
export function exportSettingsBundle(): SettingsBundle {
  const configs: Record<string, unknown> = {}
  for (const filename of BUNDLE_FILES) {
    const content = readConfig(filename)
    if (content !== null) {
      configs[filename] = content
    }
  }
  return { version: 1, exportedAt: new Date().toISOString(), configs }
}

export interface ImportResult {
  imported: string[]
  skipped: string[]
  errors: string[]
}

/**
 * Apply a settings bundle — only writes allowed BUNDLE_FILES, ignores the
 * rest silently. Returns a summary of what was written/skipped/failed.
 */
export function importSettingsBundle(bundle: SettingsBundle): ImportResult {
  const result: ImportResult = { imported: [], skipped: [], errors: [] }

  if (bundle.version !== 1) {
    result.errors.push(`Unsupported bundle version: ${bundle.version}`)
    return result
  }

  for (const [filename, data] of Object.entries(bundle.configs)) {
    if (BLOCKED_FILES.has(filename)) {
      result.skipped.push(filename)
      continue
    }
    if (!(BUNDLE_FILES as readonly string[]).includes(filename)) {
      result.skipped.push(filename)
      continue
    }
    try {
      writeConfig(filename, data)
      result.imported.push(filename)
    } catch (err) {
      result.errors.push(`${filename}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return result
}
