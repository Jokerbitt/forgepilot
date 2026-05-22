import type { AgentLog, Delegation } from '@/lib/models/delegation'
import type { DelegationRepository } from '@/lib/repositories/delegationRepository'
import { isProcessAlive } from '@/lib/process-registry'

export interface DelegationWatchdogOptions {
  now?: Date
  runningSilentMinutes?: number
  processAlive?: (delegationId: string) => boolean
}

export interface ReapedDelegation {
  delegationId: string
  title: string
  silentMinutes: number
}

function minutesBetween(later: Date, earlierIso: string): number {
  return Math.max(0, Math.round((later.getTime() - new Date(earlierIso).getTime()) / 60_000))
}

export async function reapStaleDelegations(
  repo: DelegationRepository,
  options: DelegationWatchdogOptions = {},
): Promise<ReapedDelegation[]> {
  const now = options.now ?? new Date()
  const runningSilentMinutes = options.runningSilentMinutes ?? 10
  const processAlive = options.processAlive ?? isProcessAlive
  const running = await repo.listByStatus(['running'])
  const reaped: ReapedDelegation[] = []

  for (const delegation of running) {
    const silentMinutes = minutesBetween(now, delegation.updatedAt)
    const hasLiveProcess = processAlive(delegation.id)
    if (hasLiveProcess || silentMinutes < runningSilentMinutes) continue

    const message = `Watchdog marked delegation stale after ${silentMinutes}m without a live agent process.`
    const log: AgentLog = {
      timestamp: now.toISOString(),
      type: 'error',
      message,
    }

    const updated = await repo.update(delegation.id, {
      status: 'failed',
      errorMessage: message,
      logs: [...(delegation.logs ?? []), log],
    })

    if (updated) {
      reaped.push({
        delegationId: delegation.id,
        title: delegation.title,
        silentMinutes,
      })
    }
  }

  return reaped
}
