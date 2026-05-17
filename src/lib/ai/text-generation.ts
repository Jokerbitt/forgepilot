import Anthropic from '@anthropic-ai/sdk'
import { readStoredApiKeys } from '@/lib/connectors/config'
import { getNBAConfig } from '@/lib/nba-engine/nba-config'

type ModelPurpose = 'fast' | 'coding'

interface GenerateTextOptions {
  system: string
  prompt: string
  maxTokens: number
  purpose?: ModelPurpose
  anthropicModel?: string
}

export interface GenerateTextResult {
  text: string
  provider: 'anthropic' | 'ollama'
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

interface OllamaChatResponse {
  message?: {
    content?: string
  }
  prompt_eval_count?: number
  eval_count?: number
  error?: string
}

export async function generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
  const config = getNBAConfig()

  if (config.aiProvider === 'ollama') {
    return generateWithOllama(options, options.purpose === 'fast' ? config.localFastModel : config.localCodingModel)
  }

  return generateWithAnthropic(options, options.anthropicModel ?? 'claude-haiku-4-5')
}

async function generateWithAnthropic(
  options: GenerateTextOptions,
  model: string,
): Promise<GenerateTextResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? readStoredApiKeys().ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new AIProviderConfigurationError('ANTHROPIC_API_KEY not configured')
  }

  const client = new Anthropic({ apiKey })
  const message = await client.messages.create({
    model,
    max_tokens: options.maxTokens,
    system: options.system,
    messages: [{ role: 'user', content: options.prompt }],
  })

  const text = message.content[0]?.type === 'text' ? message.content[0].text.trim() : ''

  return {
    text,
    provider: 'anthropic',
    model,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  }
}

async function generateWithOllama(
  options: GenerateTextOptions,
  model: string,
): Promise<GenerateTextResult> {
  const baseUrl = normalizeBaseUrl(process.env.OLLAMA_BASE_URL ?? readStoredApiKeys().OLLAMA_BASE_URL ?? 'http://localhost:11434')
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: 'system', content: options.system },
        { role: 'user', content: options.prompt },
      ],
      options: {
        num_predict: options.maxTokens,
        temperature: 0.2,
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Ollama request failed with HTTP ${response.status}`)
  }

  const data = await response.json() as OllamaChatResponse
  if (data.error) {
    throw new Error(data.error)
  }

  const text = data.message?.content?.trim()
  if (!text) {
    throw new Error('Ollama returned an empty response')
  }

  return {
    text,
    provider: 'ollama',
    model,
    inputTokens: data.prompt_eval_count,
    outputTokens: data.eval_count,
  }
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '')
}

export function stripJsonCodeFence(value: string): string {
  return value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}
