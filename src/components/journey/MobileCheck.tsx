'use client'

import { useState } from 'react'
import { BuildProgress } from './BuildProgress'

interface ResponsiveReport {
  score: number
  findings: string[]
  summary: string
}

/**
 * Journey Companion — Phase 3.1: mobile readiness check + one-click fix.
 */
export function MobileCheck({ targetRepo }: { targetRepo: string }) {
  const [report, setReport] = useState<ResponsiveReport | null>(null)
  const [busy, setBusy] = useState(false)
  const [followIds, setFollowIds] = useState<string[]>([])
  const [error, setError] = useState('')

  async function check() {
    setError(''); setReport(null); setBusy(true)
    try {
      const res = await fetch('/api/journey/responsive', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootPath: targetRepo }),
      })
      const data = await res.json() as ResponsiveReport & { error?: string }
      if (!res.ok) { setError(data.error ?? 'Check fehlgeschlagen'); return }
      setReport(data)
    } catch { setError('Netzwerkfehler') } finally { setBusy(false) }
  }

  async function fix() {
    setError(''); setBusy(true)
    try {
      const res = await fetch('/api/journey/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetRepo, feedback: 'Mach die App mobil-tauglich (responsive): Viewport-Meta, responsive Breakpoints, keine festen Pixel-Breiten.' }),
      })
      const data = await res.json() as { delegationIds?: string[]; error?: string }
      if (!res.ok) { setError(data.error ?? 'Konnte Verbesserung nicht starten'); return }
      setFollowIds(data.delegationIds ?? [])
    } catch { setError('Netzwerkfehler') } finally { setBusy(false) }
  }

  const color = !report ? '' : report.score >= 80 ? 'text-emerald-400' : report.score >= 50 ? 'text-amber-300' : 'text-red-300'

  return (
    <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-300">📱 Mobil-Check</p>
        <button onClick={check} disabled={busy} className="text-[11px] text-slate-400 hover:text-slate-200 disabled:opacity-50">prüfen</button>
      </div>
      {report && (
        <div className="mt-2">
          <p className={`text-xs font-semibold ${color}`}>{report.summary}</p>
          {report.findings.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-[11px] text-slate-400">
              {report.findings.map((f, i) => <li key={i}>• {f}</li>)}
            </ul>
          )}
          {report.score < 80 && (
            <button onClick={fix} disabled={busy}
              className="mt-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
              Mobil-tauglich machen
            </button>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-amber-300">{error}</p>}
      {followIds.length > 0 && <BuildProgress delegationIds={followIds} />}
    </div>
  )
}
