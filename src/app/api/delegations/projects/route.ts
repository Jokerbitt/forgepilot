export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'

export async function GET() {
  try {
    const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
    const all = await repo.listByStatus()
    const keys = new Set(
      all.map(d => {
        const wid = d.contract?.workItemId || d.id
        return wid.includes('-') ? wid.split('-')[0] : 'Local'
      })
    )
    keys.delete('MANUAL')
    return NextResponse.json({ projects: Array.from(keys).sort() })
  } catch (err) {
    console.error('[GET /api/delegations/projects]', err)
    return NextResponse.json({ projects: [] })
  }
}
