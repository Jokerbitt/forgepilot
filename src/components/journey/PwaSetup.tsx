'use client'

import { useState } from 'react'
import { BuildProgress } from './BuildProgress'

interface PwaReport {
  score: number
  hasManifest: boolean
  hasServiceWorker: boolean
  installable: boolean
  findings: string[]
  summary: string
}

/**
 * Journey Companion — Phase 4.4: Mobile / PWA.
 * Checks whether the app is installable as a phone app and, with one click,
 * sets up the manifest + service worker via a follow-up build.
 */
export function PwaSetup({ targetRepo }: { targetRepo: string }) {
  const [report, setReport] = useState<PwaReport | null>(null)
  const [busy, setBusy] = useState(false)
  const [followIds, setFollowIds] = useState<string[]>([])
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')

  async function check() {
    setError(''); setInfo(''); setBusy(true)
    try {
      const res = await fetch('/api/journey/pwa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check', rootPath: targetRepo }),
      })
      const data = await res.json() as PwaReport & { error?: string }
      if (!res.ok) { setError(data.error ?? 'Prüfung fehlgeschlagen'); return }
      setReport(data)
    } catch { setError('Netzwerkfehler') } finally { setBusy(false) }
  }

  async function setup() {
    setError(''); setInfo(''); setBusy(true)
    try {
      const res = await fetch('/api/journey/pwa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', targetRepo }),
      })
      const data = await res.json() as { delegationIds?: string[]; error?: string }
      if (!res.ok) { setError(data.error ?? 'Einrichtung fehlgeschlagen'); return }
      setInfo('Handy-App wird eingerichtet (Manifest + Service-Worker) …')
      setFollowIds(data.delegationIds ?? [])
    } catch { setError('Netzwerkfehler') } finally { setBusy(false) }
  }

  const tone = report?.installable ? 'text-emerald-300' : report && report.score > 0 ? 'text-amber-300' : 'text-slate-300'

  return (
    <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900/40 p-3">
      <p className="text-xs font-medium text-slate-300">📱 App fürs Handy (PWA)</p>
      <p className="mt-0.5 text-[11px] text-slate-500">Macht die App auf dem Handy installierbar (Home-Bildschirm) und offline-fähig.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button onClick={check} disabled={busy}
          className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500 disabled:opacity-50">
          {busy ? 'Prüfe …' : 'PWA-Check'}
        </button>
        <button onClick={setup} disabled={busy}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
          Als App fürs Handy einrichten
        </button>
      </div>
      {report && (
        <div className="mt-2">
          <p className={`text-xs font-semibold ${tone}`}>{report.summary}</p>
          {report.findings.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-[11px] text-slate-400">
              {report.findings.map((l, i) => <li key={i}>• {l}</li>)}
            </ul>
          )}
        </div>
      )}
      {info && <p className="mt-2 text-xs text-emerald-300">{info}</p>}
      {error && <p className="mt-2 text-xs text-amber-300">{error}</p>}
      {followIds.length > 0 && <BuildProgress delegationIds={followIds} />}
    </div>
  )
}
