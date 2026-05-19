import { NextRequest, NextResponse } from 'next/server'
import { getVersionHistory, saveVersion } from '@/lib/delegations/contract-versions'
import type { Delegation } from '@/lib/models/delegation'

export const runtime = 'nodejs'

/**
 * GET /api/delegations/versions?delegationId=xxx
 * Returns version history for a specific delegation
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const delegationId = request.nextUrl.searchParams.get('delegationId')

  if (!delegationId) {
    return NextResponse.json(
      { error: 'delegationId query parameter is required' },
      { status: 400 }
    )
  }

  try {
    const history = await getVersionHistory(delegationId)
    return NextResponse.json({
      delegationId,
      versions: history,
      count: history.length,
    })
  } catch (error) {
    console.error('Error fetching version history:', error)
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
  try {
    const body = await request.json()
    const { delegationId, delegation, contract, reason } = body

    if (!delegationId || !delegation || !contract) {
      return NextResponse.json(
        {
          error: 'Missing required fields: delegationId, delegation, contract',
        },
        { status: 400 }
      )
    }

    const newVersion = await saveVersion(
      delegationId,
      contract,
      delegation as Delegation,
      reason
    )

    return NextResponse.json(
      {
        message: 'Version saved successfully',
        version: newVersion,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error saving contract version:', error)
    return NextResponse.json(
      { error: 'Failed to save contract version' },
      { status: 500 }
    )
  }
}
