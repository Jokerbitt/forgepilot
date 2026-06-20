'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Suggestion { id: string; title: string; description: string }

export default function SuggestionsPage() {
  const [goal, setGoal] = useState('')
  const [context, setContext] = useState('')
  const [targetRepo, setTargetRepo] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [custom, setCustom] = useState('')
  const [loading, setLoading] = useState(false)
  const [building, setBuilding] = useState(false)
  const [result, setResult] = useState<{ planId: string; phaseCount: number; delegationIds?: string[] } | null>(null)
  const [error, setError] = useState('')

  async function generate() {
    setError(''); setResult(null); setLoading(true); setSuggestions([]); setSelected(new Set())
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, context }),
      })
      const data = await res.json() as { suggestions?: Suggestion[]; error?: string }
      if (!res.ok) { setError(data.error ?? 'Fehler'); return }
      setSuggestions(data.suggestions ?? [])
      if ((data.suggestions ?? []).length === 0) setError('Keine Vorschläge generiert — beschreibe selbst, was gebaut werden soll.')
    } catch { setError('Netzwerkfehler') } finally { setLoading(false) }
  }

  function toggle(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function build() {
    setError(''); setBuilding(true)
    try {
      const selectedSuggestions = suggestions.filter(s => selected.has(s.id))
      const res = await fetch('/api/suggestions/build', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, context, targetRepo: targetRepo || undefined, selected: selectedSuggestions, custom }),
      })
      const data = await res.json() as { planId?: string; phaseCount?: number; delegationIds?: string[]; error?: string }
      if (!res.ok || !data.planId) { setError(data.error ?? 'Build-Start fehlgeschlagen'); return }
      setResult({ planId: data.planId, phaseCount: data.phaseCount ?? 0, delegationIds: data.delegationIds })
    } catch { setError('Netzwerkfehler') } finally { setBuilding(false) }
  }

  const canBuild = (selected.size > 0 || custom.trim().length > 0) && !building
  const inputCls = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none'

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 text-slate-100">
      <h1 className="text-2xl font-semibold">Next-Step Suggestions</h1>
      <p className="mt-1 text-sm text-slate-400">Ziel beschreiben → Vorschläge wählen (oder eigene) → wird sequenziell geplant, gebaut und validiert.</p>

      <section className="mt-6 space-y-3">
        <textarea className={inputCls} rows={2} placeholder="Ziel / App, z.B. „ProjectFlow zum KI-nativen Projekt-OS ausbauen“" value={goal} onChange={e => setGoal(e.target.value)} />
        <textarea className={inputCls} rows={2} placeholder="Kontext (optional) — Stack, bestehende Features …" value={context} onChange={e => setContext(e.target.value)} />
        <input className={inputCls} placeholder="Ziel-Repo (optional), z.B. /Users/you/dev/projectflow-saas" value={targetRepo} onChange={e => setTargetRepo(e.target.value)} />
        <button onClick={generate} disabled={!goal.trim() || loading}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50">
          {loading ? 'Generiere …' : 'Vorschläge generieren'}
        </button>
      </section>

      {suggestions.length > 0 && (
        <section className="mt-6 space-y-2">
          <h2 className="text-sm font-medium text-slate-300">Vorschläge — wähle aus, was gebaut werden soll</h2>
          {suggestions.map(s => (
            <label key={s.id} className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition ${selected.has(s.id) ? 'border-indigo-500 bg-indigo-950/30' : 'border-slate-700 bg-slate-900 hover:border-slate-600'}`}>
              <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="mt-1 h-4 w-4 accent-indigo-500" />
              <span><span className="block text-sm font-semibold">{s.title}</span><span className="block text-xs text-slate-400">{s.description}</span></span>
            </label>
          ))}
        </section>
      )}

      <section className="mt-4">
        <label className="text-sm font-medium text-slate-300">Sonstiges — selbst beschreiben</label>
        <textarea className={`${inputCls} mt-1`} rows={2} placeholder="Eigener Schritt, der zusätzlich gebaut werden soll …" value={custom} onChange={e => setCustom(e.target.value)} />
      </section>

      {error && <p className="mt-4 rounded-lg border border-amber-700/40 bg-amber-950/20 p-3 text-sm text-amber-300">{error}</p>}

      <button onClick={build} disabled={!canBuild}
        className="mt-5 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50">
        {building ? 'Plane & starte …' : `Planen & bauen${selected.size + (custom.trim() ? 1 : 0) > 0 ? ` (${selected.size + (custom.trim() ? 1 : 0)})` : ''}`}
      </button>

      {result && (
        <section className="mt-6 rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-4">
          <p className="text-sm font-semibold text-emerald-200">✅ {result.phaseCount} Schritt(e) geplant — werden jetzt nacheinander gebaut & validiert.</p>
          <p className="mt-1 text-xs text-emerald-300/80">Plan {result.planId.slice(0, 8)} · jede Phase muss grün bauen + Tests bestehen, bevor die nächste startet.</p>
          <Link href="/delegations" className="mt-3 inline-block rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500">Fortschritt ansehen →</Link>
        </section>
      )}
    </main>
  )
}
