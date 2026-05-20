export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { Delegation } from '@/lib/models/delegation'
import { analyzeDrift } from '@/lib/drift-detector'
import { budgetToMaxTurns } from '@/lib/budget-utils'

const DELEGATIONS_FILE = path.join(process.cwd(), 'config', 'delegations.json')

function readDelegations(): Delegation[] {
  try {
    return JSON.parse(fs.readFileSync(DELEGATIONS_FILE, 'utf-8')) as Delegation[]
  } catch {
    return []
  }
}

/** GET /api/delegations/drift?id=<delegationId> */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')

  if (!id) {
    // Return drift analysis for all running delegations
    const all = readDelegations().filter(d => d.status === 'running')
    const analyses = all.map(d => ({
      delegationId: d.id,
      title: d.title ?? d.contract.goal.substring(0, 60),
      status: d.status,
      drift: analyzeDrift(d.logs ?? [], budgetToMaxTurns(d.contract.maxBudgetUsd)),
    }))
    return NextResponse.json(analyses)
  }

  const delegation = readDelegations().find(d => d.id === id)
  if (!delegation) {
    return NextResponse.json({ error: `Delegation ${id} not found` }, { status: 404 })
  }

  const analysis = analyzeDrift(
    delegation.logs ?? [],
    budgetToMaxTurns(delegation.contract.maxBudgetUsd)
  )
  return NextResponse.json({ delegationId: id, drift: analysis })
}
