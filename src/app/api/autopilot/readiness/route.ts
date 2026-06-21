export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getAutopilotReadiness } from '@/lib/autopilot/readiness'

export async function GET() {
  return NextResponse.json(getAutopilotReadiness())
}
