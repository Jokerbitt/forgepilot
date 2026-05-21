import { aiLogger } from '@/lib/logger'

export interface FallbackOptions {
  primaryProviderId: string
  fallbackProviderId?: string
}

/**
 * Get fallback provider ID from env.
 * FORGEPILOT_FALLBACK_PROVIDER=openai (or any registered provider ID)
 */
export function getFallbackProviderId(): string | undefined {
  return process.env.FORGEPILOT_FALLBACK_PROVIDER ?? undefined
}

/**
 * Run primary provider call, fall back to secondary on failure.
 * Returns { result, usedFallback: boolean }
 */
export async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: (() => Promise<T>) | undefined,
  context: { primaryId: string; fallbackId?: string }
): Promise<{ result: T; usedFallback: boolean }> {
  try {
    const result = await primary()
    return { result, usedFallback: false }
  } catch (primaryError) {
    if (!fallback) {
      throw primaryError
    }

    aiLogger.warn(
      {
        event: 'ai.fallback',
        primaryId: context.primaryId,
        fallbackId: context.fallbackId,
        error: primaryError instanceof Error ? primaryError.message : String(primaryError),
      },
      'Primary AI provider failed, using fallback'
    )

    try {
      const result = await fallback()
      return { result, usedFallback: true }
    } catch (fallbackError) {
      aiLogger.error(
        {
          event: 'ai.fallback.failed',
          error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
        },
        'Fallback AI provider also failed'
      )
      throw fallbackError
    }
  }
}
