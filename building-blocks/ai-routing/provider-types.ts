// Core AI provider abstraction types shared by every provider and the router.
// Destination: src/lib/ai/provider-types.ts

/**
 * What a single generation call needs.
 */
export interface GenerateOptions {
  /** Optional system / instruction message. */
  system?: string;
  /** The user prompt. Required. */
  prompt: string;
  /** Hard cap on tokens the model may produce. */
  maxTokens: number;
  /**
   * Hint to the router which class of model to pick.
   * - 'fast'   → cheap, low-latency model (summaries, classification, chat).
   * - 'coding' → stronger reasoning model (code, complex tasks).
   * Defaults to 'fast' when omitted.
   */
  purpose?: 'fast' | 'coding';
}

/**
 * Normalized result returned by every provider, regardless of vendor.
 */
export interface AIResult {
  /** The generated text. */
  text: string;
  /** Provider id that produced the result (e.g. 'ollama', 'anthropic'). */
  provider: string;
  /** Concrete model name used (e.g. 'llama3.2', 'claude-sonnet-4-5'). */
  model: string;
  /** Prompt tokens, if the provider reports them. */
  inputTokens?: number;
  /** Completion tokens, if the provider reports them. */
  outputTokens?: number;
}

/**
 * A pluggable AI backend. Implement this once per vendor; the router treats
 * all providers uniformly.
 */
export interface AIProvider {
  /** Stable machine id, e.g. 'ollama'. */
  readonly id: string;
  /** Human-readable name, e.g. 'Ollama (local)'. */
  readonly name: string;
  /** Where the model runs. Used by the router to prefer local for privacy/cost. */
  readonly kind: 'local' | 'cloud';
  /** Run a single generation. Should throw on transport/API errors. */
  generate(opts: GenerateOptions): Promise<AIResult>;
  /**
   * Cheap liveness/readiness probe. Must not throw — return false on any
   * failure (missing key, unreachable host, etc.).
   */
  isAvailable(): Promise<boolean>;
}
