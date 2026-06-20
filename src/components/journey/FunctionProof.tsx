'use client'

import { useState } from 'react'

interface ProbeResult { route: string; status: number; ok: boolean; error?: string }
interface ProofReport { verdict: 'works' | 'partial' | 'failed'; headline: string; okCount: number; total: number; results: ProbeResult[] }

/**
 * Journey Companion — Phase 4.1: function proof.
 * Probes a running app's key routes and shows a plain-German verdict.
 */
export function FunctionProof() {
  const [url, setUrl] = useState('')
  const [routes, setRoutes] = useState('/')
  const [report, setReport] = useState<ProofReport | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function prove() {
    setError(''); setReport(null); setBusy(true)
    try {
      const routeList = routes.split(',').map(r => r.trim()).filter(Boolean)
      const res = await fetch('/api/journey/function-proof', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, routes: routeList }),
      })
      const data = await res.json() as ProofReport & { error?: string }
      if (!res.ok) { setError(data.error ?? 'Prüfung fehlgeschlagen'); return }
      setReport(data)
    } catch { setError('Netzwerkfehler') } finally { setBusy(false) }
  }

  const color = report?.verdict === 'works' ? 'text-emerald-300' : report?.verdict === 'partial' ? 'text-amber-300' : 'text-red-300'

  return (
    <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900/40 p-3">
      <p className="text-xs font-medium text-slate-300">🔬 Funktionsbeweis</p>
      <p className="mt-0.5 text-[11px] text-slate-500">Prüft, ob die laufende App wirklich antwortet (URL z.B. von „App live schalten").</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input className="flex-1 min-w-[180px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          placeholder="http://localhost:3001" value={url} onChange={e => setUrl(e.target.value)} />
        <input className="w-40 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          placeholder="Seiten: /, /login" value={routes} onChange={e => setRoutes(e.target.value)} />
        <button onClick={prove} disabled={!url.trim() || busy}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
          {busy ? 'Prüfe …' : 'Funktion prüfen'}
        </button>
      </div>
      {report && (
        <div className="mt-2">
          <p className={`text-xs font-semibold ${color}`}>{report.headline}</p>
          <ul className="mt-1 space-y-0.5 text-[11px] text-slate-400">
            {report.results.map((r, i) => (
              <li key={i}>{r.ok ? '✓' : '✗'} {r.route} — {r.status > 0 ? `HTTP ${r.status}` : (r.error ?? 'Fehler')}</li>
            ))}
          </ul>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-amber-300">{error}</p>}
    </div>
  )
}
