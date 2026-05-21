export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { readStoredApiKeys } from '@/lib/connectors/config'
import { runPreflight } from '@/lib/preflight'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'

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

  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const delegation = await repo.findById(delegationId)
  if (!delegation) {
    return NextResponse.json({ error: `Delegation ${delegationId} not found` }, { status: 404 })
  }

  const storedKeys = readStoredApiKeys()
  const ghToken = storedKeys.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim()

  const result = await runPreflight(delegation, ghToken)
  return NextResponse.json(result)
}
