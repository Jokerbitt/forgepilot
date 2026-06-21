export const dynamic = 'force-dynamic'

/**
 * POST /api/reverse/report
 * Body: { rootPath: string }
 * Returns: text/markdown (a downloadable knowledge-writeback document)
 *
 * Renders the reverse-analysis as a portable Markdown report the user can save
 * to their knowledge base / NAS. Reuses analyzeForReverse + renderReportMarkdown.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { analyzeForReverse } from '@/lib/reverse/analyze'
import { renderReportMarkdown, reportFileName } from '@/lib/reverse/report-markdown'

export async function POST(req: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  let body: { rootPath?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 })
  }

  const rootPath = body.rootPath?.trim()
  if (!rootPath) return NextResponse.json({ error: 'rootPath ist erforderlich' }, { status: 400 })

  const report = analyzeForReverse(rootPath)
  const markdown = renderReportMarkdown(report)
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return new NextResponse(markdown, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${reportFileName(report, stamp)}"`,
    },
  })
}
