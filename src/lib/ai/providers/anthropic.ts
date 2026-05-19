import Anthropic from '@anthropic-ai/sdk'
import type { AIProvider, ProviderGenerateOptions, ProviderGenerateResult } from './types'

export class AnthropicProvider implements AIProvider {
  readonly id = 'anthropic'
  readonly name = 'Anthropic'
  readonly type = 'anthropic' as const
  readonly supportsEmbeddings = false

  async generateText(options: ProviderGenerateOptions): Promise<ProviderGenerateResult> {
    if (!options.apiKey) throw new Error('Anthropic API key not configured')

    const client = new Anthropic({ apiKey: options.apiKey })
    const message = await client.messages.create({
      model: options.model,
      max_tokens: options.maxTokens,
      system: options.system,
      messages: [{ role: 'user', content: options.prompt }],
    })

    const text = message.content[0]?.type === 'text' ? message.content[0].text.trim() : ''
    return {
      text,
      providerId: this.id,
      model: options.model,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    }
  }

  async isAvailable(apiKey?: string): Promise<boolean> {
    if (!apiKey) return false
    try {
      const client = new Anthropic({ apiKey })
      await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'ping' }],
      })
      return true
    } catch {
      return false
    }
  }
}
