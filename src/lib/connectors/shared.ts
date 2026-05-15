import type { ConnectorHealth } from './types'

export type Fetcher = typeof fetch

export function nowIso(): string {
  return new Date().toISOString()
}

export function missingConfigHealth(connectorId: string, missingFields: string[]): ConnectorHealth {
  return {
    connectorId,
    status: 'unconfigured',
    lastChecked: nowIso(),
    errorMessage: `Missing configuration: ${missingFields.join(', ')}`,
  }
}

export function errorHealth(connectorId: string, message: string): ConnectorHealth {
  return {
    connectorId,
    status: 'error',
    lastChecked: nowIso(),
    errorMessage: message,
  }
}

export function degradedHealth(connectorId: string, message: string): ConnectorHealth {
  return {
    connectorId,
    status: 'degraded',
    lastChecked: nowIso(),
    errorMessage: message,
  }
}

export function okHealth(
  connectorId: string,
  startedAt: number,
  rateLimit?: ConnectorHealth['rateLimit'],
): ConnectorHealth {
  return {
    connectorId,
    status: 'ok',
    lastChecked: nowIso(),
    latencyMs: Date.now() - startedAt,
    rateLimit,
  }
}

export function parseRateLimit(headers: Headers): ConnectorHealth['rateLimit'] | undefined {
  const remaining = headers.get('x-ratelimit-remaining')
  const reset = headers.get('x-ratelimit-reset')

  if (!remaining || !reset) {
    return undefined
  }

  const resetSeconds = Number(reset)
  return {
    remaining: Number(remaining),
    resetAt: Number.isFinite(resetSeconds)
      ? new Date(resetSeconds * 1000).toISOString()
      : reset,
  }
}
