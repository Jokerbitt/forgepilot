export const dynamic = 'force-dynamic'
/**
 * POST /api/ai/chat-test
 *
 * Interactive AI test endpoint — lets users verify any configured provider
 * and model by sending a prompt and seeing the response + latency.
 *
 * Body: { providerId, modelId, prompt, systemPrompt? }
 */

import { NextResponse } from 'next/server'
import { getAllProviderConfigs } from '@/lib/ai/providers/config-store'
import { getProviderInstance } from '@/lib/ai/providers/registry'
import { readStoredApiKeys } from '@/lib/connectors/config'
import { aiLogger } from '@/lib/logger'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { ChatTestSchema } from '@/lib/validation/schemas'

interface ChatTestBody {
  providerId: string
  modelId: string
  prompt: string
  systemPrompt?: string
  maxTokens?: number
}

interface ChatTestResult {
  ok: true
  text: string
  providerId: string
  providerName: string
  modelId: string
  latencyMs: number
  inputTokens?: number
  outputTokens?: number
}

interface ChatTestError {
  ok: false
  error: string
}

export async function POST(request: Request): Promise<NextResponse<ChatTestResult | ChatTestError>> {
  const result = await parseBody(request, ChatTestSchema)
  if (isValidationError(result)) return result as NextResponse<ChatTestError>

  const { providerId, modelId, prompt, systemPrompt, maxTokens } = result

  const configs  = getAllProviderConfigs()
  const config   = configs.find(c => c.id === providerId)
  if (!config)   return NextResponse.json({ ok: false, error: `Provider "${providerId}" not found` }, { status: 404 })

  const provider = getProviderInstance(providerId)
  if (!provider) return NextResponse.json({ ok: false, error: `Provider "${providerId}" not registered` }, { status: 404 })

  const stored  = readStoredApiKeys() as Record<string, string | undefined>
  const apiKey  = config.apiKeyRef
    ? (process.env[config.apiKeyRef] ?? stored[config.apiKeyRef] ?? '')
    : 'dummy'

  const startMs = Date.now()
  try {
    const result = await provider.generateText({
      system:    systemPrompt ?? 'You are a helpful assistant.',
      prompt,
      maxTokens: maxTokens ?? 256,
      model:     modelId,
      apiKey,
      baseUrl:   config.baseUrl,
    })

    const latencyMs = Date.now() - startMs
    aiLogger.info({ event: 'ai.chat-test', providerId, modelId, latencyMs, inputTokens: result.inputTokens })

    return NextResponse.json({
      ok: true,
      text:         result.text,
      providerId:   result.providerId,
      providerName: config.name,
      modelId:      result.model,
      latencyMs,
      inputTokens:  result.inputTokens,
      outputTokens: result.outputTokens,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    aiLogger.warn({ event: 'ai.chat-test.error', providerId, modelId, error: msg })
    return NextResponse.json({ ok: false, error: msg }, { status: 502 })
  }
}
