'use client'

import { useState } from 'react'
import Link from 'next/link'

interface ReverseReport {
  appName: string
  languages: Array<{ name: string; fileCount: number }>
  frameworks: string[]
  platform: 'windows' | 'cross-platform' | 'unknown'
  platformReasons: string[]
  databaseEngines: string[]
  modules: string[]
  security: string[]
  techDebt: string[]
  criticality: { level: 'normal' | 'sensitive' | 'critical'; reasons: string[] }
  summary: string
}

interface RebuildResult { planId: string; phaseCount: number; steps: Array<{ title: string }>; targetRepo?: string }

const PLATFORM_LABEL: Record<ReverseReport['platform'], string> = {
  windows: 'Windows-gebunden',
  'cross-platform': 'cross-platform-fähig',
  unknown: 'unklar',
}

export default function ReversePage() {
  const [rootPath, setRootPath] = useState('')
  const [report, setReport] = useState<ReverseReport | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  // rebuild options
  const [targetStack, setTargetStack] = useState('')
  const [migrateDatabase, setMigrateDatabase] = useState('')
  const [redesign, setRedesign] = useState(false)
  const [fixBugs, setFixBugs] = useState(false)
  const [fixSecurity, setFixSecurity] = useState(false)
  const [preserveLogic, setPreserveLogic] = useState(true)
  const [crossPlatform, setCrossPlatform] = useState(false)
  const [custom, setCustom] = useState('')
  const [targetRepo, setTargetRepo] = useState('')
  const [building, setBuilding] = useState(false)
  const [acknowledgeCritical, setAcknowledgeCritical] = useState(false)
  const [result, setResult] = useState<RebuildResult | null>(null)

  async function analyze() {
    setError(''); setReport(null); setResult(null); setAnalyzing(true)
    try {
      const res = await fetch('/api/reverse/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootPath }),
      })
      const data = await res.json() as ReverseReport & { error?: string }
      if (!res.ok) { setError(data.error ?? 'Analyse fehlgeschlagen'); return }
      applyReport(data)
    } catch { setError('Netzwerkfehler') } finally { setAnalyzing(false) }
  }

  function applyReport(data: ReverseReport) {
    setReport(data)
    if (data.databaseEngines.includes('Microsoft SQL Server')) setMigrateDatabase('PostgreSQL')
    if (data.platform === 'windows') setCrossPlatform(true)
    if (data.security.length > 0) setFixSecurity(true)
  }

  async function upload(file: File) {
    setError(''); setReport(null); setResult(null); setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/reverse/upload', { method: 'POST', body: fd })
      const data = await res.json() as { report?: ReverseReport; workspacePath?: string; error?: string }
      if (!res.ok || !data.report) { setError(data.error ?? 'Upload fehlgeschlagen'); return }
      if (data.workspacePath) setRootPath(data.workspacePath) // so rebuild runs on the extracted files
      applyReport(data.report)
    } catch { setError('Netzwerkfehler') } finally { setUploading(false) }
  }

  async function rebuild() {
    setError(''); setResult(null); setBuilding(true)
    try {
      const res = await fetch('/api/reverse/rebuild', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rootPath,
          targetRepo: targetRepo || undefined,
          acknowledgeCritical,
          options: {
            targetStack: targetStack || undefined,
            migrateDatabase: migrateDatabase || undefined,
            redesign, fixBugs, fixSecurity, preserveLogic, crossPlatform,
            custom: custom || undefined,
          },
        }),
      })
      const data = await res.json() as RebuildResult & { error?: string }
      if (!res.ok || !data.planId) { setError(data.error ?? 'Nachbau-Start fehlgeschlagen'); return }
      setResult(data)
    } catch { setError('Netzwerkfehler') } finally { setBuilding(false) }
  }

  const inputCls = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none'
  const check = (v: boolean, set: (b: boolean) => void, label: string, hint: string) => (
    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm">
      <input type="checkbox" checked={v} onChange={e => set(e.target.checked)} className="mt-0.5 h-4 w-4 accent-indigo-500" />
      <span><span className="block font-medium text-slate-200">{label}</span><span className="block text-xs text-slate-400">{hint}</span></span>
    </label>
  )

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 text-slate-100">
      <h1 className="text-2xl font-semibold">Reverse Engineering</h1>
      <p className="mt-1 text-sm text-slate-400">Bestehende App analysieren und plattformunabhängig nachbauen — inkl. C#/.NET, DB-Wechsel, Redesign, Bug-/Security-Fixes.</p>

      <section className="mt-6 space-y-3">
        <input className={inputCls} placeholder="Pfad zur bestehenden App, z.B. /Users/you/dev/leitrechner" value={rootPath} onChange={e => setRootPath(e.target.value)} />
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={analyze} disabled={!rootPath.trim() || analyzing}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50">
            {analyzing ? 'Analysiere …' : 'Pfad analysieren'}
          </button>
          <span className="text-xs text-slate-500">oder</span>
          <label className="cursor-pointer rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500">
            {uploading ? 'Lade hoch …' : '📦 ZIP hochladen'}
            <input type="file" accept=".zip,application/zip" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} disabled={uploading} />
          </label>
        </div>
        <p className="text-xs text-slate-500">Lade die komplette App als ZIP hoch (max. 50 MB) — sie wird sicher entpackt und analysiert.</p>
      </section>

      {error && <p className="mt-5 rounded-lg border border-amber-700/40 bg-amber-950/20 p-3 text-sm text-amber-300">{error}</p>}

      {report && (
        <section className="mt-6 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <h2 className="text-sm font-semibold text-slate-200">Analyse-Report — {report.appName}</h2>
          {report.criticality.level === 'critical' && (
            <p className="mt-2 rounded-lg border border-red-700/50 bg-red-950/30 p-3 text-xs font-medium text-red-300">
              ⛔ Kritische Steuerungssoftware erkannt ({report.criticality.reasons.join('; ')}). Kein autonomer Nachbau ohne ausdrückliche Bestätigung — nur Analyse/Teilmodernisierung unter menschlicher Verifikation.
            </p>
          )}
          {report.criticality.level === 'sensitive' && (
            <p className="mt-2 rounded-lg border border-amber-700/40 bg-amber-950/20 p-3 text-xs text-amber-300">
              ⚠ Sensible Domäne ({report.criticality.reasons.join('; ')}) — Nachbau besonders sorgfältig validieren.
            </p>
          )}
          <p className="mt-2 text-xs text-slate-300">{report.summary}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {report.languages.map(l => <span key={l.name} className="rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-300">{l.name} · {l.fileCount}</span>)}
            {report.frameworks.map(f => <span key={f} className="rounded-md bg-indigo-950/50 px-2 py-0.5 text-xs text-indigo-300">{f}</span>)}
            <span className={`rounded-md px-2 py-0.5 text-xs ${report.platform === 'windows' ? 'bg-amber-900/40 text-amber-300' : 'bg-emerald-900/40 text-emerald-300'}`}>{PLATFORM_LABEL[report.platform]}</span>
            {report.databaseEngines.map(d => <span key={d} className="rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-300">{d}</span>)}
          </div>
          {report.modules.length > 0 && <p className="mt-3 text-xs text-slate-400">Module: {report.modules.join(', ')}</p>}
          {report.security.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-amber-300">
              {report.security.map((s, i) => <li key={i}>⚠ {s}</li>)}
            </ul>
          )}
          {report.techDebt.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-slate-400">
              {report.techDebt.map((s, i) => <li key={i}>• {s}</li>)}
            </ul>
          )}
        </section>
      )}

      {report && (
        <section className="mt-6 space-y-3">
          <h2 className="text-sm font-medium text-slate-300">Nachbau konfigurieren</h2>
          <input className={inputCls} placeholder="Ziel-Stack (optional), z.B. Next.js + PostgreSQL" value={targetStack} onChange={e => setTargetStack(e.target.value)} />
          <input className={inputCls} placeholder="Datenbank migrieren nach (optional), z.B. PostgreSQL" value={migrateDatabase} onChange={e => setMigrateDatabase(e.target.value)} />
          <div className="grid gap-2 sm:grid-cols-2">
            {check(preserveLogic, setPreserveLogic, 'Logik 1:1 beibehalten', 'Paritäts-Tests gegen das Original — beweist Gleichwertigkeit')}
            {check(crossPlatform, setCrossPlatform, 'Plattformunabhängig', 'Läuft auf jedem System, überall deploybar')}
            {check(fixSecurity, setFixSecurity, 'Sicherheitslücken fixen', 'Aus der Analyse gefundene Schwachstellen beheben')}
            {check(fixBugs, setFixBugs, 'Bugs beheben', 'Bekannte Fehler korrigieren + Regressionstests')}
            {check(redesign, setRedesign, 'UI modernisieren', 'Modernes Web-UI statt alter Desktop-Oberfläche')}
          </div>
          <textarea className={inputCls} rows={2} placeholder="Sonstiges (optional) — eigener Nachbau-Schritt …" value={custom} onChange={e => setCustom(e.target.value)} />
          <input className={inputCls} placeholder="Ziel-Repo (optional) — wird sonst automatisch angelegt" value={targetRepo} onChange={e => setTargetRepo(e.target.value)} />
          {report.criticality.level === 'critical' && (
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-red-700/50 bg-red-950/20 p-3 text-sm text-red-200">
              <input type="checkbox" checked={acknowledgeCritical} onChange={e => setAcknowledgeCritical(e.target.checked)} className="mt-0.5 h-4 w-4 accent-red-500" />
              <span>Ich verstehe: Dies ist kritische Steuerungssoftware. Der Nachbau ist eine Annäherung und darf <strong>nicht ungeprüft produktiv</strong> eingesetzt werden. Ich übernehme die Verifikation.</span>
            </label>
          )}
          <button onClick={rebuild} disabled={building || (report.criticality.level === 'critical' && !acknowledgeCritical)}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50">
            {building ? 'Plane & starte Nachbau …' : 'Nachbau planen & starten'}
          </button>
        </section>
      )}

      {result && (
        <section className="mt-6 rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-4">
          <p className="text-sm font-semibold text-emerald-200">✅ Nachbau geplant — {result.phaseCount} Schritt(e), werden nacheinander gebaut & validiert.</p>
          <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-xs text-emerald-300/80">
            {result.steps.map((s, i) => <li key={i}>{s.title}</li>)}
          </ol>
          <Link href="/delegations" className="mt-3 inline-block rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500">Fortschritt ansehen →</Link>
        </section>
      )}
    </main>
  )
}
