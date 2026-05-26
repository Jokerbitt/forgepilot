export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getStorageStatus } from '@/lib/storage/cutover-config'
import { getStoreInventory } from '@/lib/storage/store-inventory'

export async function GET() {
  const status    = getStorageStatus()
  const inventory = getStoreInventory()
  return NextResponse.json({ ...status, inventory })
}
