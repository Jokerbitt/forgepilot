import fs from 'fs'
import { getConfigPath } from './paths'

const CONFIG_FILE = 'autonomous-config.json'

export interface AutonomousConfig {
  enabled: boolean
  autoApproveDelegations: boolean
  autoExecuteOnApproval: boolean
  /** 'all' = vollständig autonom, keine Ausnahmen — user choice */
  riskThreshold: 'low' | 'medium' | 'high' | 'all'
  lastEnabledAt?: string
  lastDisabledAt?: string
}

const DEFAULT_CONFIG: AutonomousConfig = {
  enabled: false,
  autoApproveDelegations: true,
  autoExecuteOnApproval: true,
  riskThreshold: 'all',
}

function getFilePath(): string {
  return getConfigPath(CONFIG_FILE)
}

export function getAutonomousConfig(): AutonomousConfig {
  try {
    const raw = fs.readFileSync(getFilePath(), 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ...DEFAULT_CONFIG, ...(parsed as Partial<AutonomousConfig>) }
    }
  } catch {
    // file missing or invalid — return defaults
  }
  return { ...DEFAULT_CONFIG }
}

export function saveAutonomousConfig(update: Partial<AutonomousConfig>): AutonomousConfig {
  const current = getAutonomousConfig()
  const now = new Date().toISOString()

  const timestamps: Pick<AutonomousConfig, 'lastEnabledAt' | 'lastDisabledAt'> = {}
  if (update.enabled === true && !current.enabled) {
    timestamps.lastEnabledAt = now
  } else if (update.enabled === false && current.enabled) {
    timestamps.lastDisabledAt = now
  }

  const next: AutonomousConfig = { ...current, ...update, ...timestamps }

  const filePath = getFilePath()
  const dir = filePath.substring(0, filePath.lastIndexOf('/'))
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const tmp = `${filePath}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf-8')
  fs.renameSync(tmp, filePath)

  return next
}

/**
 * Returns true when a delegation's riskClass may be auto-approved given the threshold.
 *
 * 'all'    → every riskClass passes (user has explicitly chosen full autonomy)
 * 'high'   → A and B; C requires manual approval
 * 'medium' → A and B; C requires manual approval
 * 'low'    → only A
 *
 * When threshold is 'all' the user has consciously opted into full autonomy —
 * no hard invariant is imposed by the system.
 */
export function riskClassFitsThreshold(
  riskClass: string,
  threshold: AutonomousConfig['riskThreshold'],
): boolean {
  if (threshold === 'all') return true   // user chose full autonomy — no exceptions
  if (riskClass === 'A') return true     // A is always safe enough
  if (riskClass === 'B') return threshold === 'medium' || threshold === 'high'
  return false                           // riskClass C: only 'all' unlocks it (handled above)
}
