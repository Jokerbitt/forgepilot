/**
 * GET /api/ready
 *
 * Readiness probe for Docker HEALTHCHECK, Vercel health monitoring, and NAS supervision.
 * Returns HTTP 200 when all critical checks pass, HTTP 503 when any check fails.
 *
 * Checks performed:
 *   1. Delegation store accessible (repository reachable — DB or JSON)
 *   2. AI provider configured (at least one provider with API key or local)
 *   3. Scope lock file accessible (agent coordination)
 *   4. Notifications store accessible
 *
 * M160 — Production-Readiness Phase 8-A
 */

export const dynamic = 'force-dynamic'

import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'
import { getProviderAvailability, resolveProvider } from '@/lib/ai/auto-router'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { getAuthSecurityIssues, isProductionRuntime } from '@/lib/auth/config'

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
  try {
    const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
    const all = await repo.listByStatus([])
    return { name: 'delegation_store', status: 'pass', message: `OK (${all.length} delegations)` }
  } catch {
    return { name: 'delegation_store', status: 'fail', message: 'Delegation store not accessible' }
  }
}

async function checkAIProviders(): Promise<Omit<CheckResult, 'durationMs'>> {
  try {
    const [availability, resolvedProvider] = await Promise.all([
      getProviderAvailability(),
      resolveProvider('fast'),
    ])

    const available = availability.filter(provider => provider.available)
    const configured = availability.filter(provider =>
      provider.available || provider.status === 'connected'
    )

    if (resolvedProvider.providerId === 'placeholder' || available.length === 0) {
      return {
        name: 'ai_providers',
        status: 'warn',
        message: `0/${availability.length} providers available — ${resolvedProvider.reason}`,
      }
    }

    return {
      name: 'ai_providers',
      status: 'pass',
      message: `${configured.length}/${availability.length} providers available; active=${resolvedProvider.providerId}:${resolvedProvider.model}`,
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

async function checkAuthSecurity(): Promise<Omit<CheckResult, 'durationMs'>> {
  const issues = getAuthSecurityIssues()
  if (issues.length === 0) {
    return { name: 'auth_security', status: 'pass', message: 'Auth credentials meet security requirements' }
  }
  // In production: fail the probe so the deployment is flagged immediately.
  // In dev/staging: warn only — allows local dev with FORGEPILOT_AUTH_DISABLED.
  const status: CheckStatus = isProductionRuntime() ? 'fail' : 'warn'
  return {
    name: 'auth_security',
    status,
    message: issues.join('; '),
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

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const start = Date.now()

  const checks = await Promise.all([
    timed(checkDelegationStore),
    timed(checkAIProviders),
    timed(checkScopeLock),
    timed(checkNotificationStore),
    timed(checkAuthSecurity),
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
