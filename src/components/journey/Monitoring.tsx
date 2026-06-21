'use client'

import { useState } from 'react'

type OpsStatus = 'healthy' | 'degraded' | 'down'
interface OperationsReport {
  status: OpsStatus
  headline: string
  okCount: number
  total: number
  avgLatencyMs: number
  slowestRoute: string | null
  consecutiveFailures: number
  lines: string[]
}

/**
 * Journey Companion — Phase 4.3: operations monitoring.
 * Probes a live app's key routes with response times and shows a plain-German
 * traffic-light status (🟢/🟡/🔴). ForgePilot as operator, not just generator.
 */
export function Monitoring() {
  const [url, setUrl] = useState('')
  const [routes, setRoutes] = useState('/')
  const [report, setReport] = useState<OperationsReport | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function check() {
    setError(''); setReport(null); setBusy(true)
    try {
      const routeList = routes.split(',').map(r => r.trim()).filter(Boolean)
      const res = await fetch('/api/journey/monitoring', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, routes: routeList }),
      })
      const data = await res.json() as OperationsReport & { error?: string }
      if (!res.ok) { setError(data.error ?? 'Prüfung fehlgeschlagen'); return }
      setReport(data)
    } catch { setError('Netzwerkfehler') } finally { setBusy(false) }
  }

  const tone = report?.status === 'healthy' ? 'text-emerald-300' : report?.status === 'degraded' ? 'text-amber-300' : 'text-red-300'

  return (
    <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900/40 p-3">
      <p className="text-xs font-medium text-slate-300">📡 Betriebs-Monitor</p>
      <p className="mt-0.5 text-[11px] text-slate-500">Prüft eine live geschaltete App auf Erreichbarkeit + Antwortzeit (🟢/🟡/🔴) und merkt sich Ausfälle in Folge.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input className="flex-1 min-w-[180px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          placeholder="https://meine-app.de" value={url} onChange={e => setUrl(e.target.value)} />
        <input className="w-40 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          placeholder="Seiten: /, /login" value={routes} onChange={e => setRoutes(e.target.value)} />
        <button onClick={check} disabled={!url.trim() || busy}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
          {busy ? 'Prüfe …' : 'Status prüfen'}
        </button>
      </div>
      {report && (
        <div className="mt-2">
          <p className={`text-xs font-semibold ${tone}`}>{report.headline}</p>
          <ul className="mt-1 space-y-0.5 text-[11px] text-slate-400">
            {report.lines.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-amber-300">{error}</p>}
    </div>
  )
}
