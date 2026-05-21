/**
 * GET /api/ready
 *
 * Readiness probe for Docker HEALTHCHECK, Vercel health monitoring, and NAS supervision.
 * Returns HTTP 200 when all critical checks pass, HTTP 503 when any check fails.
 *
 * Checks performed:
 *   1. Config store accessible (delegations.json readable)
 *   2. AI provider configured (at least one provider with API key or local)
 *   3. Scope lock file accessible (agent coordination)
 *   4. Notifications store accessible
 *   5. Connector status readable
 *
 * M160 — Production-Readiness Phase 8-A
 */

export const dynamic = 'force-dynamic'

import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'
import { getAllProviderConfigs } from '@/lib/ai/providers/config-store'
import { readConnectorConfigs } from '@/lib/connectors/config'
import { getAllConnectorHealth } from '@/lib/connectors/registry'

// ── Types ─────────────────────────────────────────────────────────────────────

type CheckStatus = 'pass' | 'fail' | 'warn'

interface CheckResult {
  name: string
  status: CheckStatus
  message: string
  durationMs: number
}

interface ReadinessReport {
  status: 'ready' | 'degraded' | 'not_ready'
  timestamp: string
  checks: CheckResult[]
  durationMs: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function timed(fn: () => Promise<Omit<CheckResult, 'durationMs'>>): Promise<CheckResult> {
  const start = Date.now()
  const result = await fn()
  return { ...result, durationMs: Date.now() - start }
}

const CONFIG_DIR = path.join(process.cwd(), 'config')

// ── Individual checks ─────────────────────────────────────────────────────────

async function checkDelegationStore(): Promise<Omit<CheckResult, 'durationMs'>> {
  const file = path.join(CONFIG_DIR, 'delegations.json')
  try {
    const stat = fs.statSync(file)
    const sizeKb = Math.round(stat.size / 1024)
    return { name: 'delegation_store', status: 'pass', message: `OK (${sizeKb} KB)` }
  } catch {
    return { name: 'delegation_store', status: 'fail', message: 'config/delegations.json not accessible' }
  }
}

async function checkAIProviders(): Promise<Omit<CheckResult, 'durationMs'>> {
  try {
    const providers = getAllProviderConfigs()
    const enabled = providers.filter(p => p.enabled)
    const configured = enabled.filter(p => {
      // local providers (no apiKeyRef) are always "configured"
      if (!p.apiKeyRef) return true
      // cloud providers: check env var
      return Boolean(process.env[p.apiKeyRef])
    })
    if (configured.length === 0) {
      return {
        name: 'ai_providers',
        status: 'warn',
        message: `${enabled.length} provider enabled, 0 configured (no API keys)`,
      }
    }
    return {
      name: 'ai_providers',
      status: 'pass',
      message: `${configured.length}/${enabled.length} provider configured`,
    }
  } catch (err) {
    return { name: 'ai_providers', status: 'fail', message: `Provider config error: ${String(err)}` }
  }
}

async function checkScopeLock(): Promise<Omit<CheckResult, 'durationMs'>> {
  // Check that the config directory is writable (needed for agent coordination)
  const testFile = path.join(CONFIG_DIR, '.ready-probe-tmp')
  try {
    fs.writeFileSync(testFile, 'probe')
    fs.unlinkSync(testFile)
    return { name: 'scope_lock', status: 'pass', message: 'config dir writable' }
  } catch {
    return { name: 'scope_lock', status: 'fail', message: 'config dir not writable — agent coordination impossible' }
  }
}

async function checkNotificationStore(): Promise<Omit<CheckResult, 'durationMs'>> {
  const file = path.join(CONFIG_DIR, 'notifications.json')
  try {
    // File may not exist yet on fresh install — that's OK (warn, not fail)
    if (!fs.existsSync(file)) {
      return { name: 'notification_store', status: 'warn', message: 'notifications.json not yet created (fresh install OK)' }
    }
    JSON.parse(fs.readFileSync(file, 'utf-8'))
    return { name: 'notification_store', status: 'pass', message: 'OK' }
  } catch {
    return { name: 'notification_store', status: 'fail', message: 'notifications.json parse error' }
  }
}

async function checkConnectors(): Promise<Omit<CheckResult, 'durationMs'>> {
  try {
    const connectors = await getAllConnectorHealth(readConnectorConfigs())
    const errorCount = connectors.filter(connector => connector.health.status === 'error').length
    const configuredCount = connectors.filter(connector => connector.health.status !== 'unconfigured').length

    if (errorCount > 0) {
      return {
        name: 'connectors',
        status: 'fail',
        message: `${errorCount}/${connectors.length} connector checks failing`,
      }
    }

    if (configuredCount === 0) {
      return {
        name: 'connectors',
        status: 'warn',
        message: `${connectors.length} connectors installed, none configured`,
      }
    }

    return {
      name: 'connectors',
      status: 'pass',
      message: `${configuredCount}/${connectors.length} connectors configured`,
    }
  } catch (err) {
    return { name: 'connectors', status: 'fail', message: `Connector health error: ${String(err)}` }
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const start = Date.now()

  const checks = await Promise.all([
    timed(checkDelegationStore),
    timed(checkAIProviders),
    timed(checkScopeLock),
    timed(checkNotificationStore),
    timed(checkConnectors),
  ])

  const hasFail = checks.some(c => c.status === 'fail')
  const hasWarn = checks.some(c => c.status === 'warn')

  const status: ReadinessReport['status'] = hasFail
    ? 'not_ready'
    : hasWarn
    ? 'degraded'
    : 'ready'

  const report: ReadinessReport = {
    status,
    timestamp: new Date().toISOString(),
    checks,
    durationMs: Date.now() - start,
  }

  const httpStatus = hasFail ? 503 : 200
  return NextResponse.json(report, { status: httpStatus })
}
