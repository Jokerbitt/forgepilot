// Local Ollama provider implementing AIProvider (http://localhost:11434).
// Destination: src/lib/ai/ollama-provider.ts

import type { AIProvider, AIResult, GenerateOptions } from './provider-types';

/** Subset of the Ollama /api/generate response we rely on. */
interface OllamaGenerateResponse {
  response: string;
  model: string;
  done: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
}

/** Subset of the Ollama /api/tags response. */
interface OllamaTagsResponse {
  models: Array<{ name: string }>;
}

const DEFAULT_HOST = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.2';

export class OllamaProvider implements AIProvider {
  readonly id = 'ollama';
  readonly name = 'Ollama (local)';
  readonly kind = 'local' as const;

  private readonly host: string;
  private readonly model: string;

  constructor(opts?: { host?: string; model?: string }) {
    this.host = opts?.host ?? process.env.OLLAMA_HOST ?? DEFAULT_HOST;
    this.model = opts?.model ?? process.env.OLLAMA_MODEL ?? DEFAULT_MODEL;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.host}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as OllamaTagsResponse;
      return Array.isArray(data.models);
    } catch {
      return false;
    }
  }

  async generate(opts: GenerateOptions): Promise<AIResult> {
    const res = await fetch(`${this.host}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: opts.prompt,
        system: opts.system,
        stream: false,
        options: { num_predict: opts.maxTokens },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      throw new Error(`Ollama generate failed (${res.status}): ${detail}`);
    }

    const data = (await res.json()) as OllamaGenerateResponse;

    return {
      text: data.response,
      provider: this.id,
      model: data.model || this.model,
      inputTokens: data.prompt_eval_count,
      outputTokens: data.eval_count,
    };
  }
}
