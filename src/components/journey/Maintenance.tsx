'use client'

import { useState } from 'react'
import { BuildProgress } from './BuildProgress'

interface SecurityFinding { severity: string; category: string; message: string }
interface OutdatedDep { name: string; current: string; latest: string; level: string }
interface MaintenanceReport { security: SecurityFinding[]; outdated: OutdatedDep[]; summary: string }

/**
 * Journey Companion — Phase 3.2: on-demand maintenance (security + deps) + fix.
 */
export function Maintenance({ targetRepo }: { targetRepo: string }) {
  const [report, setReport] = useState<MaintenanceReport | null>(null)
  const [busy, setBusy] = useState(false)
  const [followIds, setFollowIds] = useState<string[]>([])
  const [error, setError] = useState('')

  async function check() {
    setError(''); setReport(null); setBusy(true)
    try {
      const res = await fetch('/api/journey/maintenance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetRepo }),
      })
      const data = await res.json() as MaintenanceReport & { error?: string }
      if (!res.ok) { setError(data.error ?? 'Check fehlgeschlagen'); return }
      setReport(data)
    } catch { setError('Netzwerkfehler') } finally { setBusy(false) }
  }

  async function fix(what: 'security' | 'deps') {
    setError(''); setBusy(true)
    const feedback = what === 'security'
      ? 'Behebe die gefundenen Sicherheitslücken (Secrets auslagern, parametrisierte Queries, sichere Defaults) und sichere sie mit Tests ab.'
      : 'Aktualisiere die veralteten Abhängigkeiten (zuerst Patch/Minor gefahrlos, große Updates vorsichtig) und stelle sicher, dass Build + Tests grün bleiben.'
    try {
      const res = await fetch('/api/journey/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetRepo, feedback }),
      })
      const data = await res.json() as { delegationIds?: string[]; error?: string }
      if (!res.ok) { setError(data.error ?? 'Konnte Wartung nicht starten'); return }
      setFollowIds(data.delegationIds ?? [])
    } catch { setError('Netzwerkfehler') } finally { setBusy(false) }
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-300">🛡️ Wartung (Sicherheit & Updates)</p>
        <button onClick={check} disabled={busy} className="text-[11px] text-slate-400 hover:text-slate-200 disabled:opacity-50">prüfen</button>
      </div>
      {report && (
        <div className="mt-2">
          <p className="text-xs font-semibold text-slate-200">{report.summary}</p>
          {report.security.length > 0 && (
            <button onClick={() => fix('security')} disabled={busy}
              className="mt-2 mr-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
              Sicherheitslücken beheben
            </button>
          )}
          {report.outdated.length > 0 && (
            <button onClick={() => fix('deps')} disabled={busy}
              className="mt-2 rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-500 disabled:opacity-50">
              Updates einspielen ({report.outdated.length})
            </button>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-amber-300">{error}</p>}
      {followIds.length > 0 && <BuildProgress delegationIds={followIds} />}
    </div>
  )
}
