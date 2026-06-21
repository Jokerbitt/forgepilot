/**
 * runner-detector.ts — Comprehensive runner readiness check.
 *
 * Checks all tools, credentials, and services needed for reliable execution.
 * Returns structured results with fix instructions for each issue.
 *
 * M4: Reliable Execute Loop
 */

import { execSync, execFileSync } from 'child_process'
import { readStoredApiKeys } from '@/lib/connectors/config'

export type CheckStatus = 'ok' | 'warn' | 'error' | 'unknown'

export interface RunnerCheck {
  id: string
  /** Short display name */
  name: string
  status: CheckStatus
  /** Human-readable detail (German) */
  detail: string
  /** How to fix this if status is error/warn */
  fix?: string
  /** ForgePilot settings URL if fix requires UI action */
  fixHref?: string
  /** Version or extra info when status=ok */
  version?: string
}

export interface RunnerReadiness {
  /** Whether all critical checks pass */
  ready: boolean
  /** Which execution mode will be used */
  executionMode: string
  checks: RunnerCheck[]
  /** Human-readable summary */
  summary: string
  /** Timestamp */
  checkedAt: string
}

// ─── Individual checks ────────────────────────────────────────────────────────

function checkClaudeCLI(): RunnerCheck {
  try {
    const version = execFileSync('claude', ['--version'], { timeout: 4000, encoding: 'utf8' }).trim()
    return { id: 'claude-cli', name: 'Claude Code CLI', status: 'ok', detail: 'Installiert und verfügbar', version }
  } catch (err) {
    const msg = String(err)
    if (msg.includes('not found') || msg.includes('ENOENT')) {
      return {
        id: 'claude-cli', name: 'Claude Code CLI', status: 'error',
        detail: 'claude CLI nicht im PATH gefunden.',
        fix: 'npm install -g @anthropic-ai/claude-code — dann ggf. neu einloggen: claude login',
      }
    }
    return { id: 'claude-cli', name: 'Claude Code CLI', status: 'warn', detail: 'Verfügbar, aber Versionsprüfung fehlgeschlagen', fix: 'Im Terminal prüfen: claude --version' }
  }
}

function checkClaudeLogin(): RunnerCheck {
  try {
    // Try to get claude session info — if not logged in this typically fails or shows login prompt
    execFileSync('claude', ['config', 'list'], { timeout: 5000, encoding: 'utf8', stdio: 'pipe' })
    return { id: 'claude-login', name: 'Claude Code Anmeldung', status: 'ok', detail: 'Session aktiv' }
  } catch {
    // Could be not logged in OR command doesn't exist
    return {
      id: 'claude-login', name: 'Claude Code Anmeldung', status: 'warn',
      detail: 'Anmelde-Status nicht prüfbar — bei Fehler bitte einloggen.',
      fix: 'Im Terminal: claude login',
    }
  }
}

function checkCodexCLI(): RunnerCheck {
  try {
    const version = execFileSync('codex', ['--version'], { timeout: 4000, encoding: 'utf8' }).trim()
    return { id: 'codex-cli', name: 'Codex CLI', status: 'ok', detail: 'Installiert und verfügbar', version }
  } catch {
    return {
      id: 'codex-cli', name: 'Codex CLI', status: 'warn',
      detail: 'Codex CLI nicht gefunden (optional — nur für OpenAI Pro Abo nötig).',
      fix: 'npm install -g @openai/codex — falls Codex Pro Abo vorhanden.',
    }
  }
}

function checkGit(): RunnerCheck {
  try {
    const version = execSync('git --version', { timeout: 3000, encoding: 'utf8' }).trim()
    return { id: 'git', name: 'Git', status: 'ok', detail: 'Installiert', version }
  } catch {
    return {
      id: 'git', name: 'Git', status: 'error',
      detail: 'git nicht gefunden — Code-Commits und Branch-Verwaltung sind nicht möglich.',
      fix: 'https://git-scm.com/downloads',
    }
  }
}

function checkGitHubCLI(): RunnerCheck {
  try {
    const version = execSync('gh --version', { timeout: 3000, encoding: 'utf8' }).trim().split('\n')[0]
    // Check if logged in
    try {
      execSync('gh auth status', { timeout: 5000, stdio: 'pipe', encoding: 'utf8' })
      return { id: 'gh-cli', name: 'GitHub CLI', status: 'ok', detail: 'Eingeloggt und bereit', version }
    } catch {
      return {
        id: 'gh-cli', name: 'GitHub CLI', status: 'warn',
        detail: 'gh CLI installiert aber nicht eingeloggt — automatische PRs nicht möglich.',
        fix: 'Im Terminal: gh auth login',
        version,
      }
    }
  } catch {
    return {
      id: 'gh-cli', name: 'GitHub CLI', status: 'warn',
      detail: 'gh CLI nicht gefunden — automatische PR-Erstellung deaktiviert.',
      fix: 'brew install gh — dann: gh auth login',
    }
  }
}

function checkAnthropicKey(): RunnerCheck {
  const keys = readStoredApiKeys()
  const key = (keys.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? '').trim()
  if (!key) {
    return {
      id: 'anthropic-key', name: 'Anthropic API Key', status: 'warn',
      detail: 'Kein Anthropic API Key — wird nur benötigt wenn kein Claude Code CLI verfügbar ist.',
      fix: 'API Key unter platform.anthropic.com erstellen und in Settings eintragen.',
      fixHref: '/settings',
    }
  }
  if (!key.startsWith('sk-ant-')) {
    return {
      id: 'anthropic-key', name: 'Anthropic API Key', status: 'warn',
      detail: 'Anthropic API Key hat unerwartetes Format.',
      fix: 'Prüfe ob der Key korrekt kopiert wurde (beginnt mit sk-ant-).',
      fixHref: '/settings',
    }
  }
  return { id: 'anthropic-key', name: 'Anthropic API Key', status: 'ok', detail: 'Konfiguriert', version: `${key.slice(0, 12)}…` }
}

function checkGitHubToken(): RunnerCheck {
  const keys = readStoredApiKeys()
  const token = (keys.GITHUB_TOKEN ?? process.env.GITHUB_TOKEN ?? '').trim()
  if (!token) {
    return {
      id: 'github-token', name: 'GitHub Token', status: 'warn',
      detail: 'Kein GitHub Token — PRs werden ohne GitHub-Remote erstellt (nur lokal).',
      fix: 'GitHub Token unter github.com/settings/tokens erstellen und in Settings eintragen. Benötigte Rechte: repo, workflow.',
      fixHref: '/settings',
    }
  }
  if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
    return {
      id: 'github-token', name: 'GitHub Token', status: 'warn',
      detail: 'GitHub Token hat unerwartetes Format.',
      fix: 'Prüfe ob der Token korrekt kopiert wurde (beginnt mit ghp_ oder github_pat_).',
      fixHref: '/settings',
    }
  }
  return { id: 'github-token', name: 'GitHub Token', status: 'ok', detail: 'Konfiguriert', version: `${token.slice(0, 12)}…` }
}

function checkNode(): RunnerCheck {
  try {
    const version = execSync('node --version', { timeout: 3000, encoding: 'utf8' }).trim()
    return { id: 'node', name: 'Node.js', status: 'ok', detail: 'Installiert', version }
  } catch {
    return {
      id: 'node', name: 'Node.js', status: 'error',
      detail: 'Node.js nicht gefunden — npm Befehle und Tests können nicht ausgeführt werden.',
      fix: 'https://nodejs.org',
    }
  }
}

function checkOllama(): RunnerCheck {
  try {
    execSync('ollama list', { timeout: 5000, stdio: 'pipe', encoding: 'utf8' })
    return { id: 'ollama', name: 'Ollama', status: 'ok', detail: 'Läuft und erreichbar' }
  } catch {
    return {
      id: 'ollama', name: 'Ollama', status: 'warn',
      detail: 'Ollama nicht erreichbar (optional — nur für lokale Modelle benötigt).',
      fix: 'Ollama starten: ollama serve',
    }
  }
}

// ─── Main readiness check ─────────────────────────────────────────────────────

export async function checkRunnerReadiness(): Promise<RunnerReadiness> {
  // Run all checks (the sync ones can run sequentially — they're fast)
  const claudeCLI = checkClaudeCLI()
  const claudeLogin = claudeCLI.status === 'ok' ? checkClaudeLogin() : {
    id: 'claude-login', name: 'Claude Code Anmeldung', status: 'unknown' as CheckStatus,
    detail: 'Nicht prüfbar — Claude CLI nicht installiert.',
  }
  const codexCLI = checkCodexCLI()
  const git = checkGit()
  const ghCLI = checkGitHubCLI()
  const anthropicKey = checkAnthropicKey()
  const githubToken = checkGitHubToken()
  const node = checkNode()
  const ollama = checkOllama()

  const checks: RunnerCheck[] = [
    claudeCLI,
    claudeLogin,
    codexCLI,
    git,
    ghCLI,
    anthropicKey,
    githubToken,
    node,
    ollama,
  ]

  // Determine execution mode
  const hasExecutor = claudeCLI.status === 'ok' || codexCLI.status === 'ok' || anthropicKey.status === 'ok'
  const hasCriticalFailure = checks.some(c => c.status === 'error')
  const ready = hasExecutor && !hasCriticalFailure

  let executionMode: string
  if (claudeCLI.status === 'ok') executionMode = 'Claude Code CLI (Max Abo)'
  else if (codexCLI.status === 'ok') executionMode = 'Codex CLI (Pro Abo)'
  else if (anthropicKey.status === 'ok') executionMode = 'Anthropic API'
  else executionMode = 'Kein Executor verfügbar — bitte Claude Code oder API Key konfigurieren'

  const errorCount = checks.filter(c => c.status === 'error').length
  const warnCount = checks.filter(c => c.status === 'warn').length

  let summary: string
  if (ready && errorCount === 0 && warnCount === 0) {
    summary = `Alles bereit — Ausführung über ${executionMode}`
  } else if (ready && warnCount > 0) {
    summary = `Grundlegend bereit (${warnCount} Warnung${warnCount > 1 ? 'en' : ''})`
  } else {
    summary = `${errorCount} kritischer Fehler — Ausführung blockiert`
  }

  return {
    ready,
    executionMode,
    checks,
    summary,
    checkedAt: new Date().toISOString(),
  }
}

/**
 * Quick pre-execution check — only validates critical requirements.
 * Runs in < 500ms. Returns a blocking error message or undefined if ok.
 */
export function quickPreflightCheck(): string | undefined {
  // 1. Must have at least one executor
  const claudeOk = (() => { try { execFileSync('claude', ['--version'], { timeout: 2000, stdio: 'pipe' }); return true } catch { return false } })()
  const codexOk = (() => { try { execFileSync('codex', ['--version'], { timeout: 2000, stdio: 'pipe' }); return true } catch { return false } })()
  const keys = readStoredApiKeys()
  const hasKey = Boolean((keys.ANTHROPIC_API_KEY ?? '').trim()) || Boolean((keys.OPENAI_API_KEY ?? '').trim())

  if (!claudeOk && !codexOk && !hasKey) {
    return 'Kein Executor verfügbar. Bitte Claude Code CLI installieren (npm install -g @anthropic-ai/claude-code) oder einen API Key in den Einstellungen konfigurieren.'
  }

  // 2. Git must be available
  const gitOk = (() => { try { execSync('git --version', { timeout: 2000, stdio: 'pipe' }); return true } catch { return false } })()
  if (!gitOk) {
    return 'git nicht gefunden. Bitte Git installieren: https://git-scm.com/downloads'
  }

  return undefined
}
