export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { indexNasFiles, getIndexStatus } from '@/lib/knowledge/nas-indexer'

export async function GET() {
  try {
    const status = getIndexStatus()
    return NextResponse.json(status)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST() {
  try {
    const result = await indexNasFiles()
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
