/**
 * GET /api/ai/status
 *
 * Returns the current AI provider status:
 * - which providers are configured / running
 * - which one is active
 * - a human-readable recommendation
 */

import { NextResponse } from 'next/server'
import { isOllamaRunning, getAvailableOllamaModels, PREFERRED_MODELS } from '@/lib/ai/ollama-client'
import { readStoredApiKeys } from '@/lib/connectors/config'

export const dynamic = 'force-dynamic'

export interface AIStatus {
  anthropicConfigured: boolean
  ollamaRunning: boolean
  ollamaModels: string[]
  activeProvider: 'anthropic' | 'ollama' | 'none'
  activeModel: string | null
  recommendation: string
}

export async function GET(): Promise<NextResponse<AIStatus>> {
  const stored = readStoredApiKeys() as Record<string, string | undefined>
  const anthropicKey =
    process.env.ANTHROPIC_API_KEY ??
    stored['ANTHROPIC_API_KEY'] ??
    ''

  const anthropicConfigured = anthropicKey.length > 0

  const [ollamaRunning, ollamaModels] = await Promise.all([
    isOllamaRunning(),
    isOllamaRunning().then(running =>
      running ? getAvailableOllamaModels() : []
    ),
  ])

  // Determine active provider and model
  let activeProvider: AIStatus['activeProvider'] = 'none'
  let activeModel: string | null = null
  let recommendation: string

  if (anthropicConfigured) {
    activeProvider = 'anthropic'
    activeModel = null // model comes from provider config
    recommendation = ollamaRunning
      ? 'Anthropic API ist aktiv. Ollama läuft ebenfalls als Fallback.'
      : 'Anthropic API ist aktiv. Ollama kann zusätzlich lokal gestartet werden.'
  } else if (ollamaRunning && ollamaModels.length > 0) {
    activeProvider = 'ollama'
    // Pick best available model
    activeModel =
      PREFERRED_MODELS.find(preferred =>
        ollamaModels.some(a => a === preferred || a.startsWith(`${preferred}:`))
      ) ?? ollamaModels[0]
    recommendation = `Ollama ist aktiv (${ollamaModels.length} Modell${ollamaModels.length !== 1 ? 'e' : ''} installiert). KI-Features nutzen ${activeModel}.`
  } else if (ollamaRunning && ollamaModels.length === 0) {
    activeProvider = 'none'
    recommendation =
      'Ollama läuft, aber es sind keine Modelle installiert. Führe "ollama pull llama3.2" aus.'
  } else {
    activeProvider = 'none'
    recommendation =
      'Kein KI-Anbieter aktiv. Starte Ollama (kostenlos, lokal) oder hinterlege einen Anthropic API Key in den Einstellungen.'
  }

  return NextResponse.json({
    anthropicConfigured,
    ollamaRunning,
    ollamaModels,
    activeProvider,
    activeModel,
    recommendation,
  })
}
