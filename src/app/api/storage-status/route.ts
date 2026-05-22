export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getStorageStatus } from '@/lib/storage/cutover-config'

export async function GET() {
  return NextResponse.json(getStorageStatus())
}
