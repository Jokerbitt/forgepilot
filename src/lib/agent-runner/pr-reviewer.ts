import { execSync, spawnSync } from 'child_process'
import path from 'path'
import { upsertAttentionItem } from '@/lib/attention/store'

const GH_BIN = '/opt/homebrew/bin/gh'
const NODE_BIN = '/opt/homebrew/Cellar/node@22/22.22.3/bin'

export interface ReviewFinding {
  severity: 'critical' | 'warning' | 'info'
  category: 'tests' | 'quality' | 'scope' | 'security' | 'spec'
  title: string
  detail: string
  fix?: string
}

export interface PRReviewResult {
  prNumber: number
  prTitle: string
  prUrl: string
  passed: boolean
  findings: ReviewFinding[]
  filesChanged: string[]
  scopeViolations: string[]
  issuesCreated: number
  reviewedAt: string
}

const SECRET_PATTERNS = [
  /sk-ant-[a-zA-Z0-9\-_]{20,}/,
  /ghp_[a-zA-Z0-9]{36}/,
  /lin_api_[a-zA-Z0-9]{40}/,
  /ANTHROPIC_API_KEY\s*=\s*['"]?sk-/,
  /LINEAR_API_KEY\s*=\s*['"]?lin_/,
]

function run(cmd: string, cwd?: string): { stdout: string; stderr: string; ok: boolean } {
  try {
    const env = { ...process.env, PATH: `${NODE_BIN}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin` }
    const result = spawnSync('bash', ['-c', cmd], {
      cwd: cwd ?? process.cwd(),
      env,
      encoding: 'utf-8',
      timeout: 120_000,
    })
    return {
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      ok: result.status === 0,
    }
  } catch {
    return { stdout: '', stderr: 'command failed', ok: false }
  }
}

function fetchPRInfo(prNumber: number, ghToken: string): { title: string; url: string; body: string } {
  const env = `GH_TOKEN=${ghToken}`
  const r = run(`${env} ${GH_BIN} pr view ${prNumber} --json title,url,body`)
  if (!r.ok) return { title: `PR #${prNumber}`, url: '', body: '' }
  try {
    const data = JSON.parse(r.stdout) as { title: string; url: string; body: string }
    return data
  } catch {
    return { title: `PR #${prNumber}`, url: '', body: '' }
  }
}

function fetchChangedFiles(prNumber: number, ghToken: string): string[] {
  const env = `GH_TOKEN=${ghToken}`
  const r = run(`${env} ${GH_BIN} pr diff ${prNumber} --name-only`)
  if (!r.ok) return []
  return r.stdout.split('\n').map(f => f.trim()).filter(Boolean)
}

function fetchDiff(prNumber: number, ghToken: string): string {
  const env = `GH_TOKEN=${ghToken}`
  const r = run(`${env} ${GH_BIN} pr diff ${prNumber}`)
  return r.ok ? r.stdout : ''
}

function createGitHubIssue(title: string, body: string, labels: string[], prNumber: number, ghToken: string): string | null {
  const env = `GH_TOKEN=${ghToken}`
  const labelArg = labels.map(l => `--label "${l}"`).join(' ')
  const escapedTitle = title.replace(/"/g, "'")
  const escapedBody = body.replace(/`/g, "'")
  const r = run(`${env} ${GH_BIN} issue create --title "${escapedTitle}" --body "${escapedBody}" ${labelArg}`)
  if (!r.ok) return null
  const match = r.stdout.match(/https:\/\/github\.com\/[^\s]+\/issues\/\d+/)
  return match ? match[0] : null
}

function detectScopeViolations(filesChanged: string[]): string[] {
  const alwaysSafe = [
    'package.json', 'package-lock.json', '.gitignore', 'README.md',
    'CLAUDE.md', 'AGENTS.md', 'tsconfig.json', 'tailwind.config',
    'vitest.config', 'next.config', 'postcss.config',
  ]
  const configFiles = filesChanged.filter(f =>
    f.startsWith('config/') && !alwaysSafe.some(s => f.endsWith(s))
  )
  return configFiles
}

function detectSecrets(diff: string): ReviewFinding[] {
  const findings: ReviewFinding[] = []
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(diff)) {
      findings.push({
        severity: 'critical',
        category: 'security',
        title: 'Mögliche Secrets im Diff entdeckt',
        detail: `Pattern ${pattern.source} wurde im PR-Diff gefunden. Secrets niemals committen.`,
        fix: 'git filter-branch oder BFG Repo-Cleaner verwenden um Secrets aus der History zu entfernen.',
      })
      break
    }
  }
  return findings
}

export async function runPRReview(opts: {
  prNumber: number
  ghToken: string
  delegationId?: string
  expectedScope?: string[]
}): Promise<PRReviewResult> {
  const { prNumber, ghToken, delegationId, expectedScope } = opts
  const findings: ReviewFinding[] = []

  // 1. Fetch PR metadata
  const { title, url } = fetchPRInfo(prNumber, ghToken)
  const filesChanged = fetchChangedFiles(prNumber, ghToken)
  const diff = fetchDiff(prNumber, ghToken)

  // 2. Local quality checks
  const testResult = run(`${NODE_BIN}/npm run test:run -- --reporter=verbose 2>&1 | tail -5`)
  if (!testResult.ok) {
    findings.push({
      severity: 'critical',
      category: 'tests',
      title: 'Vitest Tests schlagen fehl',
      detail: testResult.stdout.slice(-500) || 'Test run failed',
      fix: 'npm run test:run lokal ausführen und alle Fehler beheben bevor der PR gemergt wird.',
    })
  } else if (!testResult.stdout.includes('passed')) {
    findings.push({
      severity: 'warning',
      category: 'tests',
      title: 'Test-Ergebnis unklar',
      detail: 'Test-Output enthält kein "passed". Bitte manuell prüfen.',
      fix: 'npm run test:run ausführen und sicherstellen dass alle Tests grün sind.',
    })
  }

  const lintResult = run(`${NODE_BIN}/npm run lint 2>&1`)
  if (!lintResult.ok || lintResult.stdout.includes('warning') || lintResult.stdout.includes('error')) {
    findings.push({
      severity: 'warning',
      category: 'quality',
      title: 'ESLint Warnings oder Errors gefunden',
      detail: lintResult.stdout.slice(-300) || 'Lint failed',
      fix: 'npm run lint ausführen und alle Warnings/Errors beheben.',
    })
  }

  const typeResult = run(`${NODE_BIN}/npm run type-check 2>&1`)
  if (!typeResult.ok) {
    findings.push({
      severity: 'critical',
      category: 'quality',
      title: 'TypeScript Fehler',
      detail: typeResult.stdout.slice(-500) || 'Type check failed',
      fix: 'npm run type-check ausführen und alle Fehler beheben.',
    })
  }

  // 3. Secret scan
  const secretFindings = detectSecrets(diff)
  findings.push(...secretFindings)

  // 4. Scope violations
  const scopeViolations = detectScopeViolations(filesChanged)
  if (scopeViolations.length > 0) {
    findings.push({
      severity: 'warning',
      category: 'scope',
      title: `${scopeViolations.length} config-Datei(en) im Diff`,
      detail: `Veränderte Config-Dateien: ${scopeViolations.join(', ')}. Config-Dateien enthalten ggf. Runtime-Daten oder Secrets.`,
      fix: 'config/*.json in .gitignore eintragen und mit git rm --cached entfernen.',
    })
  }

  // 5. Expected scope check
  if (expectedScope && expectedScope.length > 0) {
    const unexpectedFiles = filesChanged.filter(f =>
      !expectedScope.some(scope => f.startsWith(scope) || f === scope)
    )
    if (unexpectedFiles.length > 0) {
      findings.push({
        severity: 'info',
        category: 'scope',
        title: `${unexpectedFiles.length} Datei(en) außerhalb des erwarteten Scopes`,
        detail: `Erwartet: ${expectedScope.join(', ')}. Unerwartet verändert: ${unexpectedFiles.slice(0, 5).join(', ')}`,
        fix: 'Prüfen ob die Änderungen absichtlich sind oder Agentic Drift vorliegt.',
      })
    }
  }

  // 6. Test coverage check — warn if no test files in PR
  const hasTestFiles = filesChanged.some(f => f.includes('.test.') || f.includes('.spec.'))
  const hasSrcFiles = filesChanged.some(f => f.startsWith('src/') && !f.includes('.test.'))
  if (hasSrcFiles && !hasTestFiles) {
    findings.push({
      severity: 'warning',
      category: 'tests',
      title: 'Keine neuen Tests in diesem PR',
      detail: `${filesChanged.filter(f => f.startsWith('src/') && !f.includes('.test.')).length} Source-Datei(en) ohne zugehörige Test-Datei(en).`,
      fix: 'Für jede neue Feature-Datei mindestens einen Test schreiben.',
    })
  }

  const passed = !findings.some(f => f.severity === 'critical')

  // 7. Create GitHub issues for critical/warning findings
  let issuesCreated = 0
  const criticalFindings = findings.filter(f => f.severity === 'critical' || f.severity === 'warning')
  for (const finding of criticalFindings) {
    const body = [
      `**PR:** #${prNumber} — ${title}`,
      `**Kategorie:** ${finding.category}`,
      `**Schwere:** ${finding.severity}`,
      '',
      '## Problem',
      finding.detail,
      '',
      finding.fix ? `## Lösung\n${finding.fix}` : '',
      '',
      '---',
      '_Erstellt vom ForgePilot Backoffice Manager (M25)_',
    ].filter(l => l !== undefined).join('\n')

    const labels = finding.severity === 'critical' ? ['bug', 'backoffice-review'] : ['backoffice-review']
    const issueUrl = createGitHubIssue(`[PR #${prNumber}] ${finding.title}`, body, labels, prNumber, ghToken)
    if (issueUrl) issuesCreated++
  }

  // 8. Create attention item in ForgePilot inbox
  const itemId = `pr-review-${prNumber}-${Date.now()}`
  const critCount = findings.filter(f => f.severity === 'critical').length
  const warnCount = findings.filter(f => f.severity === 'warning').length

  upsertAttentionItem({
    id: itemId,
    type: passed ? 'review_passed' : 'review_failed',
    severity: passed ? 'info' : critCount > 0 ? 'critical' : 'warning',
    title: passed
      ? `PR #${prNumber} hat Review bestanden`
      : `PR #${prNumber} hat ${critCount} kritische + ${warnCount} Warnungen`,
    body: passed
      ? `${title} — alle Quality-Checks grün. ${findings.length} Hinweise, ${issuesCreated} Issues erstellt.`
      : `${title} — Review fehlgeschlagen. ${issuesCreated} GitHub Issues wurden erstellt.`,
    delegationId,
    actionUrl: url || `/agent-runs`,
    createdAt: new Date().toISOString(),
  })

  return {
    prNumber,
    prTitle: title,
    prUrl: url,
    passed,
    findings,
    filesChanged,
    scopeViolations,
    issuesCreated,
    reviewedAt: new Date().toISOString(),
  }
}
