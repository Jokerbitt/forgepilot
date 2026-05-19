import { NextResponse } from 'next/server'
import { findProjectBriefById } from '@/lib/project-briefs'
import { generateBriefPdf, briefPdfFilename } from '@/lib/project-briefs/pdf-export'

interface RouteParams {
  params: { id: string }
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const brief = findProjectBriefById(params.id)
    if (!brief) {
      return NextResponse.json({ error: 'Project brief not found' }, { status: 404 })
    }

    const pdfBuffer = generateBriefPdf(brief)
    const filename = briefPdfFilename(brief)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('PDF export error:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
