import fs from 'fs'
import path from 'path'
import { createHash } from 'crypto'

export const ROTATION_THRESHOLD_DAYS = 90

export interface ApiKeyMeta {
  setAt: string
  keyHint?: string
}

export type ApiKeysMeta = Record<string, ApiKeyMeta>

export interface KeyRotationStatus {
  keyName: string
  setAt: string
  ageDays: number
  isStale: boolean
}

const META_FILE = path.join(process.cwd(), 'config', 'api-keys-meta.json')

export function readApiKeysMeta(): ApiKeysMeta {
  try {
    return JSON.parse(fs.readFileSync(META_FILE, 'utf-8')) as ApiKeysMeta
  } catch {
    return {}
  }
}

function writeApiKeysMeta(meta: ApiKeysMeta): void {
  const dir = path.dirname(META_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = `${META_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(meta, null, 2), 'utf-8')
  fs.renameSync(tmp, META_FILE)
}

/** Record that a key was set right now; stores last-4 hint for UI display. */
export function recordKeySet(keyName: string, value: string): void {
  const meta = readApiKeysMeta()
  const keyHint = value.length >= 4 ? value.slice(-4) : undefined
  meta[keyName] = { setAt: new Date().toISOString(), keyHint }
  writeApiKeysMeta(meta)
}

/** Remove meta entry when a key is cleared/deleted. */
export function removeKeyMeta(keyName: string): void {
  const meta = readApiKeysMeta()
  if (keyName in meta) {
    delete meta[keyName]
    writeApiKeysMeta(meta)
  }
}

/** Returns the age in full days for a given ISO timestamp. */
export function getKeyAgeDays(setAt: string): number {
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.floor((Date.now() - new Date(setAt).getTime()) / msPerDay)
}

/** Returns rotation status for every key that has metadata. */
export function getRotationStatuses(
  meta: ApiKeysMeta,
  thresholdDays: number = ROTATION_THRESHOLD_DAYS,
): KeyRotationStatus[] {
  return Object.entries(meta).map(([keyName, { setAt }]) => {
    const ageDays = getKeyAgeDays(setAt)
    return { keyName, setAt, ageDays, isStale: ageDays >= thresholdDays }
  })
}

/** Returns true if at least one tracked key is older than thresholdDays. */
export function hasStaleKeys(
  meta: ApiKeysMeta,
  thresholdDays: number = ROTATION_THRESHOLD_DAYS,
): boolean {
  return getRotationStatuses(meta, thresholdDays).some(s => s.isStale)
}

/** Stable key hint derived from value — avoids storing the actual key. */
export function keyHint(value: string): string {
  if (value.length < 4) return '****'
  return (
    '*'.repeat(Math.min(value.length - 4, 20)) +
    createHash('sha256').update(value).digest('hex').slice(0, 4)
  )
}
