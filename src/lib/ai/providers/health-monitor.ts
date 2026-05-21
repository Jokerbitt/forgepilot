/**
 * AI Provider Health Monitor — M155
 *
 * Tracks the availability and latency of every configured AI provider.
 * Results are persisted in config/provider-health.json for UI display.
 *
 * Health is checked:
 * - On demand via POST /api/ai/providers/health
 * - Automatically after a failed AI call (lazy degradation detection)
 *
 * Status levels:
 *   healthy      — responded within 5s, last check ok
 *   degraded     — responded but slow (>3s), or last 2 checks had issues
 *   unavailable  — timed out or HTTP error
 *   unconfigured — no API key / not enabled
 */

import fs from 'fs'
import path from 'path'
import { getAllProviderConfigs } from './config-store'
import { getProviderInstance } from './registry'
import { readStoredApiKeys } from '@/lib/connectors/config'
import { logger } from '@/lib/logger'

const log = logger.child({ module: 'ai.health-monitor' })

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProviderHealthStatus = 'healthy' | 'degraded' | 'unavailable' | 'unconfigured'

export interface ProviderHealthEntry {
  providerId: string
  providerName: string
  status: ProviderHealthStatus
  latencyMs?: number
  checkedAt: string
  error?: string
  /** Consecutive failures since last healthy check */
  failStreak: number
}

export interface ProviderHealthReport {
  checkedAt: string
  providers: ProviderHealthEntry[]
  summary: {
    total: number
    healthy: number
    degraded: number
    unavailable: number
    unconfigured: number
  }
}

// ── Persistence ───────────────────────────────────────────────────────────────

const HEALTH_FILE = path.join(process.cwd(), 'config', 'provider-health.json')
const CHECK_TIMEOUT_MS = 8_000
const DEGRADED_THRESHOLD_MS = 3_000

function readHealthCache(): Record<string, ProviderHealthEntry> {
  try {
    return JSON.parse(fs.readFileSync(HEALTH_FILE, 'utf-8')) as Record<string, ProviderHealthEntry>
  } catch {
    return {}
  }
}

function writeHealthCache(entries: Record<string, ProviderHealthEntry>): void {
  const dir = path.dirname(HEALTH_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = `${HEALTH_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(entries, null, 2), 'utf-8')
  fs.renameSync(tmp, HEALTH_FILE)
}

// ── Single provider check ─────────────────────────────────────────────────────

async function checkProvider(
  config: { id: string; name: string; apiKeyRef: string; enabled: boolean },
  apiKey: string | undefined,
  existing: ProviderHealthEntry | undefined,
): Promise<ProviderHealthEntry> {
  const base: Omit<ProviderHealthEntry, 'status' | 'latencyMs' | 'error'> = {
    providerId: config.id,
    providerName: config.name,
    checkedAt: new Date().toISOString(),
    failStreak: existing?.failStreak ?? 0,
  }

  // Local providers (e.g. Ollama) have no apiKeyRef — they're always checked
  const needsApiKey = Boolean(config.apiKeyRef)
  if (!config.enabled || (needsApiKey && !apiKey)) {
    return { ...base, status: 'unconfigured', failStreak: 0 }
  }

  const provider = getProviderInstance(config.id)
  if (!provider) {
    return { ...base, status: 'unconfigured', failStreak: 0 }
  }

  const start = Date.now()
  try {
    const available = await Promise.race([
      provider.isAvailable(apiKey),
      new Promise<boolean>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), CHECK_TIMEOUT_MS),
      ),
    ])
    const latencyMs = Date.now() - start

    if (!available) {
      return {
        ...base,
        status: 'unavailable',
        latencyMs,
        failStreak: (existing?.failStreak ?? 0) + 1,
        error: 'Provider returned unavailable',
      }
    }

    const status: ProviderHealthStatus = latencyMs > DEGRADED_THRESHOLD_MS ? 'degraded' : 'healthy'
    return { ...base, status, latencyMs, failStreak: 0 }
  } catch (err) {
    const latencyMs = Date.now() - start
    const error = err instanceof Error ? err.message : String(err)
    return {
      ...base,
      status: 'unavailable',
      latencyMs,
      failStreak: (existing?.failStreak ?? 0) + 1,
      error,
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run a health check on all configured providers.
 * Results are persisted and returned as a full report.
 */
export async function runHealthCheck(): Promise<ProviderHealthReport> {
  const configs = getAllProviderConfigs()
  const apiKeys = readStoredApiKeys() as Record<string, string | undefined>
  const cache = readHealthCache()

  const results = await Promise.all(
    configs.map(c =>
      checkProvider(
        c,
        process.env[c.apiKeyRef] ?? apiKeys[c.apiKeyRef],
        cache[c.id],
      ),
    ),
  )

  const newCache: Record<string, ProviderHealthEntry> = {}
  for (const r of results) {
    newCache[r.providerId] = r
    if (r.failStreak >= 2 && (cache[r.providerId]?.failStreak ?? 0) < 2) {
      log.warn({ event: 'ai.provider.degraded', providerId: r.providerId, status: r.status, error: r.error })
    }
  }
  writeHealthCache(newCache)

  const summary = {
    total:        results.length,
    healthy:      results.filter(r => r.status === 'healthy').length,
    degraded:     results.filter(r => r.status === 'degraded').length,
    unavailable:  results.filter(r => r.status === 'unavailable').length,
    unconfigured: results.filter(r => r.status === 'unconfigured').length,
  }

  log.info({ event: 'ai.health_check.complete', ...summary })

  return { checkedAt: new Date().toISOString(), providers: results, summary }
}

/** Return the last cached health report without running new checks */
export function getCachedHealthReport(): ProviderHealthReport | null {
  const cache = readHealthCache()
  const entries = Object.values(cache)
  if (entries.length === 0) return null

  const summary = {
    total:        entries.length,
    healthy:      entries.filter(r => r.status === 'healthy').length,
    degraded:     entries.filter(r => r.status === 'degraded').length,
    unavailable:  entries.filter(r => r.status === 'unavailable').length,
    unconfigured: entries.filter(r => r.status === 'unconfigured').length,
  }
  const checkedAt = entries.reduce((a, b) => (a.checkedAt > b.checkedAt ? a : b)).checkedAt
  return { checkedAt, providers: entries, summary }
}

/**
 * Mark a single provider as failed (called after a real AI call fails).
 * This avoids running a full health check on every error but keeps the
 * health state current.
 */
export function recordProviderFailure(providerId: string, error: string): void {
  const cache = readHealthCache()
  const existing = cache[providerId]
  if (!existing) return

  cache[providerId] = {
    ...existing,
    status: 'unavailable',
    checkedAt: new Date().toISOString(),
    failStreak: (existing.failStreak ?? 0) + 1,
    error,
  }
  writeHealthCache(cache)
}
