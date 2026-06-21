'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BuildProgress } from '@/components/journey/BuildProgress'
import { AppFeedback } from '@/components/journey/AppFeedback'
import { QualityReport } from '@/components/journey/QualityReport'
import { CostReview } from '@/components/journey/CostReview'

interface Suggestion { id: string; title: string; description: string }

interface StepCostEstimate {
  step: { title: string }
  isLocal: boolean
  isFree: boolean
  estimatedCostEur: number
  plainText: string
}
interface PlanCostEstimate {
  steps: StepCostEstimate[]
  totalCostEur: number
  localCount: number
  cloudCount: number
  summary: string
}

interface CodebaseAnalysis {
  appName: string
  stack: string[]
  dependencies: string[]
  sourceDirs: string[]
  hasTests: boolean
  hasTypeScript: boolean
  hasCI: boolean
  hasReadme: boolean
  signals: string[]
}

type Mode = 'new' | 'improve'

const TEMPLATES: Array<{ id: string; name: string; emoji: string; description: string }> = [
  { id: 'crm', name: 'CRM / Kundenverwaltung', emoji: '👥', description: 'Kontakte, Firmen, Notizen und Aufgaben.' },
  { id: 'booking', name: 'Buchungstool', emoji: '📅', description: 'Termine/Ressourcen mit Kalenderübersicht.' },
  { id: 'shop', name: 'Online-Shop', emoji: '🛒', description: 'Produkte, Warenkorb und Bestellungen.' },
  { id: 'blog', name: 'Blog / CMS', emoji: '📝', description: 'Artikel schreiben und veröffentlichen.' },
  { id: 'tasks', name: 'Aufgaben-Board', emoji: '✅', description: 'Kanban mit Spalten und Drag & Drop.' },
  { id: 'inventory', name: 'Bestandsverwaltung', emoji: '📦', description: 'Artikel, Bestände und Bewegungen.' },
]

export default function SuggestionsPage() {
  const [mode, setMode] = useState<Mode>('new')
  const [goal, setGoal] = useState('')
  const [context, setContext] = useState('')
  const [targetRepo, setTargetRepo] = useState('')
  const [focus, setFocus] = useState('')
  const [analysis, setAnalysis] = useState<CodebaseAnalysis | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [custom, setCustom] = useState('')
  const [loading, setLoading] = useState(false)
  const [building, setBuilding] = useState(false)
  const [result, setResult] = useState<{ planId: string; phaseCount: number; delegationIds?: string[]; targetRepo?: string } | null>(null)
  const [error, setError] = useState('')
  const [cost, setCost] = useState<PlanCostEstimate | null>(null)
  const [costing, setCosting] = useState(false)

  function switchMode(next: Mode) {
    setMode(next); setError(''); setResult(null); setSuggestions([]); setSelected(new Set()); setAnalysis(null); setCost(null)
  }

  function chosenSteps() {
    const steps = suggestions.filter(s => selected.has(s.id)).map(s => ({ title: s.title, description: s.description }))
    if (custom.trim()) steps.push({ title: 'Eigener Schritt', description: custom.trim() })
    return steps
  }

  async function previewCost() {
    setError(''); setCost(null); setCosting(true)
    try {
      const res = await fetch('/api/cost-routing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps: chosenSteps() }),
      })
      const data = await res.json() as PlanCostEstimate & { error?: string }
      if (!res.ok) { setError(data.error ?? 'Kostenschätzung fehlgeschlagen'); return }
      setCost(data)
    } catch { setError('Netzwerkfehler') } finally { setCosting(false) }
  }

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

  async function analyze() {
    setError(''); setResult(null); setLoading(true); setSuggestions([]); setSelected(new Set()); setAnalysis(null)
    try {
      const res = await fetch('/api/suggestions/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetRepo, focus: focus || undefined }),
      })
      const data = await res.json() as { analysis?: CodebaseAnalysis; suggestions?: Suggestion[]; error?: string }
      if (!res.ok) { setError(data.error ?? 'Fehler'); return }
      setAnalysis(data.analysis ?? null)
      setSuggestions(data.suggestions ?? [])
      // Use the analyzed app name as the build goal so the plan reads naturally.
      if (data.analysis?.appName) setGoal(`Verbesserungen für ${data.analysis.appName}`)
      if ((data.suggestions ?? []).length === 0) setError('Keine Vorschläge generiert — beschreibe selbst, was verbessert werden soll.')
    } catch { setError('Netzwerkfehler') } finally { setLoading(false) }
  }

  function toggle(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    setCost(null) // selection changed → previous estimate is stale
  }

  async function startTemplate(templateId: string) {
    setError(''); setResult(null); setLoading(true)
    try {
      const res = await fetch('/api/journey/template', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, targetRepo: targetRepo || undefined }),
      })
      const data = await res.json() as { planId?: string; phaseCount?: number; delegationIds?: string[]; targetRepo?: string; error?: string }
      if (!res.ok || !data.planId) { setError(data.error ?? 'Vorlage-Start fehlgeschlagen'); return }
      setResult({ planId: data.planId, phaseCount: data.phaseCount ?? 0, delegationIds: data.delegationIds, targetRepo: data.targetRepo })
    } catch { setError('Netzwerkfehler') } finally { setLoading(false) }
  }

  async function build() {
    setError(''); setBuilding(true)
    try {
      const selectedSuggestions = suggestions.filter(s => selected.has(s.id))
      const res = await fetch('/api/suggestions/build', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, context, targetRepo: targetRepo || undefined, selected: selectedSuggestions, custom }),
      })
      const data = await res.json() as { planId?: string; phaseCount?: number; delegationIds?: string[]; targetRepo?: string; error?: string }
      if (!res.ok || !data.planId) { setError(data.error ?? 'Build-Start fehlgeschlagen'); return }
      setResult({ planId: data.planId, phaseCount: data.phaseCount ?? 0, delegationIds: data.delegationIds, targetRepo: data.targetRepo })
    } catch { setError('Netzwerkfehler') } finally { setBuilding(false) }
  }

  const canBuild = (selected.size > 0 || custom.trim().length > 0) && !building
  const inputCls = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none'

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 text-slate-100">
      <h1 className="text-2xl font-semibold">Next-Step Suggestions</h1>
      <p className="mt-1 text-sm text-slate-400">Vorschläge wählen (oder eigene) → wird sequenziell geplant, gebaut und validiert.</p>

      <div className="mt-5 inline-flex rounded-lg border border-slate-700 bg-slate-900 p-1 text-sm">
        <button onClick={() => switchMode('new')}
          className={`rounded-md px-3 py-1.5 font-medium transition ${mode === 'new' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'}`}>
          Neue Idee
        </button>
        <button onClick={() => switchMode('improve')}
          className={`rounded-md px-3 py-1.5 font-medium transition ${mode === 'improve' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'}`}>
          Bestehende App verbessern
        </button>
      </div>

      {mode === 'new' ? (
        <section className="mt-4 space-y-3">
          <textarea className={inputCls} rows={2} placeholder="Ziel / App, z.B. „ProjectFlow zum KI-nativen Projekt-OS ausbauen“" value={goal} onChange={e => setGoal(e.target.value)} />
          <textarea className={inputCls} rows={2} placeholder="Kontext (optional) — Stack, bestehende Features …" value={context} onChange={e => setContext(e.target.value)} />
          <input className={inputCls} placeholder="Ziel-Repo (optional), z.B. /Users/you/dev/projectflow-saas" value={targetRepo} onChange={e => setTargetRepo(e.target.value)} />
          <button onClick={generate} disabled={!goal.trim() || loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50">
            {loading ? 'Generiere …' : 'Vorschläge generieren'}
          </button>

          <div className="pt-2">
            <p className="text-xs font-medium text-slate-300">…oder starte mit einer Vorlage:</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => startTemplate(t.id)} disabled={loading}
                  className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-left transition hover:border-indigo-500 disabled:opacity-50">
                  <span className="block text-sm font-semibold">{t.emoji} {t.name}</span>
                  <span className="mt-0.5 block text-xs text-slate-400">{t.description}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className="mt-4 space-y-3">
          <p className="text-xs text-slate-400">Pfad zu einer bestehenden App angeben — ForgePilot analysiert Stack, Struktur und Schwachstellen und schlägt passende Verbesserungen vor.</p>
          <input className={inputCls} placeholder="Repo-Pfad der App, z.B. /Users/you/dev/meine-app" value={targetRepo} onChange={e => setTargetRepo(e.target.value)} />
          <input className={inputCls} placeholder="Fokus (optional), z.B. Tests, Performance, Sicherheit" value={focus} onChange={e => setFocus(e.target.value)} />
          <button onClick={analyze} disabled={!targetRepo.trim() || loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50">
            {loading ? 'Analysiere …' : 'App analysieren & Vorschläge'}
          </button>
        </section>
      )}

      {analysis && (
        <section className="mt-5 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <h2 className="text-sm font-semibold text-slate-200">Analyse — {analysis.appName}</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {analysis.stack.map(s => <span key={s} className="rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-300">{s}</span>)}
            <span className={`rounded-md px-2 py-0.5 text-xs ${analysis.hasTests ? 'bg-emerald-900/40 text-emerald-300' : 'bg-amber-900/40 text-amber-300'}`}>Tests: {analysis.hasTests ? 'ja' : 'nein'}</span>
            <span className={`rounded-md px-2 py-0.5 text-xs ${analysis.hasCI ? 'bg-emerald-900/40 text-emerald-300' : 'bg-amber-900/40 text-amber-300'}`}>CI: {analysis.hasCI ? 'ja' : 'nein'}</span>
            <span className={`rounded-md px-2 py-0.5 text-xs ${analysis.hasReadme ? 'bg-emerald-900/40 text-emerald-300' : 'bg-amber-900/40 text-amber-300'}`}>README: {analysis.hasReadme ? 'ja' : 'nein'}</span>
          </div>
          {analysis.signals.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-slate-400">
              {analysis.signals.map((sig, i) => <li key={i}>• {sig}</li>)}
            </ul>
          )}
        </section>
      )}

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
        <textarea className={`${inputCls} mt-1`} rows={2} placeholder="Eigener Schritt, der zusätzlich gebaut werden soll …" value={custom} onChange={e => { setCustom(e.target.value); setCost(null) }} />
      </section>

      {(selected.size > 0 || custom.trim().length > 0) && (
        <section className="mt-4">
          <button onClick={previewCost} disabled={costing}
            className="rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 disabled:opacity-50">
            {costing ? 'Schätze Kosten …' : '💶 Was kostet das? (lokal/Cloud schätzen)'}
          </button>
          {cost && (
            <div className="mt-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
              <p className="text-sm font-semibold text-slate-200">{cost.summary}</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-400">
                {cost.steps.map((c, i) => (
                  <li key={i}>
                    <span className={c.isFree || c.isLocal ? 'text-emerald-400' : 'text-amber-300'}>{c.isFree || c.isLocal ? '○ lokal' : '☁ Cloud'}</span>{' '}{c.plainText}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {error && <p className="mt-4 rounded-lg border border-amber-700/40 bg-amber-950/20 p-3 text-sm text-amber-300">{error}</p>}

      <button onClick={build} disabled={!canBuild}
        className="mt-5 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50">
        {building ? 'Plane & starte …' : `Planen & bauen${selected.size + (custom.trim() ? 1 : 0) > 0 ? ` (${selected.size + (custom.trim() ? 1 : 0)})` : ''}`}
      </button>

      {result && (
        <section className="mt-6 rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-4">
          <p className="text-sm font-semibold text-emerald-200">✅ {result.phaseCount} Schritt(e) geplant — werden jetzt nacheinander gebaut & validiert.</p>
          <p className="mt-1 text-xs text-emerald-300/80">Plan {result.planId.slice(0, 8)} · jede Phase muss grün bauen + Tests bestehen, bevor die nächste startet.</p>
          {result.delegationIds && result.delegationIds.length > 0 && <BuildProgress delegationIds={result.delegationIds} />}
          {result.delegationIds && result.delegationIds.length > 0 && <QualityReport delegationIds={result.delegationIds} />}
          {result.delegationIds && result.delegationIds.length > 0 && <CostReview delegationIds={result.delegationIds} />}
          <Link href="/delegations" className="mt-3 inline-block rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500">Details ansehen →</Link>
          {result.targetRepo && <AppFeedback targetRepo={result.targetRepo} />}
        </section>
      )}
    </main>
  )
}
