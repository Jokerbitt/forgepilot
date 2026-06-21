'use client'

import { useState } from 'react'

interface Snapshot { ref: string; label: string; date: string }

/**
 * Journey Companion — Phase 2.3: snapshots & safe undo.
 * Save a known-good state and return to it. Restore is non-destructive (the
 * current state is auto-backed-up first).
 */
export function Snapshots({ targetRepo }: { targetRepo: string }) {
  const [snapshots, setSnapshots] = useState<Snapshot[] | null>(null)
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')

  async function call(action: string, extra: Record<string, string> = {}) {
    setError(''); setInfo(''); setBusy(true)
    try {
      const res = await fetch('/api/journey/snapshot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, targetRepo, ...extra }),
      })
      const data = await res.json() as { snapshots?: Snapshot[]; snapshot?: Snapshot; restored?: string; error?: string }
      if (!res.ok) { setError(data.error ?? 'Aktion fehlgeschlagen'); return null }
      return data
    } catch { setError('Netzwerkfehler'); return null } finally { setBusy(false) }
  }

  async function load() { const d = await call('list'); if (d?.snapshots) setSnapshots(d.snapshots) }
  async function create() {
    const d = await call('create', { label })
    if (d?.snapshot) { setInfo(`Snapshot „${d.snapshot.label}" gespeichert.`); setLabel(''); load() }
  }
  async function restore(ref: string, lbl: string) {
    if (!window.confirm(`Zurück zum Stand „${lbl}"? Der aktuelle Stand wird vorher automatisch gesichert.`)) return
    const d = await call('restore', { ref })
    if (d?.restored) { setInfo(`Stand „${lbl}" wiederhergestellt (vorheriger Stand gesichert).`); load() }
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-300">Snapshots & sicheres Zurück</p>
        <button onClick={load} disabled={busy} className="text-[11px] text-slate-400 hover:text-slate-200 disabled:opacity-50">aktualisieren</button>
      </div>
      <div className="mt-2 flex gap-2">
        <input className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          placeholder={'Bezeichnung, z.B. „läuft, vor Umbau"'} value={label} onChange={e => setLabel(e.target.value)} />
        <button onClick={create} disabled={busy}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">📸 Snapshot</button>
      </div>

      {snapshots && snapshots.length === 0 && <p className="mt-2 text-[11px] text-slate-500">Noch keine Snapshots.</p>}
      {snapshots && snapshots.length > 0 && (
        <ul className="mt-2 space-y-1">
          {snapshots.map(s => (
            <li key={s.ref} className="flex items-center justify-between gap-2 text-xs text-slate-400">
              <span className="truncate">{s.label} <span className="text-slate-600">· {s.date.slice(0, 16)}</span></span>
              <button onClick={() => restore(s.ref, s.label)} disabled={busy}
                className="shrink-0 rounded border border-slate-600 px-2 py-0.5 text-[11px] text-slate-300 hover:border-indigo-500 disabled:opacity-50">↩ Zurück</button>
            </li>
          ))}
        </ul>
      )}
      {info && <p className="mt-2 text-xs text-emerald-300">{info}</p>}
      {error && <p className="mt-2 text-xs text-amber-300">{error}</p>}
    </div>
  )
}
