import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { Delegation } from '@/lib/models/delegation'

const DELEGATIONS_FILE = path.join(process.cwd(), 'config', 'delegations.json')

function readDelegations(): Delegation[] {
  try {
    return JSON.parse(fs.readFileSync(DELEGATIONS_FILE, 'utf-8')) as Delegation[]
  } catch {
    return []
  }
}

function writeDelegations(delegations: Delegation[]): void {
  fs.writeFileSync(DELEGATIONS_FILE, JSON.stringify(delegations, null, 2))
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const delegation = readDelegations().find(d => d.id === params.id)
  if (!delegation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json(delegation)
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const delegations = readDelegations()
  const idx = delegations.findIndex(d => d.id === params.id)
  if (idx === -1) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const body = await req.json() as Partial<Pick<Delegation, 'status' | 'agentRunId'>>
  const updated: Delegation = {
    ...delegations[idx],
    ...(body.status !== undefined ? { status: body.status } : {}),
    ...(body.agentRunId !== undefined ? { agentRunId: body.agentRunId } : {}),
    updatedAt: new Date().toISOString(),
  }
  delegations[idx] = updated
  writeDelegations(delegations)
  return NextResponse.json(updated)
}
