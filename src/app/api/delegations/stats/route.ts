export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import {
  createDelegationRepository,
  SINGLE_TENANT_USER_ID,
} from '@/lib/repositories/delegationRepository'

function isToday(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

export interface DelegationStats {
  total: number
  byStatus: Record<string, number>
  running: number
  pending: number
  approved: number
  completed: number
  failed: number
  cancelled: number
  totalEstimatedUsd: number
  totalActualUsd: number
  todayCount: number
  todayActualUsd: number
  // PR lifecycle (M266)
  prCreated: number
  prMerged: number
  prOpen: number
}

export async function GET() {
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const delegations = await repo.listByStatus()

  const byStatus: Record<string, number> = {}
  let totalEstimatedUsd = 0
  let totalActualUsd = 0
  let todayCount = 0
  let todayActualUsd = 0
  let prCreated = 0
  let prMerged = 0
  let prOpen = 0

  for (const d of delegations) {
    byStatus[d.status] = (byStatus[d.status] ?? 0) + 1
    totalEstimatedUsd += d.costEstimateUsd ?? 0
    if (d.actualCostUsd != null) totalActualUsd += d.actualCostUsd
    if (isToday(d.createdAt)) {
      todayCount++
      if (d.actualCostUsd != null) todayActualUsd += d.actualCostUsd
    }
    if (d.summaryReport?.prUrl) {
      prCreated++
      if (d.summaryReport.prState === 'merged') prMerged++
      else if (!d.summaryReport.prState || d.summaryReport.prState === 'open') prOpen++
    }
  }

  const stats: DelegationStats = {
    total: delegations.length,
    byStatus,
    running:   byStatus['running']   ?? 0,
    pending:   byStatus['pending']   ?? 0,
    approved:  byStatus['approved']  ?? 0,
    completed: byStatus['completed'] ?? 0,
    failed:    byStatus['failed']    ?? 0,
    cancelled: byStatus['cancelled'] ?? 0,
    totalEstimatedUsd,
    totalActualUsd,
    todayCount,
    todayActualUsd,
    prCreated,
    prMerged,
    prOpen,
  }

  return NextResponse.json(stats)
}
