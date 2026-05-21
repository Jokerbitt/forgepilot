export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { buildBillingStatus } from '@/lib/billing/status'

export async function GET() {
  return NextResponse.json(buildBillingStatus())
}
