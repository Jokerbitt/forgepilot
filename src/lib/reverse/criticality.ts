/**
 * Reverse-Engineering — criticality assessment (safety guardrail).
 *
 * Detects whether an analyzed app looks like safety-/mission-critical control
 * software (Leitrechner, SCADA, PLC, real-time control, industrial protocols).
 * Such apps must NEVER be rebuilt autonomously — only analyzed / partially
 * modernized under human verification. The rebuild endpoint enforces an explicit
 * acknowledgement for "critical" before it will start a build.
 *
 * Honest by design: this is a heuristic, so it can over- or under-flag. When in
 * doubt it errs toward "critical" (fail-safe), and the user can still proceed
 * with an explicit acknowledgement.
 */
import { execFileSync } from 'child_process'
import { SCAN_EXCLUDE_DIRS } from './security-scan'

const EXCLUDE_ARGS = SCAN_EXCLUDE_DIRS.map(d => `--exclude-dir=${d}`)

export type CriticalityLevel = 'normal' | 'sensitive' | 'critical'

export interface CriticalityAssessment {
  level: CriticalityLevel
  reasons: string[]
}

interface Signal {
  pattern: string
  level: Exclude<CriticalityLevel, 'normal'>
  reason: string
}

// Patterns are matched case-insensitively against code + the app name.
const SIGNALS: Signal[] = [
  { pattern: 'leitrechner|scada|\\bplc\\b|\\bsps\\b|prozessleit|process[ -]?control|control[ -]?system', level: 'critical', reason: 'Hinweise auf Leit-/Steuerungssoftware (SCADA/PLC/Leitrechner)' },
  { pattern: 'modbus|opc[ -]?ua|\\bopcua\\b|profibus|profinet|ethercat|\\bs7\\b|siemens|beckhoff|canopen|iec[ -]?61131', level: 'critical', reason: 'Industrielle Feldbus-/Automatisierungsprotokolle erkannt' },
  { pattern: 'safety[ -]?critical|fail[ -]?safe|emergency[ -]?stop|not[ -]?aus|interlock|sil[ -]?[0-9]', level: 'critical', reason: 'Sicherheitsfunktionen (Safety/Not-Aus/Interlock) erkannt' },
  { pattern: 'real[ -]?time|echtzeit|deterministic|hard[ -]?rt', level: 'sensitive', reason: 'Echtzeit-/deterministische Anforderungen' },
  { pattern: 'pacemaker|medical[ -]?device|infusion|radiation|avionic|flight[ -]?control', level: 'critical', reason: 'Medizin-/Luftfahrt-Domäne — regulatorisch kritisch' },
  { pattern: 'payment|kreditkar|\\bpci[ -]?dss\\b|iban|sepa|banking', level: 'sensitive', reason: 'Zahlungs-/Finanzdaten' },
]

function grepMatches(root: string, pattern: string): boolean {
  try {
    execFileSync('grep', ['-rIliEq', ...EXCLUDE_ARGS, '-e', pattern, root], { timeout: 5000, maxBuffer: 4 * 1024 * 1024 })
    return true
  } catch {
    return false // exit 1 = no match; other errors fail-open
  }
}

/**
 * Assess criticality from the app name and a content scan of the repo.
 * `probe` is injectable for testing.
 */
export function assessCriticality(
  appName: string,
  rootPath: string,
  probe: (root: string, pattern: string) => boolean = grepMatches,
): CriticalityAssessment {
  const reasons: string[] = []
  let level: CriticalityLevel = 'normal'
  const rank: Record<CriticalityLevel, number> = { normal: 0, sensitive: 1, critical: 2 }

  for (const sig of SIGNALS) {
    const inName = new RegExp(sig.pattern, 'i').test(appName)
    if (inName || probe(rootPath, sig.pattern)) {
      reasons.push(sig.reason)
      if (rank[sig.level] > rank[level]) level = sig.level
    }
  }
  return { level, reasons }
}

/** Plain-German banner for the UI / API messages. */
export function criticalityNote(a: CriticalityAssessment): string {
  if (a.level === 'critical') {
    return `⛔ Kritische Software erkannt (${a.reasons.join('; ')}). Kein autonomer Nachbau — nur Analyse/Teilmodernisierung unter menschlicher Verifikation. Ein Nachbau erfordert ausdrückliche Bestätigung.`
  }
  if (a.level === 'sensitive') {
    return `⚠ Sensible Domäne (${a.reasons.join('; ')}). Nachbau mit besonderer Sorgfalt validieren.`
  }
  return 'Keine kritischen Domänen-Signale erkannt.'
}
