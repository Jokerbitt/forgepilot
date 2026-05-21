import { aiLogger } from '@/lib/logger'

export interface RetryOptions {
  maxAttempts?: number
  initialDelayMs?: number
  maxDelayMs?: number
  shouldRetry?: (error: unknown, attempt: number) => boolean
}

const DEFAULT_RETRY_STATUS_CODES = new Set([429, 500, 502, 503, 529])

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    // Rate limit, overload, or server errors
    if (msg.includes('rate limit') || msg.includes('overloaded') || msg.includes('529')) return true
    if (msg.includes('timeout') || msg.includes('econnreset')) return true
  }
  // Check for HTTP status codes in error objects
  const statusError = error as { status?: number; statusCode?: number }
  const status = statusError.status ?? statusError.statusCode
  if (status !== undefined && DEFAULT_RETRY_STATUS_CODES.has(status)) return true
  return false
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10_000,
    shouldRetry = isRetryableError,
  } = options

  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt === maxAttempts || !shouldRetry(error, attempt)) {
        throw error
      }

      const delay = Math.min(initialDelayMs * Math.pow(2, attempt - 1), maxDelayMs)
      aiLogger.warn(
        {
          event: 'ai.retry',
          attempt,
          maxAttempts,
          delayMs: delay,
          error: error instanceof Error ? error.message : String(error),
        },
        `AI call failed, retrying in ${delay}ms`
      )
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}
