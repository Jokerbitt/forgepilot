/**
 * Ollama Provider — local, privacy-first, no API key needed.
 * Compatible with any model pulled via `ollama pull <model>`.
 */

import type {
  AIProvider,
  ProviderEmbeddingResult,
  ProviderGenerateOptions,
  ProviderGenerateResult,
} from './types'

interface OllamaChatResponse {
  message?: { content?: string }
  prompt_eval_count?: number
  eval_count?: number
  error?: string
}

interface OllamaEmbedResponse {
  embedding?: number[]
  error?: string
}

export class OllamaProvider implements AIProvider {
  readonly id = 'ollama'
  readonly name = 'Ollama (Local)'
  readonly type = 'ollama' as const
  readonly supportsEmbeddings = true

  private normalizeUrl(url: string): string {
    return url.replace(/\/+$/, '')
  }

  async generateText(options: ProviderGenerateOptions): Promise<ProviderGenerateResult> {
    const baseUrl = this.normalizeUrl(options.baseUrl ?? 'http://localhost:11434')

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.model,
        stream: false,
        messages: [
          { role: 'system', content: options.system },
          { role: 'user', content: options.prompt },
        ],
        options: { num_predict: options.maxTokens, temperature: 0.2 },
      }),
    })

    if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`)
    const data = await response.json() as OllamaChatResponse
    if (data.error) throw new Error(data.error)

    return {
      text: data.message?.content?.trim() ?? '',
      providerId: this.id,
      model: options.model,
      inputTokens: data.prompt_eval_count,
      outputTokens: data.eval_count,
    }
  }

  async generateEmbedding(text: string, options: ProviderGenerateOptions): Promise<ProviderEmbeddingResult> {
    const baseUrl = this.normalizeUrl(options.baseUrl ?? 'http://localhost:11434')

    const response = await fetch(`${baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: options.model, prompt: text }),
    })

    if (!response.ok) throw new Error(`Ollama embeddings HTTP ${response.status}`)
    const data = await response.json() as OllamaEmbedResponse
    if (data.error) throw new Error(data.error)

    return { embedding: data.embedding ?? [], model: options.model }
  }

  async isAvailable(_apiKey?: string, baseUrl?: string): Promise<boolean> {
    const url = this.normalizeUrl(baseUrl ?? 'http://localhost:11434')
    try {
      const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(3000) })
      return res.ok
    } catch {
      return false
    }
  }
}
