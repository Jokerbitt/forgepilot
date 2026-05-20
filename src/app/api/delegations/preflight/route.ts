export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { Delegation } from '@/lib/models/delegation'
import { readStoredApiKeys } from '@/lib/connectors/config'
import { runPreflight } from '@/lib/preflight'

const DELEGATIONS_FILE = path.join(process.cwd(), 'config', 'delegations.json')

function readDelegations(): Delegation[] {
  try {
    return JSON.parse(fs.readFileSync(DELEGATIONS_FILE, 'utf-8')) as Delegation[]
  } catch {
    return []
  }
}

export async function POST(req: Request) {
  let body: { delegationId: string }
  try {
    body = await req.json() as { delegationId: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { delegationId } = body
  if (!delegationId) {
    return NextResponse.json({ error: 'delegationId required' }, { status: 400 })
  }

  const delegation = readDelegations().find(d => d.id === delegationId)
  if (!delegation) {
    return NextResponse.json({ error: `Delegation ${delegationId} not found` }, { status: 404 })
  }

  const storedKeys = readStoredApiKeys()
  const ghToken = storedKeys.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim()

  const result = await runPreflight(delegation, ghToken)
  return NextResponse.json(result)
}
