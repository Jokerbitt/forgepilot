/**
 * Reverse-Engineering — deep security scan (read-only).
 *
 * Heuristic, pattern-based scan that surfaces likely vulnerabilities in an
 * existing codebase (incl. C#/.NET specifics) with a severity and a sample file
 * — never the secret value itself. Findings flow into the analysis report and
 * into the rebuild plan ("fix security" step), directly serving the
 * "Sicherheitslücken aufzeigen und fixen" goal.
 *
 * Standalone (no import from analyze.ts) to avoid a circular dependency.
 */
import { execFileSync } from 'child_process'

export type Severity = 'high' | 'medium' | 'low'

export interface SecurityFinding {
  severity: Severity
  category: string
  /** Plain-German description + recommendation. */
  message: string
  /** A relative path of one affected file (no file contents are returned). */
  sampleFile?: string
}

interface Rule {
  /** grep -E pattern. */
  pattern: string
  severity: Severity
  category: string
  message: string
}

const RULES: Rule[] = [
  { pattern: '(Password|pwd)[[:space:]]*=[[:space:]]*["\']?[^"\'[:space:];]{3,}', severity: 'high', category: 'Hardcoded Secret', message: 'Hartkodierte Zugangsdaten / Connection-String mit Passwort — in Secrets/Env auslagern.' },
  { pattern: 'BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY', severity: 'high', category: 'Private Key', message: 'Privater Schlüssel im Code — sofort entfernen und rotieren.' },
  { pattern: 'AKIA[0-9A-Z]{16}', severity: 'high', category: 'Cloud Credential', message: 'Möglicher AWS-Access-Key im Code — prüfen und rotieren.' },
  { pattern: 'AIza[0-9A-Za-z_\\-]{20,}', severity: 'high', category: 'Cloud Credential', message: 'Möglicher Google-API-Key im Code — prüfen und rotieren.' },
  { pattern: '(SELECT|INSERT|UPDATE|DELETE) .*["\'][[:space:]]*\\+', severity: 'high', category: 'SQL Injection', message: 'String-konkatenierte SQL-Abfragen — auf parametrisierte Queries umstellen.' },
  { pattern: 'BinaryFormatter', severity: 'high', category: 'Unsafe Deserialization', message: '.NET BinaryFormatter ist unsicher (RCE-Risiko) — durch sicheren Serializer ersetzen.' },
  { pattern: 'ServerCertificateValidationCallback|rejectUnauthorized[[:space:]]*[:=][[:space:]]*false|CheckCertificateRevocationList[[:space:]]*=[[:space:]]*false', severity: 'high', category: 'TLS Disabled', message: 'TLS-/Zertifikatsprüfung deaktiviert — Validierung wieder aktivieren.' },
  { pattern: '\\b(MD5|SHA1|DES|TripleDES|RC4)\\b', severity: 'medium', category: 'Weak Crypto', message: 'Schwache Kryptografie (MD5/SHA1/DES/RC4) — auf SHA-256/AES umstellen.' },
  { pattern: '\\beval\\(|\\bexec\\(|Process\\.Start\\(', severity: 'medium', category: 'Dynamic Execution', message: 'Dynamische Code-/Prozessausführung — Eingaben strikt validieren (Injection-Risiko).' },
  { pattern: 'http://[a-zA-Z0-9.\\-]', severity: 'low', category: 'Cleartext HTTP', message: 'Unverschlüsselte HTTP-URLs — wo möglich auf HTTPS umstellen.' },
]

/** grep -rl for a pattern; returns up to `max` matching relative file paths. */
function grepFiles(root: string, pattern: string, max = 1): string[] {
  try {
    const out = execFileSync(
      'grep',
      ['-rIlE', '--include=*.cs', '--include=*.ts', '--include=*.tsx', '--include=*.js', '--include=*.jsx',
        '--include=*.py', '--include=*.java', '--include=*.go', '--include=*.php', '--include=*.config', '--include=*.json',
        '-e', pattern, root],
      { timeout: 5000, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8' },
    ).trim()
    if (!out) return []
    return out.split('\n').filter(Boolean)
      .map(p => (p.startsWith(root) ? p.slice(root.length).replace(/^\//, '') : p))
      .slice(0, max)
  } catch {
    return [] // exit 1 = no match; other errors fail-open
  }
}

/** Run all rules against the repo. Returns findings sorted high→low severity. */
export function scanSecurityDeep(root: string): SecurityFinding[] {
  const order: Record<Severity, number> = { high: 0, medium: 1, low: 2 }
  const findings: SecurityFinding[] = []
  for (const rule of RULES) {
    const files = grepFiles(root, rule.pattern)
    if (files.length === 0) continue
    findings.push({ severity: rule.severity, category: rule.category, message: rule.message, sampleFile: files[0] })
  }
  return findings.sort((a, b) => order[a.severity] - order[b.severity])
}

/** Condense findings into plain-German strings (kept for the report's string list). */
export function findingsToStrings(findings: SecurityFinding[]): string[] {
  const mark: Record<Severity, string> = { high: '🔴', medium: '🟠', low: '🟡' }
  return findings.map(f => `${mark[f.severity]} ${f.category}: ${f.message}${f.sampleFile ? ` (z. B. ${f.sampleFile})` : ''}`)
}
