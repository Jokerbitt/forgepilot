'use client'

import { useState } from 'react'
import Link from 'next/link'

type Provider = 'local' | 'vercel' | 'docker'

interface DeployOk { status: 'ok'; provider: Provider; url: string; detail: string; pid?: number }
interface DeployErr { status: 'error'; provider: Provider; error: string }
type DeployResult = DeployOk | DeployErr

const PROVIDERS: Array<{ id: Provider; label: string; hint: string }> = [
  { id: 'local', label: 'Lokal starten', hint: 'Baut & startet die App auf deinem Rechner. Kein Account nötig.' },
  { id: 'vercel', label: 'Vercel (öffentlich)', hint: 'Deploy ins Internet via Vercel. Vercel-Login erforderlich.' },
  { id: 'docker', label: 'Docker', hint: 'Baut ein Image und startet einen Container. Docker muss laufen.' },
]

export default function DeployPage() {
  const [repoPath, setRepoPath] = useState('')
  const [provider, setProvider] = useState<Provider>('local')
  const [production, setProduction] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<DeployResult | null>(null)
  const [error, setError] = useState('')

  async function deploy() {
    setError(''); setResult(null); setBusy(true)
    try {
      const res = await fetch('/api/deploy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoPath, provider, production: provider === 'vercel' ? production : undefined }),
      })
      const data = await res.json() as DeployResult & { error?: string }
      setResult(data)
      if (data.status === 'error') setError(data.error)
    } catch { setError('Netzwerkfehler') } finally { setBusy(false) }
  }

  const inputCls = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none'

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 text-slate-100">
      <h1 className="text-2xl font-semibold">App live schalten</h1>
      <p className="mt-1 text-sm text-slate-400">Wähle ein Ziel und schalte deine gebaute App mit einem Klick live — du bekommst eine klare URL zum Öffnen.</p>

      <section className="mt-6 space-y-4">
        <input className={inputCls} placeholder="Repo-Pfad der App, z.B. /Users/you/dev/meine-app" value={repoPath} onChange={e => setRepoPath(e.target.value)} />

        <div className="grid gap-2 sm:grid-cols-3">
          {PROVIDERS.map(p => (
            <button key={p.id} onClick={() => setProvider(p.id)}
              className={`rounded-xl border p-3 text-left transition ${provider === p.id ? 'border-indigo-500 bg-indigo-950/30' : 'border-slate-700 bg-slate-900 hover:border-slate-600'}`}>
              <span className="block text-sm font-semibold">{p.label}</span>
              <span className="mt-1 block text-xs text-slate-400">{p.hint}</span>
            </button>
          ))}
        </div>

        {provider === 'vercel' && (
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={production} onChange={e => setProduction(e.target.checked)} className="h-4 w-4 accent-indigo-500" />
            Production-Deploy (sonst Preview)
          </label>
        )}

        <button onClick={deploy} disabled={!repoPath.trim() || busy}
          className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50">
          {busy ? 'Schalte live …' : 'Live schalten'}
        </button>
        {busy && <p className="text-xs text-slate-400">Das kann ein paar Minuten dauern (Installieren, Bauen, Starten) — bitte warten.</p>}
      </section>

      {error && <p className="mt-5 rounded-lg border border-amber-700/40 bg-amber-950/20 p-3 text-sm text-amber-300">{error}</p>}

      {result?.status === 'ok' && (
        <section className="mt-6 rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-4">
          <p className="text-sm font-semibold text-emerald-200">✅ Live!</p>
          <p className="mt-1 text-xs text-emerald-300/80">{result.detail}</p>
          <a href={result.url} target="_blank" rel="noreferrer"
            className="mt-3 inline-block rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500">
            {result.url} öffnen →
          </a>
        </section>
      )}

      <Link href="/suggestions" className="mt-8 inline-block text-xs text-slate-500 hover:text-slate-300">← Zurück zu Vorschlägen</Link>
    </main>
  )
}
