export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getPlan } from '@/lib/delegations/plan-generator'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import type { PlanPhase } from '@/lib/delegations/plan-generator'
import type { DelegationStatus } from '@/lib/models/delegation'

export interface PlanPhaseStatus {
  phase: PlanPhase
  delegation: {
    id: string
    status: DelegationStatus
    completedAt?: string
    prUrl?: string
    retryCount?: number
    errorMessage?: string
  } | null
}

export interface PlanStatusResponse {
  id: string
  goal: string
  overview: string
  status: string
  createdAt: string
  updatedAt: string
  phases: PlanPhaseStatus[]
  summary: {
    total: number
    pending: number
    running: number
    completed: number
    failed: number
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const plan = getPlan(id)
  if (!plan) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  }

  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)

  const phases: PlanPhaseStatus[] = await Promise.all(
    plan.phases.map(async (phase) => {
      if (!phase.delegationId) return { phase, delegation: null }
      const delegation = await repo.findById(phase.delegationId)
      if (!delegation) return { phase, delegation: null }
      return {
        phase,
        delegation: {
          id: delegation.id,
          status: delegation.status,
          completedAt: delegation.completedAt,
          prUrl: delegation.summaryReport?.prUrl,
          retryCount: delegation.retryCount,
          errorMessage: delegation.errorMessage,
        },
      }
    }),
  )

  const statuses = phases.map(p => p.delegation?.status)
  const summary = {
    total: phases.length,
    pending: statuses.filter(s => s === 'pending' || s === 'approved' || !s).length,
    running: statuses.filter(s => s === 'running').length,
    completed: statuses.filter(s => s === 'completed').length,
    failed: statuses.filter(s => s === 'failed').length,
  }

  const response: PlanStatusResponse = {
    id: plan.id,
    goal: plan.goal,
    overview: plan.overview,
    status: plan.status,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    phases,
    summary,
  }

  return NextResponse.json(response)
}
