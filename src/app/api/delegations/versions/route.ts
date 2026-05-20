import { NextRequest, NextResponse } from 'next/server'
import { getVersionHistory, saveVersion } from '@/lib/delegations/contract-versions'
import { parseBody, parseParams, isValidationError } from '@/lib/validation/api'
import { DelegationVersionSchema } from '@/lib/validation/schemas'
import { apiLogger } from '@/lib/logger'
import { z } from 'zod'
import type { Delegation } from '@/lib/models/delegation'

export const runtime = 'nodejs'

const QueryParamsSchema = z.object({
  delegationId: z.string().min(1, 'delegationId required'),
})

/**
 * GET /api/delegations/versions?delegationId=xxx
 * Returns version history for a specific delegation
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries())
  const result = parseParams(params, QueryParamsSchema)
  if (isValidationError(result)) return result

  try {
    const history = await getVersionHistory(result.delegationId)
    return NextResponse.json({
      delegationId: result.delegationId,
      versions: history,
      count: history.length,
    })
  } catch (error) {
    apiLogger.error({ event: 'delegation.versions.fetch.error', error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(
      { error: 'Failed to fetch version history' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/delegations/versions
 * Save a new contract version
 * Body: { delegationId, delegation, contract, reason? }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const result = await parseBody(request, DelegationVersionSchema)
  if (isValidationError(result)) return result

  try {
    const newVersion = await saveVersion(
      result.delegationId,
      result.contract as Delegation['contract'],
      (result.delegation || {}) as unknown as Delegation,
      result.reason
    )

    return NextResponse.json(
      {
        message: 'Version saved successfully',
        version: newVersion,
      },
      { status: 201 }
    )
  } catch (error) {
    apiLogger.error({ event: 'delegation.versions.save.error', error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(
      { error: 'Failed to save contract version' },
      { status: 500 }
    )
  }
}
