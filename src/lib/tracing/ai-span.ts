import { tracer } from './tracer'

export async function withAISpan<T>(
  provider: string,
  model: string,
  fn: () => Promise<T>
): Promise<T> {
  return tracer.withSpan('ai.generate', { provider, model }, fn)
}
