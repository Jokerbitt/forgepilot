export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { indexNasFiles } from '@/lib/knowledge/nas-indexer'

export async function POST() {
  try {
    const result = await indexNasFiles()
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
