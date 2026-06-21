export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import {
  getCachedOrShallowRunnerReadiness,
  getRunnerReadiness,
  writeCachedRunnerReadiness,
} from '@/lib/system/runner-readiness'

export async function GET() {
  return NextResponse.json(getCachedOrShallowRunnerReadiness())
}

export async function POST() {
  const readiness = getRunnerReadiness({ deep: true })
  writeCachedRunnerReadiness(readiness)
  return NextResponse.json(readiness)
}
