/**
 * OpenAI-Compatible Provider
 *
 * Covers: OpenAI, Groq, Mistral, Google Gemini, Together AI,
 * LM Studio, Azure OpenAI, Perplexity, and any custom endpoint.
 *
 * Uses the official `openai` SDK which works with all OpenAI-compatible APIs
 * by overriding `baseURL`.
 */

import OpenAI from 'openai'
import type {
  AIProvider,
  ProviderEmbeddingResult,
  ProviderGenerateOptions,
  ProviderGenerateResult,
} from './types'

export class OpenAICompatibleProvider implements AIProvider {
  readonly id: string
  readonly name: string
  readonly type = 'openai-compatible' as const
  readonly supportsEmbeddings: boolean

  constructor(id: string, name: string, supportsEmbeddings = true) {
    this.id = id
    this.name = name
    this.supportsEmbeddings = supportsEmbeddings
  }

  private makeClient(apiKey: string, baseUrl?: string): OpenAI {
    return new OpenAI({
      apiKey,
      ...(baseUrl ? { baseURL: baseUrl } : {}),
    })
  }

  async generateText(options: ProviderGenerateOptions): Promise<ProviderGenerateResult> {
    const apiKey = options.apiKey ?? 'dummy'  // LM Studio / Ollama compat endpoints don't need key
    const client = this.makeClient(apiKey, options.baseUrl)

    const completion = await client.chat.completions.create({
      model: options.model,
      max_tokens: options.maxTokens,
      messages: [
        { role: 'system', content: options.system },
        { role: 'user', content: options.prompt },
      ],
      temperature: 0.2,
    })

    const text = completion.choices[0]?.message?.content?.trim() ?? ''
    return {
      text,
      providerId: this.id,
      model: options.model,
      inputTokens: completion.usage?.prompt_tokens,
      outputTokens: completion.usage?.completion_tokens,
    }
  }

  async generateEmbedding(text: string, options: ProviderGenerateOptions): Promise<ProviderEmbeddingResult> {
    const apiKey = options.apiKey ?? 'dummy'
    const client = this.makeClient(apiKey, options.baseUrl)

    const response = await client.embeddings.create({
      model: options.model,
      input: text,
    })

    return {
      embedding: response.data[0]?.embedding ?? [],
      model: options.model,
      inputTokens: response.usage?.prompt_tokens,
    }
  }

  async isAvailable(apiKey?: string, baseUrl?: string): Promise<boolean> {
    const key = apiKey ?? 'dummy'
    try {
      const client = this.makeClient(key, baseUrl)
      const models = await client.models.list()
      return models.data.length >= 0  // just check we can connect
    } catch {
      return false
    }
  }
}
