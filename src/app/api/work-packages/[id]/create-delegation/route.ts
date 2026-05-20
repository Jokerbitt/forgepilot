export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { readWorkPackages } from '@/lib/knowledge/milestone-store'
import type { Delegation } from '@/lib/models/delegation'
import fs from 'fs'
import path from 'path'

const DELEGATIONS_FILE = path.join(process.cwd(), 'config', 'delegations.json')

function readDelegations(): Delegation[] {
  try {
    const data = fs.readFileSync(DELEGATIONS_FILE, 'utf-8')
    return JSON.parse(data) as Delegation[]
  } catch {
    return []
  }
}

function writeDelegations(delegations: Delegation[]) {
  const dir = path.dirname(DELEGATIONS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = DELEGATIONS_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(delegations, null, 2), 'utf-8')
  fs.renameSync(tmp, DELEGATIONS_FILE)
}

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params
  const workPackages = readWorkPackages()
  const wp = workPackages.find(w => w.id === id)

  if (!wp) {
    return NextResponse.json({ error: 'Work Package nicht gefunden' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const contractId = randomUUID()
  const delegationId = randomUUID()

  const maxBudgetUsd = Math.max(1.0, wp.estimatedHours * 0.5)
  const branchStrategy = wp.riskClass === 'C' ? 'fix' : 'feature'
  const taskType = wp.tags.includes('test') ? 'bugfix' : 'feature'

  const delegation: Delegation = {
    id: delegationId,
    title: wp.title,
    contract: {
      id: contractId,
      workItemId: wp.id,
      goal: wp.description,
      context: '',
      taskType,
      definitionOfDone: wp.definitionOfDone,
      riskClass: wp.riskClass,
      maxBudgetUsd,
      allowedTools: ['bash', 'read_file', 'write_file'],
      branchStrategy,
      requiresApproval: wp.riskClass === 'C',
      privacyMode: 'local',
      createdAt: now,
    },
    status: 'pending',
    executionRoute: 'ollama-agent',
    costEstimateUsd: 0,
    logs: [{
      timestamp: now,
      type: 'info',
      message: `Delegation aus Work Package "${wp.title}" erstellt (Risk ${wp.riskClass}, ${wp.estimatedHours}h geschätzt)`,
    }],
    createdAt: now,
    updatedAt: now,
  }

  const delegations = readDelegations()
  delegations.push(delegation)
  writeDelegations(delegations)

  return NextResponse.json({ delegationId, delegation }, { status: 201 })
}
