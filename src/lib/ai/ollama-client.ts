import { readStoredApiKeys } from '@/lib/connectors/config'

export function getOllamaBaseUrl(): string {
  return (process.env.OLLAMA_BASE_URL ?? readStoredApiKeys().OLLAMA_BASE_URL ?? 'http://localhost:11434').replace(/\/+$/, '')
}

interface OllamaChatPayload {
  model: string
  messages: Array<{ role: string; content: string }>
  stream: boolean
  options?: Record<string, unknown>
}

interface OllamaChatResponse {
  message?: { content?: string }
  prompt_eval_count?: number
  eval_count?: number
  error?: string
}

interface OllamaEmbedPayload {
  model: string
  input: string
}

interface OllamaEmbedResponse {
  embeddings?: number[][]
  error?: string
}

export async function ollamaChat(
  model: string,
  system: string,
  user: string,
  maxTokens = 512,
  timeoutMs = 30000,
): Promise<{ text: string; inputTokens?: number; outputTokens?: number }> {
  const baseUrl = getOllamaBaseUrl()
  const payload: OllamaChatPayload = {
    model,
    stream: false,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    options: { num_predict: maxTokens, temperature: 0.1 },
  }

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!res.ok) throw new Error(`Ollama chat failed: HTTP ${res.status}`)

  const data = await res.json() as OllamaChatResponse
  if (data.error) throw new Error(data.error)
  const text = data.message?.content?.trim()
  if (!text) throw new Error('Ollama returned empty response')

  return { text, inputTokens: data.prompt_eval_count, outputTokens: data.eval_count }
}

export async function ollamaEmbed(
  model: string,
  text: string,
  timeoutMs = 10000,
): Promise<number[]> {
  const baseUrl = getOllamaBaseUrl()
  const payload: OllamaEmbedPayload = { model, input: text }

  const res = await fetch(`${baseUrl}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!res.ok) throw new Error(`Ollama embed failed: HTTP ${res.status}`)

  const data = await res.json() as OllamaEmbedResponse
  if (data.error) throw new Error(data.error)
  if (!data.embeddings?.[0]) throw new Error('Ollama embed returned no vector')

  return data.embeddings[0]
}
