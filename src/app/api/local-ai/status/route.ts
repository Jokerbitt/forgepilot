import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { readStoredApiKeys } from '@/lib/connectors/config'

export const dynamic = 'force-dynamic'

export interface ProviderStatus {
  name: string
  status: 'healthy' | 'degraded' | 'offline'
  detail: string
  models?: string[]
}

export interface LocalAIStatusResult {
  ollama: ProviderStatus
  anthropic: ProviderStatus
  claudeCode: ProviderStatus
  /** 'real' = claude CLI available + API key or Max subscription. 'simulation' = fallback mode. */
  executeMode: 'real' | 'simulation'
  /** Human-readable hint shown in UI when not fully ready */
  executeModeHint: string
  defaultPrivacyMode: 'local-only' | 'hybrid' | 'cloud-approved'
  checkedAt: string
}

interface ClaudeAuthInfo {
  loggedIn: boolean
  subscriptionType?: string
  authMethod?: string
}

type ClaudeCodeStatus = ProviderStatus & { authInfo?: ClaudeAuthInfo }

async function checkOllama(endpoint: string): Promise<ProviderStatus> {
  try {
    const base = endpoint.replace(/\/$/, '')
    const res = await fetch(`${base}/api/tags`, {
      signal: AbortSignal.timeout(3000),
      cache: 'no-store',
    })
    if (!res.ok) return { name: 'Ollama', status: 'degraded', detail: `HTTP ${res.status}` }
    const data = await res.json() as { models?: Array<{ name: string }> }
    const models = (data.models ?? []).map(m => m.name)
    return {
      name: 'Ollama',
      status: 'healthy',
      detail: `${models.length} Modell${models.length !== 1 ? 'e' : ''} verfügbar`,
      models: models.slice(0, 5),
    }
  } catch {
    return { name: 'Ollama', status: 'offline', detail: 'Nicht erreichbar' }
  }
}

function checkAnthropic(): ProviderStatus {
  const stored = readStoredApiKeys()
  const hasKey = Boolean((process.env.ANTHROPIC_API_KEY || stored.ANTHROPIC_API_KEY)?.trim())
  return {
    name: 'Anthropic',
    status: hasKey ? 'healthy' : 'offline',
    detail: hasKey ? 'API Key konfiguriert' : 'Kein API Key — unter /settings eintragen',
  }
}

function checkClaudeCode(): ClaudeCodeStatus {
  try {
    execSync('claude --version', { stdio: 'ignore', timeout: 3000 })
    // Check if authenticated with claude.ai (Max subscription = no API key needed)
    try {
      const raw = execSync('claude auth status --json', { timeout: 5000, encoding: 'utf8' })
      const auth = JSON.parse(raw.trim()) as ClaudeAuthInfo
      if (auth.loggedIn && auth.subscriptionType) {
        const label = auth.subscriptionType === 'max' ? 'Max aktiv' : auth.subscriptionType
        return {
          name: 'Claude Code',
          status: 'healthy',
          detail: `claude CLI — ${label}`,
          authInfo: auth,
        }
      }
    } catch {
      // auth status check failed — CLI exists but auth unknown
    }
    return { name: 'Claude Code', status: 'healthy', detail: 'claude CLI verfügbar' }
  } catch {
    return { name: 'Claude Code', status: 'offline', detail: 'claude CLI nicht installiert' }
  }
}

function getOllamaEndpoint(): string {
  return process.env.NEXT_PUBLIC_OLLAMA_ENDPOINT ?? process.env.OLLAMA_ENDPOINT ?? 'http://localhost:11434'
}

function getDefaultPrivacyMode(): LocalAIStatusResult['defaultPrivacyMode'] {
  const mode = process.env.DEFAULT_PRIVACY_MODE
  if (mode === 'local-only' || mode === 'cloud-approved') return mode
  return 'hybrid'
}

function deriveExecuteMode(
  anthropic: ProviderStatus,
  claudeCode: ClaudeCodeStatus,
): Pick<LocalAIStatusResult, 'executeMode' | 'executeModeHint'> {
  const cliReady = claudeCode.status === 'healthy'
  const keyReady = anthropic.status === 'healthy'
  // Max subscription via OAuth counts as credential — no API key required
  const maxSubscription = claudeCode.authInfo?.loggedIn === true && Boolean(claudeCode.authInfo?.subscriptionType)

  if (cliReady && (keyReady || maxSubscription)) {
    const label = maxSubscription && !keyReady
      ? `claude CLI (${claudeCode.authInfo?.subscriptionType ?? 'max'}) — kein API Key nötig`
      : 'claude CLI + API Key'
    return {
      executeMode: 'real',
      executeModeHint: `Echter Agent bereit — ${label}`,
    }
  }
  if (cliReady && !keyReady && !maxSubscription) {
    return {
      executeMode: 'simulation',
      executeModeHint: 'claude CLI bereit — fehlt: Anthropic-Guthaben aufladen oder API Key in Einstellungen setzen',
    }
  }
  if (!cliReady && keyReady) {
    return {
      executeMode: 'simulation',
      executeModeHint: 'API Key vorhanden — fehlt: claude CLI installieren (npm install -g @anthropic-ai/claude-code)',
    }
  }
  return {
    executeMode: 'simulation',
    executeModeHint: 'Simulation-Modus: claude CLI installieren + Anthropic-Guthaben aufladen',
  }
}

export async function GET() {
  const [ollama, anthropic] = await Promise.all([
    checkOllama(getOllamaEndpoint()),
    Promise.resolve(checkAnthropic()),
  ])
  const claudeCode = checkClaudeCode()
  const { executeMode, executeModeHint } = deriveExecuteMode(anthropic, claudeCode)

  const result: LocalAIStatusResult = {
    ollama,
    anthropic,
    claudeCode,
    executeMode,
    executeModeHint,
    defaultPrivacyMode: getDefaultPrivacyMode(),
    checkedAt: new Date().toISOString(),
  }

  return NextResponse.json(result)
}
