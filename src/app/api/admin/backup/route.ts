/**
 * GET /api/admin/backup
 *
 * Reads all config/*.json files and returns them as a single JSON bundle.
 * The response includes a timestamp and each file's content keyed by filename.
 * Sensitive files (api-keys.json, ai-providers.json) are included but the
 * caller should treat the download as confidential.
 *
 * M253 — Config Backup (Phase 8-A)
 */
export const dynamic = 'force-dynamic'

import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'

const CONFIG_DIR = path.join(process.cwd(), 'config')

export async function GET() {
  try {
    const files = fs.readdirSync(CONFIG_DIR).filter(f => f.endsWith('.json'))

    const bundle: Record<string, unknown> = {}
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(CONFIG_DIR, file), 'utf-8')
        bundle[file] = JSON.parse(raw)
      } catch {
        bundle[file] = null
      }
    }

    const payload = {
      _meta: {
        createdAt: new Date().toISOString(),
        fileCount: files.length,
        files,
      },
      config: bundle,
    }

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="forgepilot-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: `Backup failed: ${String(err)}` }, { status: 500 })
  }
}
