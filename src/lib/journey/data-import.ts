/**
 * Journey Companion — Phase 2.2: import real data (CSV/TSV) → schema + seed.
 *
 * A non-techie pastes/uploads a CSV; ForgePilot detects the delimiter, columns
 * and their types, and turns it into a build step that creates a matching data
 * model + seed so the app isn't empty. Pure, dependency-free (RFC4180-ish parser).
 *
 * Excel (.xlsx) is intentionally out of scope here (binary, needs a new
 * dependency) — users export to CSV; flagged in the UI.
 */

export type ColumnType = 'number' | 'boolean' | 'date' | 'string'

export interface ColumnInfo {
  name: string
  type: ColumnType
  /** A non-empty sample value, if any. */
  sample?: string
}

export interface DatasetAnalysis {
  delimiter: ',' | ';' | '\t'
  headers: string[]
  columns: ColumnInfo[]
  rowCount: number
}

/** Detect the most likely delimiter from the header line. */
export function detectDelimiter(text: string): ',' | ';' | '\t' {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const counts: Array<[',' | ';' | '\t', number]> = [
    [',', (firstLine.match(/,/g) ?? []).length],
    [';', (firstLine.match(/;/g) ?? []).length],
    ['\t', (firstLine.match(/\t/g) ?? []).length],
  ]
  counts.sort((a, b) => b[1] - a[1])
  return counts[0]![1] > 0 ? counts[0]![0] : ','
}

/** Parse delimited text (RFC4180-ish: quoted fields, escaped "" quotes, newlines in quotes). */
export function parseDelimited(text: string, delimiter?: ',' | ';' | '\t'): string[][] {
  const delim = delimiter ?? detectDelimiter(text)
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delim) {
      row.push(field); field = ''
    } else if (ch === '\n') {
      row.push(field); rows.push(row); field = ''; row = []
    } else field += ch
  }
  // flush last field/row if any content
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows.filter(r => r.length > 1 || (r.length === 1 && r[0]!.trim() !== ''))
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2})?|^\d{1,2}[./]\d{1,2}[./]\d{2,4}$/

/** Infer a column type from its sample values (empty values ignored). */
export function inferColumnType(values: string[]): ColumnType {
  const nonEmpty = values.map(v => v.trim()).filter(Boolean)
  if (nonEmpty.length === 0) return 'string'
  const isAll = (pred: (v: string) => boolean) => nonEmpty.every(pred)
  if (isAll(v => /^-?\d+(\.\d+)?$/.test(v))) return 'number'
  if (isAll(v => /^(true|false|ja|nein|yes|no|0|1)$/i.test(v))) return 'boolean'
  if (isAll(v => DATE_RE.test(v))) return 'date'
  return 'string'
}

function slugColumn(name: string, index: number): string {
  const cleaned = name.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')
  return cleaned || `spalte_${index + 1}`
}

/** Analyze a CSV/TSV string into headers, typed columns and a row count. */
export function analyzeDataset(text: string): DatasetAnalysis {
  const delimiter = detectDelimiter(text)
  const matrix = parseDelimited(text, delimiter)
  if (matrix.length === 0) {
    return { delimiter, headers: [], columns: [], rowCount: 0 }
  }
  const rawHeaders = matrix[0]!
  const headers = rawHeaders.map((h, i) => slugColumn(h, i))
  const dataRows = matrix.slice(1)

  const columns: ColumnInfo[] = headers.map((name, col) => {
    const values = dataRows.map(r => r[col] ?? '')
    const sample = values.find(v => v.trim() !== '')
    return { name, type: inferColumnType(values), sample: sample?.trim() }
  })

  return { delimiter, headers, columns, rowCount: dataRows.length }
}

export interface SeedStep {
  title: string
  description: string
}

/** Turn a dataset analysis into a build step that creates a model + seed. */
export function datasetToSeedStep(analysis: DatasetAnalysis, entityName = 'Datensatz'): SeedStep | null {
  if (analysis.columns.length === 0 || analysis.rowCount === 0) return null
  const cols = analysis.columns.map(c => `${c.name}: ${c.type}`).join(', ')
  return {
    title: `Daten importieren (${entityName})`,
    description: `Lege ein Datenmodell „${entityName}" mit den Feldern [${cols}] an und befülle es mit den ${analysis.rowCount} importierten Zeilen als Seed. Bestehendes Verhalten erhalten; Build grün + Tests bestehen.`,
  }
}
