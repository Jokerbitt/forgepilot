'use client'

import { useState } from 'react'

interface CostReviewData {
  verdict: 'cheaper' | 'as-expected' | 'pricier' | 'free'
  headline: string
  budgetExceeded: boolean
  budgetWarning: boolean
  details: string[]
}

/**
 * Journey Companion — Phase 4.2: real-cost review after a build.
 * Shows what the build actually cost vs. the up-front estimate (and budget),
 * in plain German. Loads on demand to keep the post-build view light.
 */
export function CostReview({ delegationIds, appName }: { delegationIds: string[]; appName?: string }) {
  const [report, setReport] = useState<CostReviewData | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setBusy(true)
    try {
      const res = await fetch('/api/journey/cost-review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delegationIds, appName }),
      })
      if (res.ok) setReport(await res.json() as CostReviewData)
    } catch { /* non-critical */ } finally { setBusy(false) }
  }

  if (delegationIds.length === 0) return null

  const alert = report ? report.budgetExceeded || report.verdict === 'pricier' : false
  const tone = alert
    ? { border: 'border-amber-700/40 bg-amber-950/20', text: 'text-amber-200' }
    : { border: 'border-emerald-700/40 bg-emerald-950/20', text: 'text-emerald-200' }

  return (
    <div className="mt-3">
      {!report && (
        <button onClick={load} disabled={busy}
          className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500 disabled:opacity-50">
          {busy ? 'Rechne …' : '💶 Kosten-Rückblick'}
        </button>
      )}
      {report && (
        <div className={`rounded-lg border p-3 ${tone.border}`}>
          <p className={`text-xs font-semibold ${tone.text}`}>{report.headline}</p>
          <ul className="mt-1 space-y-0.5 text-[11px] text-slate-400">
            {report.details.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}
