import { NextResponse } from 'next/server'
import { checkOllamaHealth, checkAnthropicHealth } from '@/lib/model-router/health'
import { readStoredApiKeys } from '@/lib/connectors/config'
import { getNBAConfig } from '@/lib/nba-engine/nba-config'

export async function GET() {
  const config = getNBAConfig()
  const keys = readStoredApiKeys()
  const ollamaEndpoint =
    process.env.OLLAMA_BASE_URL ?? keys.OLLAMA_BASE_URL ?? 'http://localhost:11434'

  const [ollama, anthropic] = await Promise.all([
    checkOllamaHealth(ollamaEndpoint),
    checkAnthropicHealth(),
  ])

  const preferred = config.aiProvider === 'ollama' ? 'ollama' : 'anthropic'

  return NextResponse.json({ preferred, providers: { ollama, anthropic } })
}
