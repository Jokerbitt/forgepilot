import { NextResponse } from 'next/server'

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
  defaultPrivacyMode: 'local-only' | 'hybrid' | 'cloud-approved'
  checkedAt: string
}

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
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY)
  return {
    name: 'Anthropic',
    status: hasKey ? 'healthy' : 'offline',
    detail: hasKey ? 'API Key konfiguriert' : 'Kein API Key',
  }
}

function checkClaudeCode(): ProviderStatus {
  return {
    name: 'Claude Code',
    status: 'healthy',
    detail: 'Desktop Agent aktiv',
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

export async function GET() {
  const [ollama, anthropic] = await Promise.all([
    checkOllama(getOllamaEndpoint()),
    Promise.resolve(checkAnthropic()),
  ])
  const claudeCode = checkClaudeCode()

  const result: LocalAIStatusResult = {
    ollama,
    anthropic,
    claudeCode,
    defaultPrivacyMode: getDefaultPrivacyMode(),
    checkedAt: new Date().toISOString(),
  }

  return NextResponse.json(result)
}
