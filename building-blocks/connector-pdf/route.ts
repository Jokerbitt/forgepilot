/**
 * Example PDF download route — GET /api/documents/[id]/pdf
 * Streams a generated PDF. Copy + adapt to your resource (invoice, report).
 * Copy to: src/app/api/documents/[id]/pdf/route.ts
 */
import { renderPdf } from '@/lib/pdf/document'
// ADAPT: load your data + protect the route with your auth block.
// import { requireUser } from '@/lib/auth/current-user'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  // ADAPT — fetch the real record and map it into the spec:
  const bytes = await renderPdf({
    title: 'Invoice',
    meta: [['Invoice #', id], ['Date', new Date().toISOString().slice(0, 10)]],
    table: {
      columns: ['Item', 'Qty', 'Price', 'Amount'],
      rows: [['Pro plan — monthly', 1, '$29.00', '$29.00']],
    },
    totals: [['Subtotal', '$29.00'], ['Tax (0%)', '$0.00'], ['Total', '$29.00']],
    footer: 'Thank you for your business.',
  })

  return new Response(bytes as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="invoice-${id}.pdf"`,
    },
  })
}
