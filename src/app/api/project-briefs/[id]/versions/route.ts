export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getBriefVersions, saveSnapshot } from '@/lib/project-briefs/brief-versions'
import { findProjectBriefById } from '@/lib/project-briefs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const versions = getBriefVersions(id)
  return NextResponse.json({ versions })
}

/** POST /api/project-briefs/[id]/versions — manually save a snapshot. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const brief = findProjectBriefById(id)
  if (!brief) {
    return NextResponse.json({ error: 'Brief not found' }, { status: 404 })
  }
  let label: string | undefined
  try {
    const body = await request.json() as { label?: string }
    label = typeof body.label === 'string' ? body.label : undefined
  } catch {
    /* body is optional */
  }
  const version = saveSnapshot(brief, label)
  return NextResponse.json({ version }, { status: 201 })
}
