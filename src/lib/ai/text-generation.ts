/**
 * text-generation.ts — Unified AI generation entry point.
 *
 * Routes requests to the active provider based on user configuration.
 * Supports Anthropic, OpenAI, Groq, Mistral, Gemini, Ollama, LM Studio,
 * Together AI, and any custom OpenAI-compatible endpoint.
 *
 * Backward-compatible: existing callers pass the same options as before.
 */

import * as Sentry from '@sentry/nextjs'
import { readStoredApiKeys } from '@/lib/connectors/config'
import { getModelSelection, getAllProviderConfigs } from '@/lib/ai/providers/config-store'
import { getProviderInstance } from '@/lib/ai/providers/registry'
import type { AIProviderConfig } from '@/lib/ai/providers/types'
import { logProcessing } from '@/lib/dsgvo/processing-ledger'
import { aiLogger } from '@/lib/logger'

type ModelPurpose = 'fast' | 'coding'

interface GenerateTextOptions {
  system: string
  prompt: string
  maxTokens: number
  purpose?: ModelPurpose
  /** Override the resolved model (e.g. 'claude-haiku-4-5') */
  anthropicModel?: string
  /** Override provider id entirely */
  providerId?: string
}

export interface GenerateTextResult {
  text: string
  provider: string
  model: string
  inputTokens?: number
  outputTokens?: number
}

export class AIProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AIProviderConfigurationError'
  }
}

export async function generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
  const selection = getModelSelection()
  const purpose   = options.purpose ?? 'fast'

  // Resolve which provider + model to use
  const providerId = options.providerId
    ?? (purpose === 'coding' ? selection.codingProvider : selection.fastProvider)

  const modelId = options.anthropicModel
    ?? (purpose === 'coding' ? selection.codingModel : selection.fastModel)

  // Look up provider config for API key + base URL
  const allConfigs = getAllProviderConfigs()
  const config     = allConfigs.find(c => c.id === providerId)

  if (!config) {
    throw new AIProviderConfigurationError(
      `AI provider "${providerId}" not found. Configure it in Settings → AI Providers.`
    )
  }

  const apiKey  = resolveApiKey(config)
  const baseUrl = config.baseUrl

  // Get provider instance
  const provider = getProviderInstance(providerId)
  if (!provider) {
    throw new AIProviderConfigurationError(`Provider instance for "${providerId}" not registered.`)
  }

  return Sentry.startSpan(
    { name: 'ai.generate', op: 'ai', attributes: { provider: providerId, model: modelId } },
    async () => {
      const t0 = Date.now()

      const result = await provider.generateText({
        system: options.system,
        prompt: options.prompt,
        maxTokens: options.maxTokens,
        model: modelId,
        apiKey,
        baseUrl,
      })

      const durationMs = Date.now() - t0
      aiLogger.info({
        event: 'ai.generate',
        provider: providerId,
        model: modelId,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        durationMs,
      })

      // DSGVO Art. 30 — log every AI processing event (fire-and-forget)
      void logProcessing({
        purpose:      `generateText:${purpose}`,
        dataTypes:    ['user-prompt', 'system-prompt'],
        providerId,
        modelId,
        legalBasis:   'legitimate-interest',
        inputTokens:  result.inputTokens,
        piiRedacted:  false,  // PII scrubbing happens upstream in context-engineer
      })

      return {
        text: result.text,
        provider: result.providerId,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      }
    },
  )
}

export async function generateEmbedding(
  text: string,
  options?: { providerId?: string; model?: string }
): Promise<number[]> {
  const selection   = getModelSelection()
  const providerId  = options?.providerId ?? selection.embeddingProvider ?? 'openai'
  const allConfigs  = getAllProviderConfigs()
  const config      = allConfigs.find(c => c.id === providerId)

  if (!config) {
    throw new AIProviderConfigurationError(
      `Embedding provider "${providerId}" not found. Configure it in Settings → AI Providers.`
    )
  }

  const provider = getProviderInstance(providerId)
  if (!provider || !provider.supportsEmbeddings || !provider.generateEmbedding) {
    throw new AIProviderConfigurationError(
      `Provider "${providerId}" does not support embeddings.`
    )
  }

  const model  = options?.model ?? config.models.find(m => m.purpose === 'embedding')?.id ?? 'text-embedding-3-small'
  const apiKey = resolveApiKey(config)

  const result = await provider.generateEmbedding(text, {
    system: '',
    prompt: text,
    maxTokens: 0,
    model,
    apiKey,
    baseUrl: config.baseUrl,
  })

  return result.embedding
}

function resolveApiKey(config: AIProviderConfig): string {
  if (!config.apiKeyRef) return ''   // local providers (Ollama, LM Studio)
  const stored = readStoredApiKeys()
  return (
    process.env[config.apiKeyRef]
    ?? (stored as Record<string, string | undefined>)[config.apiKeyRef]
    ?? ''
  )
}

export function stripJsonCodeFence(value: string): string {
  return value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}
