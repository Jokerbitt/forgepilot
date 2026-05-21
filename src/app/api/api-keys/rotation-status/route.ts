export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import {
  readApiKeysMeta,
  getRotationStatuses,
  hasStaleKeys,
  ROTATION_THRESHOLD_DAYS,
} from '@/lib/api-keys/rotation-tracker'

export async function GET() {
  const meta = readApiKeysMeta()
  const statuses = getRotationStatuses(meta)
  return NextResponse.json({
    thresholdDays: ROTATION_THRESHOLD_DAYS,
    hasStaleKeys: hasStaleKeys(meta),
    keys: statuses,
  })
}
