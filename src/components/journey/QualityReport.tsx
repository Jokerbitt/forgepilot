'use client'

import { useState } from 'react'

interface QualityReportData { headline: string; allPassed: boolean; checkedCount: number; lines: string[] }

/**
 * Journey Companion — extra idea: plain-language quality report after a build.
 */
export function QualityReport({ delegationIds }: { delegationIds: string[] }) {
  const [report, setReport] = useState<QualityReportData | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setBusy(true)
    try {
      const res = await fetch('/api/journey/quality', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delegationIds }),
      })
      if (res.ok) setReport(await res.json() as QualityReportData)
    } catch { /* non-critical */ } finally { setBusy(false) }
  }

  if (delegationIds.length === 0) return null

  return (
    <div className="mt-3">
      {!report && (
        <button onClick={load} disabled={busy}
          className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500 disabled:opacity-50">
          {busy ? 'Prüfe …' : '🔍 Qualitäts-Report'}
        </button>
      )}
      {report && report.checkedCount > 0 && (
        <div className={`rounded-lg border p-3 ${report.allPassed ? 'border-emerald-700/40 bg-emerald-950/20' : 'border-amber-700/40 bg-amber-950/20'}`}>
          <p className={`text-xs font-semibold ${report.allPassed ? 'text-emerald-200' : 'text-amber-200'}`}>{report.headline}</p>
          <ul className="mt-1 space-y-0.5 text-[11px] text-slate-400">
            {report.lines.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </div>
      )}
      {report && report.checkedCount === 0 && <p className="text-[11px] text-slate-500">{report.headline}</p>}
    </div>
  )
}
