/**
 * GET /api/ai/status
 *
 * Returns the current AI provider status:
 * - which providers are configured / running
 * - which one is active
 * - providerAvailability[] — full scan of all known providers
 * - resolvedProvider — the provider that would be used right now
 * - a human-readable recommendation
 */

import { NextResponse } from 'next/server'
import { isOllamaRunning, getAvailableOllamaModels, PREFERRED_MODELS } from '@/lib/ai/ollama-client'
import { readStoredApiKeys } from '@/lib/connectors/config'
import { resolveProvider, getProviderAvailability, getCurrentLlmMode } from '@/lib/ai/auto-router'
import type { ResolvedProvider, ProviderAvailability } from '@/lib/ai/auto-router'

export const dynamic = 'force-dynamic'

export interface AIStatus {
  anthropicConfigured: boolean
  ollamaRunning: boolean
  ollamaModels: string[]
  activeProvider: string
  activeModel: string | null
  recommendation: string
  /** Current value of LLM_MODE env var (defaults to "auto") */
  llmMode: string
  /** Full availability scan for all known providers */
  providerAvailability: ProviderAvailability[]
  /** The provider that will actually be used given current config + LLM_MODE */
  resolvedProvider: ResolvedProvider
}

export async function GET(): Promise<NextResponse<AIStatus>> {
  const stored = readStoredApiKeys() as Record<string, string | undefined>
  const anthropicKey =
    process.env.ANTHROPIC_API_KEY ??
    stored['ANTHROPIC_API_KEY'] ??
    ''

  const anthropicConfigured = anthropicKey.length > 0

  const [ollamaRunning, ollamaModels, providerAvailability, resolvedProv] = await Promise.all([
    isOllamaRunning(),
    isOllamaRunning().then(running =>
      running ? getAvailableOllamaModels() : []
    ),
    getProviderAvailability(),
    resolveProvider('fast'),
  ])

  // Determine active provider and model (legacy fields kept for backward compat)
  let activeProvider = resolvedProv.providerId === 'placeholder' ? 'none' : resolvedProv.providerId
  let activeModel: string | null = null
  let recommendation: string

  if (resolvedProv.providerId !== 'placeholder') {
    activeModel = resolvedProv.model === 'none' ? null : resolvedProv.model
    recommendation = resolvedProv.isLocal
      ? `${resolvedProv.providerId} ist aktiv (${resolvedProv.model}). Lokale KI wird bevorzugt genutzt.`
      : `${resolvedProv.providerId} ist aktiv (${resolvedProv.model}). Cloud wird nur nach Routing-Regel genutzt.`
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
    llmMode: getCurrentLlmMode(),
    providerAvailability,
    resolvedProvider: resolvedProv,
  })
}
