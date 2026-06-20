export const dynamic = 'force-dynamic'

/**
 * POST /api/reverse/upload  (multipart/form-data, field "file" = a .zip)
 * Returns: { report: ReverseReport, workspacePath: string }
 *
 * Safe upload path for Slice 3: a ZIP is extracted into an isolated temp
 * workspace (path-traversal + zip-bomb guards in extractZipToWorkspace), then
 * analyzed read-only. The returned workspacePath can be passed to
 * /api/reverse/rebuild as rootPath to plan a rebuild from the upload.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { extractZipToWorkspace, IngestError } from '@/lib/reverse/ingest'
import { analyzeForReverse } from '@/lib/reverse/analyze'

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024 // 50 MB compressed

export async function POST(req: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Erwartet multipart/form-data mit Feld "file"' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Kein "file" im Upload gefunden' }, { status: 400 })
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: `Datei zu groß (> ${MAX_UPLOAD_BYTES / 1024 / 1024} MB)` }, { status: 413 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  try {
    const { workspacePath, fileCount } = await extractZipToWorkspace(buffer)
    const report = analyzeForReverse(workspacePath)
    return NextResponse.json({ report, workspacePath, fileCount })
  } catch (e) {
    if (e instanceof IngestError) return NextResponse.json({ error: e.message }, { status: 422 })
    return NextResponse.json({ error: 'Upload-Verarbeitung fehlgeschlagen' }, { status: 500 })
  }
}
