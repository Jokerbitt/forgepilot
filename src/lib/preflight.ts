import { spawnSync } from 'child_process'
import type { Delegation } from '@/lib/models/delegation'

export interface PreflightCheck {
  id: string
  label: string
  passed: boolean
  severity: 'blocking' | 'warning'
  detail?: string
  fix?: string
}

export interface PreflightResult {
  canStart: boolean
  checks: PreflightCheck[]
  blockers: PreflightCheck[]
  warnings: PreflightCheck[]
}

const NODE_BIN = '/opt/homebrew/Cellar/node@22/22.22.3/bin'
const GH_BIN = '/opt/homebrew/bin/gh'

function cmd(command: string): { ok: boolean; out: string } {
  const result = spawnSync('bash', ['-c', command], {
    encoding: 'utf-8',
    timeout: 10_000,
    env: { ...process.env, PATH: `${NODE_BIN}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin` },
  })
  return { ok: result.status === 0, out: (result.stdout ?? '') + (result.stderr ?? '') }
}

function checkGitAvailable(): PreflightCheck {
  const r = cmd('git --version')
  return {
    id: 'git_available',
    label: 'git verfügbar',
    passed: r.ok,
    severity: 'blocking',
    detail: r.ok ? undefined : 'git nicht gefunden im PATH',
    fix: 'Homebrew: brew install git',
  }
}

function checkGhAuth(ghToken?: string): PreflightCheck {
  const env = ghToken ? `GH_TOKEN=${ghToken} ` : ''
  const r = cmd(`${env}${GH_BIN} auth status`)
  return {
    id: 'gh_auth',
    label: 'gh CLI authentifiziert',
    passed: r.ok,
    severity: 'blocking',
    detail: r.ok ? undefined : 'gh CLI nicht eingeloggt — PRs können nicht erstellt werden',
    fix: 'GH_TOKEN in Einstellungen hinterlegen oder gh auth login ausführen',
  }
}

function checkNodeAvailable(): PreflightCheck {
  const r = cmd(`${NODE_BIN}/node --version`)
  return {
    id: 'node_available',
    label: 'Node.js verfügbar',
    passed: r.ok,
    severity: 'blocking',
    detail: r.ok ? r.out.trim() : 'Node.js nicht gefunden',
    fix: `export PATH="${NODE_BIN}:$PATH"`,
  }
}

function checkGitMainClean(): PreflightCheck {
  const status = cmd('git status --porcelain')
  const branch = cmd('git branch --show-current')
  const currentBranch = branch.out.trim()
  const isMain = currentBranch === 'main' || currentBranch === 'master'
  const isDirty = status.out.trim().length > 0

  if (isMain && isDirty) {
    return {
      id: 'git_main_clean',
      label: 'main branch sauber',
      passed: false,
      severity: 'warning',
      detail: `Uncommitted changes auf ${currentBranch} — Agent könnte falschen Ausgangspunkt haben`,
      fix: 'git stash oder git commit vor dem Start',
    }
  }
  return { id: 'git_main_clean', label: 'main branch sauber', passed: true, severity: 'warning' }
}

function checkBranchNotExists(branchName: string): PreflightCheck {
  const r = cmd(`git branch --list "${branchName}"`)
  const exists = r.out.trim().length > 0
  return {
    id: 'branch_not_exists',
    label: `Branch '${branchName}' noch nicht vorhanden`,
    passed: !exists,
    severity: 'warning',
    detail: exists ? `Branch '${branchName}' existiert bereits — Agent könnte Konflikte haben` : undefined,
    fix: `git branch -D "${branchName}" um den Branch zu löschen`,
  }
}

function checkDodNotEmpty(delegation: Delegation): PreflightCheck {
  const dod = delegation.contract.definitionOfDone ?? []
  const nonEmpty = dod.filter(d => d.trim().length > 0)
  return {
    id: 'dod_not_empty',
    label: 'Definition of Done vorhanden',
    passed: nonEmpty.length > 0,
    severity: 'warning',
    detail: nonEmpty.length === 0 ? 'Keine DoD-Einträge — Agent hat kein messbares Ziel' : `${nonEmpty.length} DoD-Einträge`,
    fix: 'Mindestens 1 konkretes Akzeptanzkriterium eintragen',
  }
}

function checkTaskComplexity(delegation: Delegation): PreflightCheck {
  const goal = delegation.contract.goal ?? ''
  const dod = (delegation.contract.definitionOfDone ?? []).filter(d => d.trim().length > 0)
  const context = delegation.contract.context ?? ''

  // Complexity signals: many DoD items, long goal, mentions of "and", "also", "plus"
  const complexityScore =
    dod.length * 2 +
    (goal.length > 200 ? 3 : goal.length > 100 ? 1 : 0) +
    ([' and ', ' also ', ' plus ', ' additionally ', ' furthermore '].filter(w => goal.toLowerCase().includes(w)).length * 2) +
    (context.length > 500 ? 2 : 0)

  const tooComplex = complexityScore >= 10

  return {
    id: 'task_complexity',
    label: 'Task-Komplexität im Rahmen',
    passed: !tooComplex,
    severity: 'warning',
    detail: tooComplex
      ? `Komplexitäts-Score: ${complexityScore}/10 — Task ist möglicherweise zu groß für einen Agent-Run`
      : `Komplexitäts-Score: ${complexityScore}/10`,
    fix: 'Task in kleinere Sub-Tasks aufteilen (je Task: 1 klar messbares Ziel)',
  }
}

function checkBudgetRealistic(delegation: Delegation): PreflightCheck {
  const budget = delegation.contract.maxBudgetUsd
  const dod = (delegation.contract.definitionOfDone ?? []).filter(d => d.trim().length > 0)
  // Rough heuristic: $1 ≈ 15 turns. Each DoD item needs ~5 turns minimum.
  const minBudgetNeeded = (dod.length * 5) / 15
  const tooLow = budget < minBudgetNeeded && dod.length > 2

  return {
    id: 'budget_realistic',
    label: 'Budget realistisch für DoD',
    passed: !tooLow,
    severity: 'warning',
    detail: tooLow
      ? `Budget $${budget.toFixed(2)} könnte zu niedrig für ${dod.length} DoD-Punkte sein (min ~$${minBudgetNeeded.toFixed(2)})`
      : `Budget $${budget.toFixed(2)} für ${dod.length} DoD-Punkte`,
    fix: `Budget auf mindestens $${(minBudgetNeeded * 1.5).toFixed(2)} erhöhen`,
  }
}

export async function runPreflight(
  delegation: Delegation,
  ghToken?: string
): Promise<PreflightResult> {
  const slug = delegation.contract.workItemId.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  const branchStrategy = delegation.contract.branchStrategy ?? 'feature'
  const branchName = `${branchStrategy}/${slug}-task`

  const checks: PreflightCheck[] = [
    checkGitAvailable(),
    checkNodeAvailable(),
    checkGhAuth(ghToken),
    checkGitMainClean(),
    checkBranchNotExists(branchName),
    checkDodNotEmpty(delegation),
    checkTaskComplexity(delegation),
    checkBudgetRealistic(delegation),
  ]

  const blockers = checks.filter(c => !c.passed && c.severity === 'blocking')
  const warnings = checks.filter(c => !c.passed && c.severity === 'warning')

  return {
    canStart: blockers.length === 0,
    checks,
    blockers,
    warnings,
  }
}
