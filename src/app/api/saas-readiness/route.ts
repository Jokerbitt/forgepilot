export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { buildSaaSReadinessAudit } from '@/lib/saas-readiness/audit'

export async function GET() {
  return NextResponse.json(buildSaaSReadinessAudit())
}
