/**
 * GET/POST  /api/cron/agent-heartbeat
 *
 * Scheduled every 5 minutes in vercel.json.
 * Detects stuck/zombie delegations that are still in status 'running' but
 * haven't produced a log entry in STALE_THRESHOLD_MINUTES.
 *
 * Actions taken:
 *  - Marks stale delegations as 'failed' with a descriptive error log
 *  - Emits structured logs for observability
 *  - Returns a summary of what was found / fixed
 *
 * Security: Bearer CRON_SECRET (via isCronAuthorized).
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron/auth'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { reapStaleDelegations } from '@/lib/delegations/watchdog'
import { logger } from '@/lib/logger'
import type { AgentLog } from '@/lib/models/delegation'

const ROUTE = 'agent-heartbeat'

/** A delegation is considered stale if no log entry for this many minutes */
const STALE_THRESHOLD_MINUTES = 30

/** Safety cap: delegations running longer than this are always stale */
const ZOMBIE_THRESHOLD_HOURS = 4

function minutesSince(isoDate: string): number {
  return (Date.now() - new Date(isoDate).getTime()) / 60_000
}

function getLastLogTimestamp(logs: AgentLog[] | undefined): string | undefined {
  if (!logs || logs.length === 0) return undefined
  return logs[logs.length - 1]?.timestamp
}

async function runHeartbeat(): Promise<NextResponse> {
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)

  // PID-aware crash recovery FIRST: a delegation whose agent process is dead is
  // failed after ~10 min of silence — much faster than the 30-min log-staleness
  // threshold below, and it catches a crashed/killed runner (e.g. server restart)
  // that the timestamp check would miss while the process still "looks" recent.
  let reapedDead: { delegationId: string }[] = []
  try {
    reapedDead = await reapStaleDelegations(repo)
    if (reapedDead.length > 0) {
      logger.warn(
        { event: `cron.${ROUTE}.reaped`, count: reapedDead.length, ids: reapedDead.map(r => r.delegationId) },
        'Reaped delegations with a dead agent process',
      )
    }
  } catch (err) {
    logger.error({ err, event: `cron.${ROUTE}.reap.error` }, 'PID-aware reap failed')
  }

  let allDelegations
  try {
    allDelegations = await repo.listByStatus(['running'])
  } catch (err) {
    logger.error({ err, event: `cron.${ROUTE}.list.error` }, 'Failed to list running delegations')
    return NextResponse.json({ error: 'Failed to list delegations' }, { status: 500 })
  }

  const running = allDelegations.filter(d => d.status === 'running')

  if (running.length === 0) {
    logger.info({ event: `cron.${ROUTE}.idle`, count: 0 }, 'No running delegations — nothing to check')
    return NextResponse.json({
      ok: true,
      checked: 0,
      stale: 0,
      zombies: 0,
      reaped: reapedDead.length,
      timestamp: new Date().toISOString(),
    })
  }

  const staleIds: string[] = []
  const zombieIds: string[] = []

  for (const d of running) {
    const startedMinutesAgo = minutesSince(d.updatedAt ?? d.createdAt)
    const lastLogTs = getLastLogTimestamp(d.logs)
    const lastLogMinutesAgo = lastLogTs ? minutesSince(lastLogTs) : startedMinutesAgo

    const isZombie = startedMinutesAgo > ZOMBIE_THRESHOLD_HOURS * 60
    const isStale = lastLogMinutesAgo > STALE_THRESHOLD_MINUTES

    if (isZombie) {
      zombieIds.push(d.id)
    } else if (isStale) {
      staleIds.push(d.id)
    }
  }

  const affected = [...zombieIds, ...staleIds]

  for (const id of affected) {
    const d = running.find(r => r.id === id)!
    const isZombie = zombieIds.includes(id)
    const lastLogTs = getLastLogTimestamp(d.logs)
    const idleMinutes = lastLogTs
      ? Math.round(minutesSince(lastLogTs))
      : Math.round(minutesSince(d.updatedAt ?? d.createdAt))

    const staleLog: AgentLog = {
      timestamp: new Date().toISOString(),
      type: 'error',
      message: isZombie
        ? `❌ Zombie-Prozess erkannt: Delegation lief seit über ${ZOMBIE_THRESHOLD_HOURS}h ohne Abschluss. Automatisch als fehlgeschlagen markiert.`
        : `❌ Stale-Agent erkannt: Kein Log-Eintrag seit ${idleMinutes} Minuten (Schwellwert: ${STALE_THRESHOLD_MINUTES} min). Automatisch als fehlgeschlagen markiert.`,
    }

    try {
      await repo.update(id, {
        status: 'failed',
        errorMessage: staleLog.message,
        logs: [...(d.logs ?? []), staleLog],
      })

      logger.warn(
        {
          event: isZombie ? `cron.${ROUTE}.zombie` : `cron.${ROUTE}.stale`,
          delegationId: id,
          idleMinutes,
          isZombie,
        },
        isZombie ? 'Zombie delegation auto-failed' : 'Stale delegation auto-failed',
      )
    } catch (err) {
      logger.error({ err, delegationId: id, event: `cron.${ROUTE}.update.error` }, 'Failed to mark delegation as failed')
    }
  }

  logger.info(
    {
      event: `cron.${ROUTE}.complete`,
      checked: running.length,
      stale: staleIds.length,
      zombies: zombieIds.length,
    },
    'Agent heartbeat complete',
  )

  return NextResponse.json({
    ok: true,
    checked: running.length,
    stale: staleIds.length,
    zombies: zombieIds.length,
    reaped: reapedDead.length,
    affected,
    timestamp: new Date().toISOString(),
  })
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isCronAuthorized(request, ROUTE)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runHeartbeat()
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isCronAuthorized(request, ROUTE)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runHeartbeat()
}
