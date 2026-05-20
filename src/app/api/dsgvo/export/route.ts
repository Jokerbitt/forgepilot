/**
 * DSGVO Data Export Endpoint — Art. 20 DSGVO (Right to Data Portability)
 *
 * GET /api/dsgvo/export
 *   → Returns a ZIP file download containing all processing records.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { buildDsgvoExportZip } from '@/lib/dsgvo/zip-export'
import { dsgvoLogger } from '@/lib/logger'

export async function GET(): Promise<NextResponse> {
  try {
    const buffer = await buildDsgvoExportZip()

    const date = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const filename = `forgepilot-export-${date}.zip`

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    dsgvoLogger.error({ event: 'dsgvo.export.error', error: err instanceof Error ? err.message : String(err) })
    return new NextResponse(
      JSON.stringify({ error: 'Export fehlgeschlagen. Bitte erneut versuchen.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
