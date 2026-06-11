import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import path from 'path'
import { readConnectorConfigs, readStoredApiKeys } from '@/lib/connectors/config'
import { getCachedOrShallowRunnerReadiness, type RunnerReadiness } from '@/lib/system/runner-readiness'

export type AutopilotCheckStatus = 'ready' | 'attention' | 'blocked'

export interface AutopilotReadinessCheck {
  id: string
  label: string
  status: AutopilotCheckStatus
  detail: string
  action?: string
}

export interface AutopilotReadinessResponse {
  status: AutopilotCheckStatus
  score: number
  mode: string
  canStartDemoRun: boolean
  canExecuteCode: boolean
  canCreatePr: boolean
  canAutoMerge: boolean
  recommendation: string
  checks: AutopilotReadinessCheck[]
  checkedAt: string
}

interface ProbeResult {
  ok: boolean
  value?: string
  detail: string
}

interface PackageScripts {
  [name: string]: string | undefined
}

export interface AutopilotReadinessInputs {
  runner: RunnerReadiness
  githubTokenSet: boolean
  githubRepoConfigured: boolean
  githubCli: ProbeResult
  githubAuth: ProbeResult
  git: ProbeResult
  gitRemote: ProbeResult
  gitBranch: ProbeResult
  gitStatus: ProbeResult
  scripts: PackageScripts
}

function firstLine(value: string): string {
  return value.trim().split('\n')[0]?.trim() ?? ''
}

function runProbe(command: string, options?: { cwd?: string; timeoutMs?: number }): ProbeResult {
  try {
    const output = execSync(command, {
      cwd: options?.cwd ?? process.cwd(),
      encoding: 'utf8',
      timeout: options?.timeoutMs ?? 5000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const value = typeof output === 'string' ? output.trim() : String(output).trim()
    return { ok: true, value, detail: firstLine(value) || 'bereit' }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, detail: message.split('\n')[0] ?? 'nicht bereit' }
  }
}

function readPackageScripts(cwd: string): PackageScripts {
  try {
    const packageJson = JSON.parse(readFileSync(path.join(cwd, 'package.json'), 'utf8')) as { scripts?: PackageScripts }
    return packageJson.scripts ?? {}
  } catch {
    return {}
  }
}

export function collectAutopilotReadinessInputs(cwd = process.cwd()): AutopilotReadinessInputs {
  const runner = getCachedOrShallowRunnerReadiness()
  const storedKeys = readStoredApiKeys()
  const connectorConfigs = readConnectorConfigs()
  const githubTokenSet = Boolean(
    process.env.GITHUB_TOKEN?.trim()
    || process.env.GH_TOKEN?.trim()
    || storedKeys.GITHUB_TOKEN?.trim()
    || connectorConfigs.github?.token?.trim(),
  )
  const githubRepoConfigured = Boolean(
    connectorConfigs.github?.owner
    || (connectorConfigs.github?.repositories?.length ?? 0) > 0
    || process.env.GITHUB_REPOSITORY?.trim(),
  )

  return {
    runner,
    githubTokenSet,
    githubRepoConfigured,
    githubCli: runProbe('gh --version', { cwd, timeoutMs: 4000 }),
    githubAuth: runProbe('gh auth status', { cwd, timeoutMs: 6000 }),
    git: runProbe('git --version', { cwd, timeoutMs: 4000 }),
    gitRemote: runProbe('git remote get-url origin', { cwd, timeoutMs: 4000 }),
    gitBranch: runProbe('git rev-parse --abbrev-ref HEAD', { cwd, timeoutMs: 4000 }),
    gitStatus: runProbe('git status --porcelain', { cwd, timeoutMs: 6000 }),
    scripts: readPackageScripts(cwd),
  }
}

function buildScriptCheck(scripts: PackageScripts): AutopilotReadinessCheck {
  const required = ['type-check', 'lint', 'build', 'test:run']
  const missing = required.filter(script => !scripts[script])
  if (missing.length === 0) {
    return {
      id: 'validation-scripts',
      label: 'Validierung',
      status: 'ready',
      detail: 'Typecheck, Lint, Build und Tests sind als npm scripts vorhanden.',
    }
  }

  return {
    id: 'validation-scripts',
    label: 'Validierung',
    status: 'attention',
    detail: `Fehlende Scripts: ${missing.join(', ')}.`,
    action: 'Scripts nachziehen, damit autonome Runs vor PR/Merge reproduzierbar geprüft werden.',
  }
}

function checkStatusWeight(status: AutopilotCheckStatus): number {
  if (status === 'ready') return 1
  if (status === 'attention') return 0.5
  return 0
}

export function buildAutopilotReadiness(inputs: AutopilotReadinessInputs): AutopilotReadinessResponse {
  const canExecuteCode = inputs.runner.ready
  const canCreatePr = inputs.git.ok && inputs.gitRemote.ok && (inputs.githubTokenSet || (inputs.githubCli.ok && inputs.githubAuth.ok))
  const hasDirtyTree = inputs.gitStatus.ok && Boolean(inputs.gitStatus.value?.trim())
  const validationCheck = buildScriptCheck(inputs.scripts)

  const checks: AutopilotReadinessCheck[] = [
    {
      id: 'execution-runner',
      label: 'Echter KI-Runner',
      status: canExecuteCode ? 'ready' : 'blocked',
      detail: inputs.runner.recommendation,
      action: canExecuteCode ? undefined : 'Claude Code oder Codex CLI anmelden oder optional API-Key setzen.',
    },
    {
      id: 'claude-cli',
      label: 'Claude Max / Claude Code',
      status: inputs.runner.claude.headlessReady ? 'ready' : inputs.runner.claude.available ? 'attention' : 'blocked',
      detail: inputs.runner.claude.detail,
      action: inputs.runner.claude.headlessReady ? undefined : 'In Claude Code anmelden und Deep Readiness pruefen.',
    },
    {
      id: 'codex-cli',
      label: 'Codex CLI',
      status: inputs.runner.codex.headlessReady ? 'ready' : inputs.runner.codex.available ? 'attention' : 'blocked',
      detail: inputs.runner.codex.detail,
      action: inputs.runner.codex.headlessReady ? undefined : 'Codex CLI anmelden und Deep Readiness pruefen.',
    },
    {
      id: 'git',
      label: 'Git Repository',
      status: inputs.git.ok && inputs.gitRemote.ok ? 'ready' : 'blocked',
      detail: inputs.git.ok && inputs.gitRemote.ok
        ? `Remote bereit: ${firstLine(inputs.gitRemote.value ?? '')}`
        : 'Git oder origin remote ist nicht verfuegbar.',
      action: inputs.git.ok && inputs.gitRemote.ok ? undefined : 'Git initialisieren und origin remote setzen.',
    },
    {
      id: 'working-tree',
      label: 'Arbeitsstand',
      status: hasDirtyTree ? 'attention' : inputs.gitStatus.ok ? 'ready' : 'attention',
      detail: hasDirtyTree
        ? 'Es gibt lokale Aenderungen. Autopilot kann weiterarbeiten, aber Auto-Merge bleibt vorsichtig.'
        : inputs.gitStatus.ok ? 'Working tree ist sauber.' : 'Git-Status konnte nicht gelesen werden.',
      action: hasDirtyTree ? 'Aenderungen pruefen, committen oder bewusst im aktuellen Run behalten.' : undefined,
    },
    {
      id: 'github-access',
      label: 'GitHub PR-Zugriff',
      status: canCreatePr ? 'ready' : inputs.githubCli.ok || inputs.githubTokenSet ? 'attention' : 'blocked',
      detail: canCreatePr
        ? inputs.githubTokenSet ? 'GitHub Token ist konfiguriert oder gh auth ist aktiv.' : 'GitHub CLI ist authentifiziert.'
        : 'PR-Erstellung braucht GitHub Token oder authentifizierte gh CLI.',
      action: canCreatePr ? undefined : 'GitHub in Settings verbinden oder `gh auth login` ausfuehren.',
    },
    {
      id: 'github-repo-config',
      label: 'GitHub Repo-Konfiguration',
      status: inputs.githubRepoConfigured || inputs.gitRemote.ok ? 'ready' : 'attention',
      detail: inputs.githubRepoConfigured ? 'Repo-Konfiguration ist gesetzt.' : 'Kein explizites Repo gesetzt; ForgePilot nutzt origin remote als Fallback.',
      action: inputs.githubRepoConfigured || inputs.gitRemote.ok ? undefined : 'GITHUB_OWNER/GITHUB_REPO oder Settings-Konfiguration setzen.',
    },
    validationCheck,
  ]

  const blocking = checks.filter(check => check.status === 'blocked')
  const attention = checks.filter(check => check.status === 'attention')
  const canStartDemoRun = canExecuteCode && inputs.git.ok
  const canAutoMerge = canCreatePr && canExecuteCode && validationCheck.status !== 'blocked' && !hasDirtyTree
  const status: AutopilotCheckStatus = blocking.length > 0 ? 'blocked' : attention.length > 0 ? 'attention' : 'ready'
  const score = Math.round((checks.reduce((sum, check) => sum + checkStatusWeight(check.status), 0) / checks.length) * 100)

  return {
    status,
    score,
    mode: inputs.runner.activeMode,
    canStartDemoRun,
    canExecuteCode,
    canCreatePr,
    canAutoMerge,
    recommendation: status === 'ready'
      ? 'Autopilot ist bereit: echter Runner, PR-Erstellung und Validierung sind verfuegbar.'
      : canExecuteCode
        ? 'Autopilot kann Code ausfuehren. Pruefe die markierten Punkte fuer PR-Flow und Auto-Merge.'
        : 'Autopilot ist noch nicht bereit fuer echte Software-Builds. Zuerst Claude/Codex CLI oder API-Fallback aktivieren.',
    checks,
    checkedAt: new Date().toISOString(),
  }
}

export function getAutopilotReadiness(cwd = process.cwd()): AutopilotReadinessResponse {
  return buildAutopilotReadiness(collectAutopilotReadinessInputs(cwd))
}
