// Cloud Anthropic provider implementing AIProvider via @anthropic-ai/sdk.
// Destination: src/lib/ai/anthropic-provider.ts

import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider, AIResult, GenerateOptions } from './provider-types';

/** Model used for 'coding' purpose (stronger reasoning). */
const CODING_MODEL = 'claude-sonnet-4-5';
/** Model used for 'fast' purpose (cheap, low-latency). */
const FAST_MODEL = 'claude-haiku-4-5';

export class AnthropicProvider implements AIProvider {
  readonly id = 'anthropic';
  readonly name = 'Anthropic (cloud)';
  readonly kind = 'cloud' as const;

  private readonly apiKey: string | undefined;
  private client: Anthropic | undefined;

  constructor(opts?: { apiKey?: string }) {
    this.apiKey = opts?.apiKey ?? process.env.ANTHROPIC_API_KEY;
  }

  async isAvailable(): Promise<boolean> {
    return typeof this.apiKey === 'string' && this.apiKey.length > 0;
  }

  private getClient(): Anthropic {
    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }
    if (!this.client) {
      this.client = new Anthropic({ apiKey: this.apiKey });
    }
    return this.client;
  }

  private modelFor(purpose: GenerateOptions['purpose']): string {
    return purpose === 'coding' ? CODING_MODEL : FAST_MODEL;
  }

  async generate(opts: GenerateOptions): Promise<AIResult> {
    const model = this.modelFor(opts.purpose);
    const client = this.getClient();

    const message = await client.messages.create({
      model,
      max_tokens: opts.maxTokens,
      system: opts.system,
      messages: [{ role: 'user', content: opts.prompt }],
    });

    // Concatenate text blocks; ignore non-text content (tool_use, etc.).
    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return {
      text,
      provider: this.id,
      model,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    };
  }
}
