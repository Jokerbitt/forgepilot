import { execSync } from 'child_process'
import { NextResponse } from 'next/server'
import { readStoredApiKeys } from '@/lib/connectors/config'

export const dynamic = 'force-dynamic'

type ActiveMode = 'claude-cli' | 'codex-cli' | 'claude-api' | 'openai-api' | 'simulation'

interface ToolStatus {
  available: boolean
  version: string | null
  authenticated: boolean | null
  detail: string
}

interface CliStatusResponse {
  claudeCliAvailable: boolean
  claudeCliVersion: string | null
  codexCliAvailable: boolean
  codexCliVersion: string | null
  claudeApiKeySet: boolean
  openAiApiKeySet: boolean
  apiKeysOptional: boolean
  zeroKeyReady: boolean
  activeMode: ActiveMode
  claude: ToolStatus
  codex: ToolStatus
  recommendation: string
  setupUrl: string
}

function detectVersion(command: string): string | null {
  try {
    const out = execSync(command, { encoding: 'utf-8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] })
    return out.trim().split('\n')[0] ?? null
  } catch {
    return null
  }
}

function detectAuth(command: string, successLabel: string, fallbackLabel: string): Pick<ToolStatus, 'authenticated' | 'detail'> {
  try {
    const out = execSync(command, { encoding: 'utf-8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] })
    const normalized = out.toLowerCase()
    const authenticated = normalized.includes('authenticated')
      || normalized.includes('logged in')
      || normalized.includes('signed in')
      || normalized.includes('active')

    return {
      authenticated: authenticated || null,
      detail: authenticated ? successLabel : fallbackLabel,
    }
  } catch {
    return {
      authenticated: null,
      detail: fallbackLabel,
    }
  }
}

function buildToolStatus(binary: 'claude' | 'codex'): ToolStatus {
  const version = detectVersion(`${binary} --version`)
  if (!version) {
    return {
      available: false,
      version: null,
      authenticated: null,
      detail: `${binary} CLI nicht im PATH gefunden.`,
    }
  }

  const auth = binary === 'claude'
    ? detectAuth('claude auth status', 'Claude CLI ist installiert und authentifiziert.', 'Claude CLI ist installiert. Bitte Login/Subscription prüfen.')
    : detectAuth('codex auth status', 'Codex CLI ist installiert und authentifiziert.', 'Codex CLI ist installiert. Bitte Login/Subscription prüfen.')

  return {
    available: true,
    version,
    authenticated: auth.authenticated,
    detail: auth.detail,
  }
}

export async function GET(): Promise<NextResponse<CliStatusResponse>> {
  const claude = buildToolStatus('claude')
  const codex = buildToolStatus('codex')
  const { ANTHROPIC_API_KEY, OPENAI_API_KEY } = readStoredApiKeys()
  const claudeApiKeySet = Boolean(ANTHROPIC_API_KEY?.trim())
  const openAiApiKeySet = Boolean(OPENAI_API_KEY?.trim())
  const zeroKeyReady = claude.available || codex.available

  const activeMode: ActiveMode = claude.available
    ? 'claude-cli'
    : codex.available
      ? 'codex-cli'
      : claudeApiKeySet
        ? 'claude-api'
        : openAiApiKeySet
          ? 'openai-api'
          : 'simulation'

  const recommendation = zeroKeyReady
    ? 'Zero-Key-Ausführung ist möglich. API-Keys bleiben optional.'
    : 'Installiere und authentifiziere Claude Code oder Codex CLI, um ohne API-Key echten Code auszuführen.'

  return NextResponse.json({
    claudeCliAvailable: claude.available,
    claudeCliVersion: claude.version,
    codexCliAvailable: codex.available,
    codexCliVersion: codex.version,
    claudeApiKeySet,
    openAiApiKeySet,
    apiKeysOptional: true,
    zeroKeyReady,
    activeMode,
    claude,
    codex,
    recommendation,
    setupUrl: 'https://claude.ai/code',
  })
}
