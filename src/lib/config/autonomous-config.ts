import fs from 'fs'
import { getConfigPath } from './paths'

const CONFIG_FILE = 'autonomous-config.json'

export interface AutonomousConfig {
  enabled: boolean
  autoApproveDelegations: boolean
  autoExecuteOnApproval: boolean
  riskThreshold: 'low' | 'medium' | 'high'
  lastEnabledAt?: string
  lastDisabledAt?: string
}

const DEFAULT_CONFIG: AutonomousConfig = {
  enabled: false,
  autoApproveDelegations: false,
  autoExecuteOnApproval: true,
  riskThreshold: 'low',
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
 * Maps a riskClass ('A' | 'B' | 'C') to the threshold level used in AutonomousConfig.
 * 'low'    → only riskClass 'A' (additive/safe) may be auto-approved
 * 'medium' → riskClass 'A' and 'B' may be auto-approved
 * 'high'   → riskClass 'A', 'B' (never 'C' — hard invariant)
 */
export function riskClassFitsThreshold(
  riskClass: string,
  threshold: AutonomousConfig['riskThreshold'],
): boolean {
  if (riskClass === 'C') return false // hard invariant: C always needs manual approval
  if (riskClass === 'A') return true  // A is always safe enough
  if (riskClass === 'B') return threshold === 'medium' || threshold === 'high'
  return false
}
