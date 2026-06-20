'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Suggestion { id: string; title: string; description: string }
interface Refinement { goal: string; appName: string; appType: string; directions: string[] }

const inputCls = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none'

export default function StudioPage() {
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Step 1 — idea → refinement
  const [idea, setIdea] = useState('')
  const [goal, setGoal] = useState('')
  const [appName, setAppName] = useState('')
  const [directions, setDirections] = useState<string[]>([])

  // Step 2 — features
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [custom, setCustom] = useState('')

  // Step 3 — result
  const [result, setResult] = useState<{ targetRepo?: string; phaseCount: number } | null>(null)

  async function refine() {
    setError(''); setBusy(true)
    try {
      const res = await fetch('/api/studio/refine', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idea }) })
      const data = await res.json() as Refinement & { error?: string }
      if (!res.ok) { setError(data.error ?? 'Fehler'); return }
      setGoal(data.goal); setAppName(data.appName); setDirections(data.directions ?? [])
      setStep(2)
    } catch { setError('Netzwerkfehler') } finally { setBusy(false) }
  }

  async function getFeatures() {
    setError(''); setBusy(true); setSuggestions([]); setSelected(new Set())
    try {
      const res = await fetch('/api/suggestions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ goal }) })
      const data = await res.json() as { suggestions?: Suggestion[] }
      setSuggestions(data.suggestions ?? [])
      setSelected(new Set((data.suggestions ?? []).map(s => s.id)))
    } catch { setError('Netzwerkfehler') } finally { setBusy(false) }
  }

  async function build() {
    setError(''); setBusy(true)
    try {
      const chosen = suggestions.filter(s => selected.has(s.id))
      const res = await fetch('/api/suggestions/build', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, context: `App: ${appName} (${'web app'}).`, selected: chosen, custom }),
      })
      const data = await res.json() as { targetRepo?: string; phaseCount?: number; error?: string }
      if (!res.ok) { setError(data.error ?? 'Build-Start fehlgeschlagen'); return }
      setResult({ targetRepo: data.targetRepo, phaseCount: data.phaseCount ?? 0 }); setStep(4)
    } catch { setError('Netzwerkfehler') } finally { setBusy(false) }
  }

  const toggle = (id: string) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const Stepper = () => (
    <div className="mb-6 flex items-center gap-2 text-xs">
      {['Idee', 'Konzept', 'Bauen', 'Fertig'].map((label, i) => (
        <span key={label} className={`rounded-full px-3 py-1 ${step >= i + 1 ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{i + 1}. {label}</span>
      ))}
    </div>
  )

  return (
    <main className="mx-auto max-w-2xl px-6 py-10 text-slate-100">
      <h1 className="text-2xl font-semibold">Idea Studio</h1>
      <p className="mt-1 text-sm text-slate-400">Von der Idee zur fertigen App — geführt, in Klartext. Kein Code-Wissen nötig.</p>
      <div className="mt-6"><Stepper /></div>

      {step === 1 && (
        <section className="space-y-3">
          <label className="text-sm font-medium text-slate-300">Beschreibe deine Idee in eigenen Worten</label>
          <textarea className={inputCls} rows={4} placeholder="z.B. „Eine App, mit der mein Team Aufgaben plant und ich sehe, was überfällig ist.“" value={idea} onChange={e => setIdea(e.target.value)} />
          <button onClick={refine} disabled={!idea.trim() || busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">{busy ? 'Denke nach …' : 'Weiter →'}</button>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-300">Dein Ziel (anpassbar)</label>
            <textarea className={`${inputCls} mt-1`} rows={3} value={goal} onChange={e => setGoal(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-300">App-Name</label>
            <input className={`${inputCls} mt-1`} value={appName} onChange={e => setAppName(e.target.value)} />
          </div>
          {directions.length > 0 && (
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
              <p className="text-xs font-medium text-slate-400">Mögliche Richtungen (zum Übernehmen klicken):</p>
              <div className="mt-2 space-y-1">
                {directions.map((d, i) => <button key={i} onClick={() => setGoal(d)} className="block w-full rounded px-2 py-1 text-left text-xs text-slate-300 hover:bg-slate-800">→ {d}</button>)}
              </div>
            </div>
          )}
          <button onClick={getFeatures} disabled={!goal.trim() || busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">{busy ? 'Erstelle Konzept …' : 'Funktionen vorschlagen →'}</button>

          {suggestions.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-sm font-medium text-slate-300">Funktionen — abwählen, was du nicht brauchst</p>
              {suggestions.map(s => (
                <label key={s.id} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${selected.has(s.id) ? 'border-indigo-500 bg-indigo-950/30' : 'border-slate-700 bg-slate-900'}`}>
                  <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="mt-1 h-4 w-4 accent-indigo-500" />
                  <span><span className="block text-sm font-semibold">{s.title}</span><span className="block text-xs text-slate-400">{s.description}</span></span>
                </label>
              ))}
              <textarea className={`${inputCls} mt-1`} rows={2} placeholder="Sonstiges — eigene Funktion beschreiben (optional)" value={custom} onChange={e => setCustom(e.target.value)} />
              <button onClick={() => setStep(3)} disabled={selected.size === 0 && !custom.trim()} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">Weiter zum Bauen →</button>
            </div>
          )}
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4">
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
            <p className="text-sm font-semibold">{appName}</p>
            <p className="mt-1 text-xs text-slate-400">{goal}</p>
            <p className="mt-3 text-xs text-slate-300">{selected.size + (custom.trim() ? 1 : 0)} Funktion(en) · Repo wird automatisch erstellt · jede wird gebaut + geprüft, bevor die nächste startet.</p>
          </div>
          <button onClick={build} disabled={busy} className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">{busy ? 'Erstelle Repo & starte …' : '🚀 App autonom bauen'}</button>
        </section>
      )}

      {step === 4 && result && (
        <section className="rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-5">
          <p className="text-sm font-semibold text-emerald-200">✅ Deine App wird gebaut!</p>
          <p className="mt-1 text-xs text-emerald-300/80">{result.phaseCount} Schritt(e) · Repo: {result.targetRepo ?? '—'}. Jeder Schritt baut grün + wird getestet, bevor der nächste kommt.</p>
          <Link href="/delegations" className="mt-3 inline-block rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500">Fortschritt ansehen →</Link>
        </section>
      )}

      {error && <p className="mt-4 rounded-lg border border-amber-700/40 bg-amber-950/20 p-3 text-sm text-amber-300">{error}</p>}
    </main>
  )
}
