/**
 * Rate Limiter — M102
 *
 * Simple in-memory rate limiter for Next.js API routes.
 * Uses a sliding-window approach per client identifier.
 *
 * Design:
 * - Per-IP counters stored in a Map (resets on server restart)
 * - Sliding window: tracks request timestamps in the last N seconds
 * - Returns { allowed, retryAfter } — route decides how to respond
 *
 * Usage:
 *   const check = rateLimiter.check(request, { limit: 100, windowSec: 60 })
 *   if (!check.allowed) return rateLimitResponse(check.retryAfter)
 */

import { type NextRequest } from 'next/server'

export interface RateLimitResult {
  allowed: boolean
  /** Seconds until the client may retry (only set when allowed === false) */
  retryAfter?: number
  /** Requests remaining in the current window */
  remaining: number
  /** Total limit for this window */
  limit: number
}

export interface RateLimitOptions {
  /** Max requests per window (default: 100) */
  limit?: number
  /** Window duration in seconds (default: 60) */
  windowSec?: number
  /** Custom key prefix (default: 'ip') */
  keyPrefix?: string
}

interface WindowEntry {
  timestamps: number[]
}

/**
 * In-memory rate limiter store.
 * One instance is shared across the module lifecycle.
 */
class RateLimiterStore {
  private readonly store = new Map<string, WindowEntry>()
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor() {
    // Clean up stale entries every 5 minutes
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000)
      // Don't prevent process exit
      if (this.cleanupInterval?.unref) {
        this.cleanupInterval.unref()
      }
    }
  }

  check(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now()
    const windowStart = now - windowMs

    let entry = this.store.get(key)
    if (!entry) {
      entry = { timestamps: [] }
      this.store.set(key, entry)
    }

    // Remove timestamps outside the window
    entry.timestamps = entry.timestamps.filter((t) => t > windowStart)

    const count = entry.timestamps.length

    if (count >= limit) {
      // Calculate when the oldest request falls out of the window
      const oldest = entry.timestamps[0]
      const retryAfter = Math.ceil((oldest + windowMs - now) / 1000)
      return {
        allowed: false,
        retryAfter: Math.max(1, retryAfter),
        remaining: 0,
        limit,
      }
    }

    entry.timestamps.push(now)
    return {
      allowed: true,
      remaining: limit - count - 1,
      limit,
    }
  }

  /** Remove all entries older than 1 hour */
  private cleanup(): void {
    const cutoff = Date.now() - 60 * 60 * 1000
    const keysToDelete: string[] = []
    this.store.forEach((entry, key) => {
      const lastSeen = entry.timestamps.at(-1)
      if (!lastSeen || lastSeen < cutoff) keysToDelete.push(key)
    })
    keysToDelete.forEach((key) => this.store.delete(key))
  }

  /** Reset for testing */
  reset(): void {
    this.store.clear()
  }

  /** Number of tracked keys (for monitoring) */
  get size(): number {
    return this.store.size
  }
}

// Singleton — shared across requests in the same process
export const rateLimiterStore = new RateLimiterStore()

/**
 * Extract a client identifier from a request.
 * Uses X-Forwarded-For (Vercel/proxy) or the connection IP.
 */
export function getClientKey(request: NextRequest, prefix = 'ip'): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const ip = forwarded ? forwarded.split(',')[0].trim() : (realIp ?? 'unknown')
  return `${prefix}:${ip}`
}

/**
 * Check rate limit for a request.
 *
 * @example
 * const check = checkRateLimit(request, { limit: 100, windowSec: 60 })
 * if (!check.allowed) {
 *   return NextResponse.json({ error: 'Too many requests' }, {
 *     status: 429,
 *     headers: { 'Retry-After': String(check.retryAfter) }
 *   })
 * }
 */
export function checkRateLimit(
  request: NextRequest,
  options: RateLimitOptions = {},
): RateLimitResult {
  const { limit = 100, windowSec = 60, keyPrefix = 'ip' } = options
  const key = getClientKey(request, keyPrefix)
  return rateLimiterStore.check(key, limit, windowSec * 1000)
}

/**
 * Build a standard 429 response with Retry-After and rate limit headers.
 */
export function buildRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
  }
  if (result.retryAfter !== undefined) {
    headers['Retry-After'] = String(result.retryAfter)
    headers['X-RateLimit-Reset'] = String(Math.floor(Date.now() / 1000) + result.retryAfter)
  }
  return headers
}

// ─── Tier-based rate limiting (M189) ─────────────────────────────────────────

/** Tier-based limits for different route categories. */
export const RATE_LIMIT_TIERS = {
  /** Expensive AI/execution routes — strictly limited */
  expensive: { limit: 10, windowMs: 60_000 },
  /** Standard API calls (CRUD, reads) */
  standard: { limit: 60, windowMs: 60_000 },
  /** Auth routes — very strictly limited */
  auth: { limit: 5, windowMs: 60_000 },
} as const

export type RateLimitTier = keyof typeof RATE_LIMIT_TIERS

/** Maps route path patterns to their rate limit tier. */
export const ROUTE_TIERS: Record<string, RateLimitTier> = {
  '/api/delegations/[id]/execute': 'expensive',
  '/api/delegations/[id]/critic-review': 'expensive',
  '/api/project-briefs/[id]/research-run': 'expensive',
  '/api/project-briefs/ai-suggest': 'expensive',
  '/api/ai/generate': 'expensive',
  '/api/pilot/idea-to-production': 'expensive',
  '/api/pilot/auto-run': 'expensive',
  '/api/auth': 'auth',
}

/**
 * Gets the rate limit tier for a given pathname.
 * Tries exact match first, then prefix match for dynamic segments.
 * Falls back to 'standard' for unmatched routes.
 */
export function getTierForPath(pathname: string): RateLimitTier {
  // Exact match first
  if (ROUTE_TIERS[pathname]) return ROUTE_TIERS[pathname]
  // Prefix match: the pattern base (everything up to the first dynamic segment)
  // must be followed by a '/' in the pathname so that '/api/delegations' does
  // not accidentally match '/api/delegations/[id]/execute'.
  for (const [pattern, tier] of Object.entries(ROUTE_TIERS)) {
    const base = pattern.includes('/[') ? pattern.split('/[')[0] : pattern
    if (pathname.startsWith(base + '/')) return tier
  }
  return 'standard'
}
