import type { ProviderHealthResult } from './types'

interface OllamaTagsResponse {
  models?: Array<{ name: string }>
}

export async function checkOllamaHealth(endpoint: string): Promise<ProviderHealthResult> {
  const start = Date.now()
  const normalizedEndpoint = endpoint.replace(/\/+$/, '')
  try {
    const res = await fetch(`${normalizedEndpoint}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    })
    const latencyMs = Date.now() - start

    if (!res.ok) {
      return {
        provider: 'ollama',
        endpoint: normalizedEndpoint,
        status: 'degraded',
        latencyMs,
        checkedAt: new Date().toISOString(),
        error: `HTTP ${res.status}`,
      }
    }

    const data = await res.json() as OllamaTagsResponse
    const availableModels = data.models?.map(m => m.name) ?? []

    return {
      provider: 'ollama',
      endpoint: normalizedEndpoint,
      status: 'healthy',
      latencyMs,
      availableModels,
      checkedAt: new Date().toISOString(),
    }
  } catch (err) {
    return {
      provider: 'ollama',
      endpoint: normalizedEndpoint,
      status: 'offline',
      latencyMs: Date.now() - start,
      checkedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

export async function checkAnthropicHealth(): Promise<ProviderHealthResult> {
  const hasKey =
    Boolean(process.env.ANTHROPIC_API_KEY) ||
    Boolean(process.env.NEXT_PUBLIC_HAS_ANTHROPIC_KEY)

  return {
    provider: 'anthropic',
    endpoint: 'https://api.anthropic.com',
    status: hasKey ? 'healthy' : 'offline',
    checkedAt: new Date().toISOString(),
    error: hasKey ? undefined : 'ANTHROPIC_API_KEY not configured',
  }
}
