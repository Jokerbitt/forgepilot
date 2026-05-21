export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getBriefVersion, getBriefVersions, diffBriefs } from '@/lib/project-briefs/brief-versions'
import { findProjectBriefById } from '@/lib/project-briefs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)

  const v1Id = searchParams.get('v1')
  const v2Id = searchParams.get('v2')

  const current = findProjectBriefById(id)
  if (!current) {
    return NextResponse.json({ error: 'Brief not found' }, { status: 404 })
  }

  // If no v1 specified, use the most recent saved version as "before"
  const versions = getBriefVersions(id)
  const beforeBrief = v1Id
    ? getBriefVersion(id, v1Id)?.snapshot
    : versions[0]?.snapshot   // most recent = version with highest versionNumber

  if (!beforeBrief) {
    return NextResponse.json(
      { error: 'No version found for comparison. Save a snapshot first.' },
      { status: 404 },
    )
  }

  // "after" is either a specific version or the current state
  const afterBrief = v2Id ? getBriefVersion(id, v2Id)?.snapshot : current

  if (!afterBrief) {
    return NextResponse.json({ error: 'Version v2 not found.' }, { status: 404 })
  }

  const diffs = diffBriefs(beforeBrief, afterBrief)
  const changedCount = diffs.filter(d => d.changed).length

  return NextResponse.json({
    briefId: id,
    before: { versionId: v1Id ?? versions[0]?.versionId, savedAt: beforeBrief.updatedAt },
    after: { versionId: v2Id ?? 'current', savedAt: afterBrief.updatedAt },
    changedCount,
    diffs,
  })
}
