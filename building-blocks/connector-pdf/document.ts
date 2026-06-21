/**
 * PDF connector — generate simple documents (invoices, reports, receipts).
 * Requires: npm i pdf-lib
 *
 * A small, dependency-light builder: title, meta lines, a table, and totals —
 * enough for invoices and summaries without a headless browser.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export interface PdfTable {
  columns: string[]
  rows: Array<Array<string | number>>
}

export interface PdfDocSpec {
  title: string
  /** Key/value lines under the title (e.g. Invoice #, Date, Billed to). */
  meta?: Array<[string, string]>
  table?: PdfTable
  /** Right-aligned summary lines (e.g. Subtotal, Tax, Total). */
  totals?: Array<[string, string]>
  /** Footer note. */
  footer?: string
}

/** Render a PdfDocSpec to PDF bytes. */
export async function renderPdf(spec: PdfDocSpec): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([595, 842]) // A4 portrait, points
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const ink = rgb(0.1, 0.1, 0.12)
  const muted = rgb(0.45, 0.45, 0.5)
  const margin = 48
  let y = 842 - margin

  const text = (s: string, x: number, yy: number, size = 11, f = font, color = ink) =>
    page.drawText(s, { x, y: yy, size, font: f, color })

  text(spec.title, margin, y, 20, bold)
  y -= 30
  for (const [k, v] of spec.meta ?? []) {
    text(k, margin, y, 10, font, muted)
    text(v, margin + 110, y, 10, bold)
    y -= 16
  }
  y -= 10

  if (spec.table) {
    const colWidth = (595 - margin * 2) / spec.table.columns.length
    spec.table.columns.forEach((c, i) => text(c, margin + i * colWidth, y, 10, bold, muted))
    y -= 6
    page.drawLine({ start: { x: margin, y }, end: { x: 595 - margin, y }, thickness: 0.5, color: muted })
    y -= 16
    for (const row of spec.table.rows) {
      row.forEach((cell, i) => text(String(cell), margin + i * colWidth, y, 10))
      y -= 16
      if (y < margin + 80) { y = 842 - margin; doc.addPage([595, 842]) }
    }
  }

  y -= 14
  for (const [k, v] of spec.totals ?? []) {
    text(k, 595 - margin - 200, y, 11, bold, muted)
    text(v, 595 - margin - 70, y, 11, bold)
    y -= 18
  }

  if (spec.footer) text(spec.footer, margin, margin, 9, font, muted)

  return doc.save()
}
