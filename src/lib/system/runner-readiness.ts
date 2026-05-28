import { execSync } from 'child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { readStoredApiKeys } from '@/lib/connectors/config'

export type RunnerMode = 'claude-cli' | 'codex-cli' | 'claude-api' | 'openai-api' | 'simulation'

export interface RunnerProbe {
  available: boolean
  headlessReady: boolean
  version: string | null
  detail: string
  durationMs?: number
  checkedAt?: string
}

export interface RunnerReadiness {
  ready: boolean
  activeMode: RunnerMode
  zeroKeyReady: boolean
  claude: RunnerProbe
  codex: RunnerProbe
  claudeApiKeySet: boolean
  openAiApiKeySet: boolean
  recommendation: string
  checkedAt: string
}

const CACHE_TTL_MS = 10 * 60 * 1000
const CACHE_FILE = path.join(process.cwd(), 'config', 'runner-readiness-cache.json')
const PING_PROMPT = 'Return exactly: PONG'

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function firstLine(value: string): string {
  return value.trim().split('\n')[0]?.trim() ?? ''
}

function detectVersion(binary: 'claude' | 'codex'): string | null {
  try {
    return firstLine(execSync(`${binary} --version`, {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }))
  } catch {
    return null
  }
}

function containsPong(output: string): boolean {
  return /\bPONG\b/i.test(output)
}

function shallowProbe(binary: 'claude' | 'codex'): RunnerProbe {
  const version = detectVersion(binary)
  if (!version) {
    return {
      available: false,
      headlessReady: false,
      version: null,
      detail: `${binary} CLI nicht im PATH gefunden.`,
    }
  }

  return {
    available: true,
    headlessReady: false,
    version,
    detail: `${binary} CLI ist installiert. Headless-Prompt wurde noch nicht geprueft.`,
  }
}

function probeClaudeHeadless(cwd: string, timeoutMs: number): RunnerProbe {
  const base = shallowProbe('claude')
  if (!base.available) return base

  const started = Date.now()
  try {
    const output = execSync(
      `claude -p ${shellQuote(PING_PROMPT)} --max-turns 1 --output-format stream-json --verbose`,
      {
        cwd,
        encoding: 'utf8',
        timeout: timeoutMs,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    const durationMs = Date.now() - started
    const headlessReady = containsPong(output)
    return {
      ...base,
      headlessReady,
      durationMs,
      checkedAt: new Date().toISOString(),
      detail: headlessReady
        ? 'Claude CLI kann headless ohne API-Key Prompts ausfuehren.'
        : 'Claude CLI antwortete, aber der Readiness-Ping war nicht eindeutig.',
    }
  } catch (error) {
    return {
      ...base,
      headlessReady: false,
      durationMs: Date.now() - started,
      checkedAt: new Date().toISOString(),
      detail: `Claude CLI Headless-Test fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

function probeCodexHeadless(cwd: string, timeoutMs: number): RunnerProbe {
  const base = shallowProbe('codex')
  if (!base.available) return base

  const started = Date.now()
  try {
    const output = execSync(
      `codex exec -C ${shellQuote(cwd)} --sandbox read-only ${shellQuote(PING_PROMPT)}`,
      {
        cwd,
        encoding: 'utf8',
        timeout: timeoutMs,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    const durationMs = Date.now() - started
    const headlessReady = containsPong(output)
    return {
      ...base,
      headlessReady,
      durationMs,
      checkedAt: new Date().toISOString(),
      detail: headlessReady
        ? 'Codex CLI kann headless ohne API-Key Prompts ausfuehren.'
        : 'Codex CLI antwortete, aber der Readiness-Ping war nicht eindeutig.',
    }
  } catch (error) {
    return {
      ...base,
      headlessReady: false,
      durationMs: Date.now() - started,
      checkedAt: new Date().toISOString(),
      detail: `Codex CLI Headless-Test fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

function buildReadiness(claude: RunnerProbe, codex: RunnerProbe): RunnerReadiness {
  const { ANTHROPIC_API_KEY, OPENAI_API_KEY } = readStoredApiKeys()
  const claudeApiKeySet = Boolean(ANTHROPIC_API_KEY?.trim())
  const openAiApiKeySet = Boolean(OPENAI_API_KEY?.trim())
  const zeroKeyReady = claude.headlessReady || codex.headlessReady
  const ready = zeroKeyReady || claudeApiKeySet || openAiApiKeySet
  const activeMode: RunnerMode = claude.headlessReady
    ? 'claude-cli'
    : codex.headlessReady
      ? 'codex-cli'
      : claudeApiKeySet
        ? 'claude-api'
        : openAiApiKeySet
          ? 'openai-api'
          : 'simulation'

  return {
    ready,
    activeMode,
    zeroKeyReady,
    claude,
    codex,
    claudeApiKeySet,
    openAiApiKeySet,
    recommendation: ready
      ? zeroKeyReady
        ? 'Echte Zero-Key-Ausfuehrung ist bereit. API-Keys bleiben optional.'
        : 'API-Fallback ist bereit. Fuer Zero-Key bitte Claude Code oder Codex CLI anmelden.'
      : 'Kein echter Runner bereit. Autonomie bleibt blockiert, bis Claude/Codex CLI oder ein API-Key funktioniert.',
    checkedAt: new Date().toISOString(),
  }
}

export function getRunnerReadiness(options?: {
  deep?: boolean
  cwd?: string
  timeoutMs?: number
}): RunnerReadiness {
  const cwd = options?.cwd ?? process.cwd()
  const timeoutMs = Math.max(10_000, options?.timeoutMs ?? 45_000)
  const claude = options?.deep ? probeClaudeHeadless(cwd, timeoutMs) : shallowProbe('claude')
  const codex = options?.deep ? probeCodexHeadless(cwd, timeoutMs) : shallowProbe('codex')

  return buildReadiness(claude, codex)
}

export function readCachedRunnerReadiness(): RunnerReadiness | null {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return null
  try {
    if (!existsSync(CACHE_FILE)) return null
    const parsed = JSON.parse(readFileSync(CACHE_FILE, 'utf8')) as RunnerReadiness
    const checkedAt = Date.parse(parsed.checkedAt)
    if (!Number.isFinite(checkedAt) || Date.now() - checkedAt > CACHE_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

export function writeCachedRunnerReadiness(readiness: RunnerReadiness): void {
  try {
    mkdirSync(path.dirname(CACHE_FILE), { recursive: true })
    writeFileSync(CACHE_FILE, `${JSON.stringify(readiness, null, 2)}\n`, 'utf8')
  } catch {
    // Runtime cache only. Failing to persist must never block execution.
  }
}

export function getCachedOrShallowRunnerReadiness(): RunnerReadiness {
  return readCachedRunnerReadiness() ?? getRunnerReadiness({ deep: false })
}
