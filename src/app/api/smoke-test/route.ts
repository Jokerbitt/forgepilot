export const dynamic = 'force-dynamic'
/**
 * GET /api/smoke-test
 *
 * Lightweight system health check designed for agent self-verification.
 * Returns a JSON summary of critical subsystem statuses.
 * Agents call this after completing their run to detect UI/API regressions.
 */
import { NextResponse } from 'next/server'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { readConnectorConfigs } from '@/lib/connectors/config'

export type SmokeCheckStatus = 'ok' | 'warn' | 'error'

export interface SmokeCheck {
  name: string
  status: SmokeCheckStatus
  detail?: string
}

export interface SmokeTestResult {
  ok: boolean
  timestamp: string
  checks: SmokeCheck[]
  summary: string
}

async function checkDelegations(): Promise<SmokeCheck> {
  try {
    const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
    await repo.listByStatus(['approved'])
    return { name: 'delegations', status: 'ok' }
  } catch (err) {
    return {
      name: 'delegations',
      status: 'error',
      detail: err instanceof Error ? err.message : 'unknown error',
    }
  }
}

async function checkConnectors(): Promise<SmokeCheck> {
  try {
    const configs = readConnectorConfigs()
    const configured = Object.values(configs).filter(Boolean).length
    return {
      name: 'connectors',
      status: 'ok',
      detail: `${configured} configured`,
    }
  } catch (err) {
    return {
      name: 'connectors',
      status: 'warn',
      detail: err instanceof Error ? err.message : 'unknown error',
    }
  }
}

function checkEnvironment(): SmokeCheck {
  const missing: string[] = []
  if (!process.env.NEXT_PUBLIC_BASE_URL && process.env.NODE_ENV === 'production') {
    missing.push('NEXT_PUBLIC_BASE_URL')
  }
  if (missing.length > 0) {
    return { name: 'environment', status: 'warn', detail: `Missing: ${missing.join(', ')}` }
  }
  return { name: 'environment', status: 'ok' }
}

export async function GET() {
  const [delegationsCheck, connectorsCheck] = await Promise.all([
    checkDelegations(),
    checkConnectors(),
  ])

  const environmentCheck = checkEnvironment()

  const checks: SmokeCheck[] = [delegationsCheck, connectorsCheck, environmentCheck]

  const hasError = checks.some(c => c.status === 'error')
  const hasWarn = checks.some(c => c.status === 'warn')

  const ok = !hasError
  const summary = hasError
    ? `FAIL — ${checks.filter(c => c.status === 'error').map(c => c.name).join(', ')} failed`
    : hasWarn
      ? `WARN — ${checks.filter(c => c.status === 'warn').map(c => c.name).join(', ')} degraded`
      : 'OK — all systems operational'

  const result: SmokeTestResult = {
    ok,
    timestamp: new Date().toISOString(),
    checks,
    summary,
  }

  return NextResponse.json(result, { status: ok ? 200 : 503 })
}
