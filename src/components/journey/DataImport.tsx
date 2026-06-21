'use client'

import { useState } from 'react'
import { BuildProgress } from './BuildProgress'

interface ColumnInfo { name: string; type: string; sample?: string }
interface DatasetAnalysis { delimiter: string; headers: string[]; columns: ColumnInfo[]; rowCount: number }

/**
 * Journey Companion — Phase 2.2: import real data (CSV/TSV).
 * Paste or upload a CSV, preview the detected schema, then import it as a
 * data model + seed against the same repo.
 */
export function DataImport({ targetRepo }: { targetRepo: string }) {
  const [csvText, setCsvText] = useState('')
  const [entityName, setEntityName] = useState('')
  const [analysis, setAnalysis] = useState<DatasetAnalysis | null>(null)
  const [busy, setBusy] = useState(false)
  const [followIds, setFollowIds] = useState<string[]>([])
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')

  async function preview() {
    setError(''); setInfo(''); setAnalysis(null); setBusy(true)
    try {
      const res = await fetch('/api/journey/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText, preview: true }),
      })
      const data = await res.json() as { analysis?: DatasetAnalysis; error?: string }
      if (!res.ok || !data.analysis) { setError(data.error ?? 'Vorschau fehlgeschlagen'); return }
      setAnalysis(data.analysis)
    } catch { setError('Netzwerkfehler') } finally { setBusy(false) }
  }

  async function doImport() {
    setError(''); setInfo(''); setBusy(true)
    try {
      const res = await fetch('/api/journey/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText, entityName: entityName || undefined, targetRepo }),
      })
      const data = await res.json() as { delegationIds?: string[]; error?: string }
      if (!res.ok) { setError(data.error ?? 'Import fehlgeschlagen'); return }
      setInfo('Daten werden importiert und eingebaut …')
      setFollowIds(data.delegationIds ?? [])
    } catch { setError('Netzwerkfehler') } finally { setBusy(false) }
  }

  function onFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => { setCsvText(String(reader.result ?? '')); setAnalysis(null) }
    reader.readAsText(file)
  }

  const inputCls = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none'

  return (
    <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900/40 p-3">
      <p className="text-xs font-medium text-slate-300">Echte Daten importieren (CSV/TSV)</p>
      <p className="mt-0.5 text-[11px] text-slate-500">Excel: bitte als CSV exportieren und hier einfügen oder hochladen.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input className={`${inputCls} max-w-[200px]`} placeholder="Name, z.B. Kunde" value={entityName} onChange={e => setEntityName(e.target.value)} />
        <label className="cursor-pointer rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs text-slate-200 hover:border-slate-500">
          📁 CSV-Datei
          <input type="file" accept=".csv,.tsv,text/csv,text/plain" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
        </label>
      </div>
      <textarea className={`${inputCls} mt-2 font-mono text-xs`} rows={3} placeholder={'Name,Alter\nAnna,30\nBen,25'} value={csvText} onChange={e => { setCsvText(e.target.value); setAnalysis(null) }} />
      <div className="mt-2 flex gap-2">
        <button onClick={preview} disabled={csvText.trim().length < 3 || busy}
          className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500 disabled:opacity-50">Vorschau</button>
        <button onClick={doImport} disabled={csvText.trim().length < 3 || busy}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">Importieren & einbauen</button>
      </div>

      {analysis && (
        <div className="mt-2 text-xs text-slate-400">
          <p>{analysis.rowCount} Zeile(n), erkannte Felder:</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {analysis.columns.map(c => <span key={c.name} className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">{c.name}: {c.type}</span>)}
          </div>
        </div>
      )}
      {info && <p className="mt-2 text-xs text-emerald-300">{info}</p>}
      {error && <p className="mt-2 text-xs text-amber-300">{error}</p>}
      {followIds.length > 0 && <BuildProgress delegationIds={followIds} />}
    </div>
  )
}
