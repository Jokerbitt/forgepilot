'use client'

import { useState } from 'react'
import { parseCSV } from '@/lib/work-items/csv-parser'
import type { ParsedWorkItem } from '@/lib/work-items/csv-parser'
import type { WorkItem } from '@/lib/models/work-item'

interface CSVImportProps {
  onClose: () => void
  onImported: (items: WorkItem[]) => void
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-amber-300',
  medium: 'text-sky-300',
  low: 'text-slate-400',
}

const TYPE_COLOR: Record<string, string> = {
  bug: 'text-red-300',
  feature: 'text-violet-300',
  task: 'text-sky-300',
  chore: 'text-slate-400',
}

const FORMAT_EXAMPLE = `title,type,priority,description
Fix login redirect bug,bug,high,Redirect fails after OAuth
Add dashboard chart,feature,medium,Revenue chart for Q2
Update README,chore,low,`

export function CSVImport({ onClose, onImported }: CSVImportProps) {
  const [csv, setCsv] = useState('')
  const [preview, setPreview] = useState<ParsedWorkItem[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  const handleCsvChange = (value: string) => {
    setCsv(value)
    setImportError(null)
    if (!value.trim()) {
      setPreview([])
      setParseError(null)
      return
    }
    try {
      const parsed = parseCSV(value)
      setPreview(parsed)
      setParseError(
        parsed.length === 0
          ? 'No valid rows found. Check column headers (title, type, priority, description).'
          : null,
      )
    } catch {
      setParseError('Could not parse CSV. Check the format.')
      setPreview([])
    }
  }

  const handleImport = async () => {
    if (preview.length === 0) return
    setImporting(true)
    setImportError(null)
    try {
      const res = await fetch('/api/work-items/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        setImportError(data.error ?? 'Import failed')
        return
      }
      const data = (await res.json()) as { imported: number; items: WorkItem[] }
      onImported(data.items)
      onClose()
    } catch {
      setImportError('Network error. Please try again.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h2 className="text-base font-semibold text-white">CSV Import — Work Items</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="rounded-lg border border-slate-700/60 bg-slate-800/40 px-4 py-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Format</p>
            <pre className="overflow-x-auto text-xs text-slate-300">{FORMAT_EXAMPLE}</pre>
            <p className="mt-2 text-xs text-slate-500">
              Columns: <span className="text-slate-300">title</span> (required),{' '}
              <span className="text-slate-300">type</span> (task|bug|feature|chore),{' '}
              <span className="text-slate-300">priority</span> (low|medium|high|critical),{' '}
              <span className="text-slate-300">description</span> (optional). Unrecognized values
              fall back to <em>task</em> / <em>medium</em>.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Paste CSV</label>
            <textarea
              value={csv}
              onChange={e => handleCsvChange(e.target.value)}
              rows={7}
              placeholder={
                'title,type,priority,description\nFix login bug,bug,high,OAuth redirect fails'
              }
              className="w-full resize-y rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 font-mono text-sm text-white placeholder-slate-600 outline-none focus:border-sky-600"
            />
          </div>

          {parseError && (
            <p className="rounded-lg border border-red-800/40 bg-red-900/10 px-3 py-2 text-xs text-red-400">
              {parseError}
            </p>
          )}

          {preview.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Preview — first {Math.min(preview.length, 5)} of {preview.length} rows
              </p>
              <div className="overflow-hidden rounded-lg border border-slate-800">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-left text-slate-500">
                      <th className="px-3 py-2">Title</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Priority</th>
                      <th className="hidden px-3 py-2 sm:table-cell">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-900">
                    {preview.slice(0, 5).map((item, i) => (
                      <tr key={i}>
                        <td className="max-w-[180px] truncate px-3 py-2 font-medium text-white">
                          {item.title}
                        </td>
                        <td className={`px-3 py-2 ${TYPE_COLOR[item.type] ?? 'text-slate-300'}`}>
                          {item.type}
                        </td>
                        <td
                          className={`px-3 py-2 ${PRIORITY_COLOR[item.priority] ?? 'text-slate-300'}`}
                        >
                          {item.priority}
                        </td>
                        <td className="hidden max-w-[160px] truncate px-3 py-2 text-slate-500 sm:table-cell">
                          {item.description ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {importError && (
            <p className="rounded-lg border border-red-800/40 bg-red-900/10 px-3 py-2 text-xs text-red-400">
              {importError}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            >
              Abbrechen
            </button>
            <button
              onClick={handleImport}
              disabled={preview.length === 0 || importing}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                preview.length === 0 || importing
                  ? 'cursor-not-allowed bg-slate-700 text-slate-500'
                  : 'bg-sky-600 text-white hover:bg-sky-500'
              }`}
            >
              {importing
                ? 'Importiere…'
                : `Import ${preview.length} Item${preview.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
