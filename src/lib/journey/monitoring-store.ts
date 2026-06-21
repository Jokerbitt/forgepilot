/**
 * Journey Companion — Phase 4.3: monitoring history store.
 *
 * Persists the latest operations snapshot per app URL so repeated checks can
 * track consecutive failures (a real outage vs. a one-off blip). Atomic writes
 * (.tmp → rename), mirroring the AI provider health monitor. The file path is
 * injectable so the logic stays unit-testable against a temp dir.
 */
import fs from 'fs'
import path from 'path'
import type { OpsStatus } from './monitoring'

export interface MonitoringSnapshot {
  appUrl: string
  status: OpsStatus
  okCount: number
  total: number
  avgLatencyMs: number
  consecutiveFailures: number
  checkedAt: string
}

const DEFAULT_FILE = path.join(process.cwd(), 'config', 'app-monitoring.json')

/** Read the full per-URL snapshot map (empty when the file is missing/corrupt). */
export function readMonitoringHistory(file: string = DEFAULT_FILE): Record<string, MonitoringSnapshot> {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, MonitoringSnapshot>
  } catch {
    return {}
  }
}

/** Last snapshot for a single app URL, or undefined if never checked. */
export function getSnapshot(appUrl: string, file: string = DEFAULT_FILE): MonitoringSnapshot | undefined {
  return readMonitoringHistory(file)[appUrl]
}

/** Upsert a snapshot for its app URL and persist atomically. */
export function recordSnapshot(
  snapshot: MonitoringSnapshot,
  file: string = DEFAULT_FILE,
): Record<string, MonitoringSnapshot> {
  const history = readMonitoringHistory(file)
  history[snapshot.appUrl] = snapshot
  const dir = path.dirname(file)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(history, null, 2), 'utf-8')
  fs.renameSync(tmp, file)
  return history
}
