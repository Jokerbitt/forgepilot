import { NextResponse } from 'next/server'
import { readConnectorConfigs } from '@/lib/connectors/config'
import { getAllConnectorHealth } from '@/lib/connectors/registry'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const connectors = await getAllConnectorHealth(readConnectorConfigs())
    return NextResponse.json({ connectors })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch connector health', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
