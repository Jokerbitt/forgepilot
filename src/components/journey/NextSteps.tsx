'use client'

import { useState } from 'react'

interface NextAction { priority: 'high' | 'medium' | 'low'; title: string; why: string; via?: string }

const DOT: Record<NextAction['priority'], string> = { high: 'bg-red-400', medium: 'bg-amber-400', low: 'bg-slate-500' }

/**
 * Journey Companion — extra idea: "Was als Nächstes?" assistant.
 * Prioritised next steps for the built app.
 */
export function NextSteps({ targetRepo }: { targetRepo: string }) {
  const [actions, setActions] = useState<NextAction[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setError(''); setBusy(true)
    try {
      const res = await fetch('/api/journey/next-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetRepo }),
      })
      const data = await res.json() as { actions?: NextAction[]; error?: string }
      if (!res.ok) { setError(data.error ?? 'Konnte Empfehlungen nicht laden'); return }
      setActions(data.actions ?? [])
    } catch { setError('Netzwerkfehler') } finally { setBusy(false) }
  }

  return (
    <div className="rounded-lg border border-indigo-700/40 bg-indigo-950/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-indigo-200">🧭 Was als Nächstes?</p>
        <button onClick={load} disabled={busy} className="text-[11px] text-indigo-300 hover:text-indigo-100 disabled:opacity-50">{actions ? 'aktualisieren' : 'vorschlagen'}</button>
      </div>
      {actions && actions.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {actions.map((a, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${DOT[a.priority]}`} />
              <span><span className="font-medium text-slate-200">{a.title}</span>{a.via && <span className="text-slate-500"> · {a.via}</span>}<span className="block text-slate-400">{a.why}</span></span>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-2 text-xs text-amber-300">{error}</p>}
    </div>
  )
}
