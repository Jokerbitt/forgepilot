import { NextResponse } from 'next/server'
import { fetchLinearIssueDetails } from '@/lib/connectors/linear-issue-details'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const details = await fetchLinearIssueDetails(id)
  if (!details) {
    return NextResponse.json({ error: 'Issue not available' }, { status: 404 })
  }
  return NextResponse.json(details)
}
