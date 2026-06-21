# PDF Connector

Generate invoices, receipts, and reports as real PDFs — no headless browser.
Requires `pdf-lib`.

## Files
- `src/lib/pdf/document.ts` — `renderPdf(spec)` → PDF bytes (title, meta, table, totals, footer)
- `src/app/api/documents/[id]/pdf/route.ts` — example download route (adapt to your data)

## Usage
```ts
import { renderPdf } from '@/lib/pdf/document'
const bytes = await renderPdf({
  title: 'Invoice',
  meta: [['Invoice #', inv.number], ['Billed to', customer.name]],
  table: { columns: ['Item', 'Qty', 'Price', 'Amount'], rows: lineItems },
  totals: [['Subtotal', sub], ['Tax', tax], ['Total', total]],
})
// stream as application/pdf, or store via the storage connector
```

Pairs with the **billing** block (invoices) and **storage** connector (archive
generated PDFs). For pixel-perfect/marketing PDFs, use a headless-browser
renderer instead.
