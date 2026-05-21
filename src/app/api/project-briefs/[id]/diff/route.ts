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

  const versions = getBriefVersions(id)
  const beforeVersion = v1Id ? getBriefVersion(id, v1Id) : versions[0]
  const beforeBrief = beforeVersion?.snapshot

  if (!beforeBrief) {
    return NextResponse.json(
      { error: v1Id ? 'Version v1 not found.' : 'No version found for comparison. Save a snapshot first.' },
      { status: 404 },
    )
  }

  const afterVersion = v2Id ? getBriefVersion(id, v2Id) : null
  const afterBrief = v2Id ? afterVersion?.snapshot : current

  if (!afterBrief) {
    return NextResponse.json({ error: 'Version v2 not found.' }, { status: 404 })
  }

  const diffs = diffBriefs(beforeBrief, afterBrief)
  const changedCount = diffs.filter(d => d.changed).length

  return NextResponse.json({
    briefId: id,
    before: {
      versionId: beforeVersion.versionId,
      versionNumber: beforeVersion.versionNumber,
      label: beforeVersion.label,
      savedAt: beforeVersion.savedAt,
    },
    after: afterVersion
      ? {
          versionId: afterVersion.versionId,
          versionNumber: afterVersion.versionNumber,
          label: afterVersion.label,
          savedAt: afterVersion.savedAt,
        }
      : { versionId: 'current', label: 'Aktueller Stand', savedAt: current.updatedAt },
    changedCount,
    diffs,
  })
}
