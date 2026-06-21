// In-memory sliding-window rate limiter (single process).
// Destination: src/lib/ai/guardrails/rate-limit.ts
//
// NOTE: This stores timestamps in a process-local Map. It is correct for a
// single instance only. In production (multiple instances / serverless), back
// this with Redis (e.g. a sorted set per key) so the window is shared.

export interface RateLimitOptions {
  /** Max number of requests allowed within the window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** When blocked, ms until the oldest in-window hit expires. */
  retryAfterMs?: number;
}

/** key -> ascending list of hit timestamps (ms epoch) within the window. */
const hits = new Map<string, number[]>();

/**
 * Record-and-check a request for `key` against a sliding window.
 * Side effect: when allowed, the current timestamp is recorded.
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - options.windowMs;

  const existing = hits.get(key) ?? [];
  // Drop timestamps that have aged out of the window.
  const recent = existing.filter((ts) => ts > windowStart);

  if (recent.length >= options.max) {
    const oldest = recent[0];
    hits.set(key, recent);
    return { allowed: false, retryAfterMs: oldest + options.windowMs - now };
  }

  recent.push(now);
  hits.set(key, recent);
  return { allowed: true };
}

/** Clear state for one key, or the whole table. Useful in tests. */
export function resetRateLimit(key?: string): void {
  if (key === undefined) {
    hits.clear();
  } else {
    hits.delete(key);
  }
}
