export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { readStoredApiKeys } from '@/lib/connectors/config'
import { runPreflight } from '@/lib/preflight'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { DelegationPreflightSchema } from '@/lib/validation/schemas'

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, DelegationPreflightSchema)
  if (isValidationError(parsed)) return parsed

  const { delegationId } = parsed

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
