/**
 * GET/POST /api/cron/journey-maintenance
 *
 * Phase 3.2 — periodic maintenance: runs the security + outdated-dependency
 * check over the repos listed in config/maintenance-repos.json and emits a
 * summary for monitoring. Add a repo by putting its absolute path in that file:
 *   { "repos": ["/Users/you/dev/my-app"] }
 *
 * Security: Bearer CRON_SECRET (via isCronAuthorized).
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { isCronAuthorized } from '@/lib/cron/auth'
import { buildMaintenanceReport } from '@/lib/journey/maintenance'
import { logger } from '@/lib/logger'

const ROUTE = 'journey-maintenance'
const CONFIG_PATH = join(process.cwd(), 'config', 'maintenance-repos.json')

function readRepos(): string[] {
  if (!existsSync(CONFIG_PATH)) return []
  try {
    const parsed = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as { repos?: string[] }
    return Array.isArray(parsed.repos) ? parsed.repos.filter(r => typeof r === 'string' && r) : []
  } catch {
    return []
  }
}

async function run(request: NextRequest) {
  if (!isCronAuthorized(request, ROUTE)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const repos = readRepos()
  const results = repos.map(repoPath => {
    const report = buildMaintenanceReport(repoPath)
    return {
      repoPath,
      securityFindings: report.security.length,
      highSeverity: report.security.filter(s => s.severity === 'high').length,
      outdated: report.outdated.length,
      majorUpdates: report.outdated.filter(d => d.level === 'major').length,
    }
  })

  const stats = {
    ok: true,
    timestamp: new Date().toISOString(),
    reposScanned: results.length,
    totalSecurityFindings: results.reduce((s, r) => s + r.securityFindings, 0),
    totalOutdated: results.reduce((s, r) => s + r.outdated, 0),
    results,
  }
  logger.info({ event: 'cron.journey_maintenance', ...stats }, 'Journey maintenance scan complete')
  return NextResponse.json(stats)
}

export async function GET(request: NextRequest) { return run(request) }
export async function POST(request: NextRequest) { return run(request) }
