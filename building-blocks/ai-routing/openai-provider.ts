/**
 * OpenAI provider for the AI auto-router. Requires: npm i openai
 * Env: OPENAI_API_KEY, OPENAI_MODEL (default gpt-4o-mini)
 *
 * Implements the same AIProvider interface as the Anthropic/Ollama providers,
 * so the auto-router can prefer/fall back to it like any other provider.
 * Destination: src/lib/ai/openai-provider.ts
 */
import OpenAI from 'openai'
import type { AIProvider, AIResult, GenerateOptions } from './provider-types'

export class OpenAIProvider implements AIProvider {
  readonly id = 'openai'
  readonly name = 'OpenAI (cloud)'
  readonly kind = 'cloud' as const
  private client: OpenAI
  private model: string

  constructor(apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini') {
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set')
    this.client = new OpenAI({ apiKey })
    this.model = model
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(process.env.OPENAI_API_KEY)
  }

  async generate(opts: GenerateOptions): Promise<AIResult> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        ...(opts.system ? [{ role: 'system' as const, content: opts.system }] : []),
        { role: 'user' as const, content: opts.prompt },
      ],
      max_tokens: opts.maxTokens,
    })
    const choice = res.choices[0]
    return {
      text: choice?.message?.content ?? '',
      provider: this.id,
      model: this.model,
      inputTokens: res.usage?.prompt_tokens,
      outputTokens: res.usage?.completion_tokens,
    }
  }
}
