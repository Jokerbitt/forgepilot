export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { WorkItem } from '@/lib/models/work-item'
import type { Delegation } from '@/lib/models/delegation'
import { decomposeWithAI } from '@/lib/agents/ai-decomposer'
import { createRun } from '@/lib/agents/orchestrated-run'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'

const LOCAL_ITEMS_FILE = path.join(process.cwd(), 'config', 'local-items.json')

function readLocalItems(): WorkItem[] {
  try {
    if (!fs.existsSync(LOCAL_ITEMS_FILE)) return []
    return JSON.parse(fs.readFileSync(LOCAL_ITEMS_FILE, 'utf-8')) as WorkItem[]
  } catch { return [] }
}

/**
 * POST /api/pilot/auto-run
 *
 * Autonomous pilot: picks the top AI-delegable work item, creates a delegation,
 * decomposes it into atomic tasks, and starts an orchestration run.
 * Returns { delegation, run, taskCount } on success.
 */
export async function POST() {
  // 1. Pick top work item
  const items = readLocalItems()
  const candidates = items
    .filter(i => i.aiDelegable && !i.blocked && i.status !== 'done' && i.status !== 'cancelled')
    .sort((a, b) => {
      // Idea-pipeline items (have a projectId) get priority boost: treated as priority - 0.5
      const aPrio = (a.priority ?? 99) - (a.projectId ? 0.5 : 0)
      const bPrio = (b.priority ?? 99) - (b.projectId ? 0.5 : 0)
      return aPrio - bPrio
    })

  if (candidates.length === 0) {
    return NextResponse.json(
      { error: 'No AI-delegable work items available. Add items via Work Items or connectors.' },
      { status: 422 },
    )
  }

  const item = candidates[0]

  // 2. Create delegation via repository
  const now = new Date().toISOString()
  const delegation: Delegation = {
    id: `del-autopilot-${Date.now()}`,
    title: item.title,
    status: 'approved', // auto-approved since AI-delegable
    executionRoute: 'runner',
    costEstimateUsd: 0,
    createdAt: now,
    updatedAt: now,
    contract: {
      id: `contract-autopilot-${Date.now()}`,
      workItemId: item.id,
      goal: item.title,
      context: '',
      definitionOfDone: [],
      riskClass: item.risk,
      maxBudgetUsd: 0,
      allowedTools: [],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      createdAt: now,
    },
  }

  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const created = await repo.create(delegation)

  // 3. Decompose + create orchestration run
  const tasks = await decomposeWithAI(created.contract.goal, undefined)
  const run = createRun(created.id, created.title, created.contract.goal, tasks)

  return NextResponse.json({ delegation: created, run, taskCount: tasks.length }, { status: 201 })
}
