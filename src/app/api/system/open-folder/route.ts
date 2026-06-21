export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { spawn } from 'child_process'
import { z } from 'zod'
import { parseBody, isValidationError } from '@/lib/validation/api'
import fs from 'fs'

const OpenFolderSchema = z.object({
  path: z.string().min(1, 'Pfad ist erforderlich').max(1000),
  app: z.enum(['finder', 'vscode']).optional().default('finder'),
})

/**
 * POST /api/system/open-folder
 * Opens a local folder path in Finder or VS Code.
 * Only available when running locally (FORGEPILOT_AUTH_DISABLED or localhost).
 */
export async function POST(req: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  const body = await parseBody(req, OpenFolderSchema)
  if (isValidationError(body)) return body

  const { path: folderPath, app } = body

  // Security: path must exist and must not escape outside allowed directories
  if (!fs.existsSync(folderPath)) {
    return NextResponse.json({ error: 'Pfad existiert nicht' }, { status: 400 })
  }

  // Only allow local filesystem paths (no URL protocols, no traversal to /)
  if (!folderPath.startsWith('/') || folderPath.includes('..')) {
    return NextResponse.json({ error: 'Ungültiger Pfad' }, { status: 400 })
  }

  try {
    if (app === 'vscode') {
      spawn('code', [folderPath], { detached: true, stdio: 'ignore' }).unref()
    } else {
      spawn('open', [folderPath], { detached: true, stdio: 'ignore' }).unref()
    }
    return NextResponse.json({ opened: true, path: folderPath, app })
  } catch {
    return NextResponse.json({ error: 'Öffnen fehlgeschlagen — ist VS Code / Finder verfügbar?' }, { status: 500 })
  }
}
