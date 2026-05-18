import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { Delegation } from '@/lib/models/delegation'
import { syncAttentionFromDelegations } from '@/lib/attention/engine'
import { getOpenAttentionItems, upsertAttentionItem } from '@/lib/attention/store'
import type { AttentionItem } from '@/lib/models/attention'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

const DELEGATIONS_FILE = path.join(process.cwd(), 'config', 'delegations.json')

function readDelegations(): Delegation[] {
  try {
    return JSON.parse(fs.readFileSync(DELEGATIONS_FILE, 'utf-8')) as Delegation[]
  } catch {
    return []
  }
}

/** GET /api/attention — sync from delegation state and return open items */
export async function GET() {
  const delegations = readDelegations()
  syncAttentionFromDelegations(delegations)
  const items = getOpenAttentionItems()
  return NextResponse.json(items)
}

/** POST /api/attention — create a custom attention item (e.g. from agent escalation) */
export async function POST(req: Request) {
  const body = await req.json() as Partial<AttentionItem>
  if (!body.title || !body.type) {
    return NextResponse.json({ error: 'title and type required' }, { status: 400 })
  }
  const item: AttentionItem = {
    id: body.id ?? randomUUID(),
    type: body.type,
    severity: body.severity ?? 'info',
    title: body.title,
    body: body.body ?? '',
    delegationId: body.delegationId,
    actionUrl: body.actionUrl,
    escalationContext: body.escalationContext,
    createdAt: new Date().toISOString(),
  }
  upsertAttentionItem(item)
  return NextResponse.json(item, { status: 201 })
}
