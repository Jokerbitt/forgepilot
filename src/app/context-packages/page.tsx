'use client'

import { useEffect, useRef, useState } from 'react'
import type { ContextPackage, BuildContextPackageInput, ContextPrivacyMode } from '@/lib/context-packages/types'
import { Badge, EmptyState, StatusDot, cx } from '@/components/ui/primitives'

function readinessTone(score: number): 'success' | 'warning' | 'danger' {
  if (score >= 70) return 'success'
  if (score >= 40) return 'warning'
  return 'danger'
}

function privacyLabel(mode: string): string {
  if (mode === 'local-only') return 'Lokal'
  if (mode === 'hybrid') return 'Hybrid'
  if (mode === 'cloud-approved') return 'Cloud'
  return mode
}

function privacyColor(mode: string): string {
  if (mode === 'local-only') return 'text-emerald-400'
  if (mode === 'hybrid') return 'text-amber-300'
  return 'text-sky-400'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function tokenBarWidth(count: number, budget: number): number {
  return Math.min(100, Math.round((count / Math.max(budget, 1)) * 100))
}

/** Token count badge color: green <2k, yellow <8k, red >=8k */
function tokenCountColor(count: number): string {
  if (count < 2000) return 'text-emerald-400'
  if (count < 8000) return 'text-amber-300'
  return 'text-red-400'
}

interface CreateForm {
  workItemId: string
  title: string
  objective: string
  privacyMode: ContextPrivacyMode
  tokenBudget: string
  tags: string
}

const BLANK_FORM: CreateForm = {
  workItemId: '',
  title: '',
  objective: '',
  privacyMode: 'hybrid',
  tokenBudget: '8000',
  tags: '',
}

function CreateModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (pkg: ContextPackage) => void
}) {
  const [form, setForm] = useState<CreateForm>(BLANK_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const firstInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstInputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = (field: keyof CreateForm, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.workItemId.trim() || !form.title.trim() || !form.objective.trim()) {
      setError('workItemId, Titel und Objective sind Pflichtfelder.')
      return
    }
    setSubmitting(true)
    setError(null)
    const body: BuildContextPackageInput = {
      workItemId: form.workItemId.trim(),
      title: form.title.trim(),
      objective: form.objective.trim(),
      privacyMode: form.privacyMode,
      tokenBudget: parseInt(form.tokenBudget, 10) || 8000,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
    }
    try {
      const res = await fetch('/api/context-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setError(data.error ?? `HTTP ${res.status}`)
        setSubmitting(false)
        return
      }
      const data = await res.json() as { package: ContextPackage }
      onCreate(data.package)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">Neues Context Package</h2>
            <p className="mt-0.5 text-xs text-slate-500">Baut einen token-optimierten Kontext aus Knowledge Cards und Quellen.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-white"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Work Item ID <span className="text-red-400">*</span>
              </label>
              <input
                ref={firstInputRef}
                type="text"
                value={form.workItemId}
                onChange={e => set('workItemId', e.target.value)}
                placeholder="z.B. LOCAL-42"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-sky-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Privacy Mode
              </label>
              <select
                value={form.privacyMode}
                onChange={e => set('privacyMode', e.target.value as ContextPrivacyMode)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-sky-600 focus:outline-none"
              >
                <option value="hybrid">Hybrid</option>
                <option value="local-only">Lokal only</option>
                <option value="cloud-approved">Cloud approved</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Titel <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Kurzer, aussagekräftiger Name"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-sky-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Objective <span className="text-red-400">*</span>
            </label>
            <textarea
              value={form.objective}
              onChange={e => set('objective', e.target.value)}
              placeholder="Was soll der Agent damit erreichen?"
              rows={3}
              className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-sky-600 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Token Budget
              </label>
              <select
                value={form.tokenBudget}
                onChange={e => set('tokenBudget', e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-sky-600 focus:outline-none"
              >
                <option value="4000">4 000 (Haiku)</option>
                <option value="8000">8 000 (Sonnet)</option>
                <option value="12000">12 000 (Opus)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Tags (komma-getrennt)
              </label>
              <input
                type="text"
                value={form.tags}
                onChange={e => set('tags', e.target.value)}
                placeholder="api-route, refactor"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-sky-600 focus:outline-none"
              />
            </div>
          </div>
          {error && (
            <p className="rounded-lg border border-red-800/50 bg-red-900/20 px-3 py-2 text-xs text-red-300">{error}</p>
          )}
          <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-transparent px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg border border-sky-700/80 bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Generiere…' : 'Generieren'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ContextPackagesPage() {
  const [packages, setPackages] = useState<ContextPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ContextPackage | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    fetch('/api/context-packages')
      .then(r => r.json())
      .then((d: ContextPackage[]) => setPackages(Array.isArray(d) ? d.slice().reverse() : []))
      .catch(() => setPackages([]))
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = (pkg: ContextPackage) => {
    setPackages(prev => [pkg, ...prev])
    setSelected(pkg)
    setShowCreate(false)
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl p-6">
        <header className="mb-8 mt-2 flex items-start justify-between border-b border-slate-800 pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Knowledge</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Context Packages</h1>
            <p className="mt-2 text-sm text-slate-400">Token-optimierte Kontextpakete für Agenten-Ausführungen.</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-3 flex items-center gap-2 rounded-lg border border-sky-700/80 bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-500"
          >
            <span>+</span> Neues Package
          </button>
        </header>

        {loading ? (
          <p className="text-sm text-slate-500">Lade Context Packages…</p>
        ) : packages.length === 0 ? (
          <EmptyState
            title="Noch keine Context Packages"
            description="Packages werden automatisch beim Start einer Delegation gebaut oder können manuell erstellt werden."
            action={
              <button
                onClick={() => setShowCreate(true)}
                className="rounded-lg border border-sky-700/80 bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-500"
              >
                + Erstes Package erstellen
              </button>
            }
          />
        ) : (
          <div className="flex gap-4">
            {/* List */}
            <div className={cx('flex-1 min-w-0 space-y-2', selected ? 'hidden sm:block sm:w-1/2 sm:flex-none' : '')}>
              {packages.map(pkg => {
                const tone = readinessTone(pkg.readinessScore)
                const barWidth = tokenBarWidth(pkg.tokenCount, pkg.tokenBudget)
                return (
                  <button
                    key={pkg.id}
                    onClick={() => setSelected(selected?.id === pkg.id ? null : pkg)}
                    className={cx(
                      'w-full rounded-xl border p-4 text-left transition-all',
                      selected?.id === pkg.id
                        ? 'border-sky-700/60 bg-sky-900/10'
                        : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <StatusDot tone={tone} />
                          <span className={cx(
                            'text-xs font-bold',
                            tone === 'success' ? 'text-emerald-400' : tone === 'warning' ? 'text-amber-300' : 'text-red-400'
                          )}>
                            {pkg.readinessScore}%
                          </span>
                          <span className={cx('text-xs font-medium', privacyColor(pkg.privacyMode))}>
                            {privacyLabel(pkg.privacyMode)}
                          </span>
                        </div>
                        <p className="truncate font-medium text-white">{pkg.title}</p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{pkg.objective}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        {/* Token count: green <2k, yellow <8k, red >=8k */}
                        <p className={cx('text-xs font-semibold', tokenCountColor(pkg.tokenCount))}>
                          {pkg.tokenCount.toLocaleString()} tk
                        </p>
                        <p className="text-[10px] text-slate-700">{formatDate(pkg.createdAt)}</p>
                      </div>
                    </div>
                    {/* Token bar */}
                    <div className="mt-3 h-1 w-full rounded-full bg-slate-800">
                      <div
                        className={cx('h-1 rounded-full', barWidth > 90 ? 'bg-red-500' : barWidth > 70 ? 'bg-amber-400' : 'bg-emerald-500')}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] text-slate-700">
                      <span>{pkg.tokenCount.toLocaleString()} / {pkg.tokenBudget.toLocaleString()} Tokens</span>
                      <span>{pkg.sources.length} Quellen</span>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Detail panel */}
            {selected && (
              <div className="w-full sm:w-80 sm:flex-none">
                <div className="sticky top-20 space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <div className="flex items-start justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detail</p>
                    <button onClick={() => setSelected(null)} className="text-slate-600 hover:text-slate-300">✕</button>
                  </div>
                  <h3 className="text-sm font-semibold text-white">{selected.title}</h3>
                  <p className="text-xs leading-relaxed text-slate-400">{selected.objective}</p>

                  <dl className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Readiness</dt>
                      <dd className={cx('font-bold', readinessTone(selected.readinessScore) === 'success' ? 'text-emerald-400' : readinessTone(selected.readinessScore) === 'warning' ? 'text-amber-300' : 'text-red-400')}>
                        {selected.readinessScore}%
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Privacy</dt>
                      <dd className={privacyColor(selected.privacyMode)}>{privacyLabel(selected.privacyMode)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Tokens</dt>
                      <dd className={cx('font-semibold', tokenCountColor(selected.tokenCount))}>
                        {selected.tokenCount.toLocaleString()} / {selected.tokenBudget.toLocaleString()}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Quellen</dt>
                      <dd className="text-slate-300">{selected.sources.length}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Memory Cards</dt>
                      <dd className="text-slate-300">{selected.memoryCardIds.length}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Work Item</dt>
                      <dd className="font-mono text-slate-400">{selected.workItemId}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Erstellt</dt>
                      <dd className="text-slate-400">{formatDate(selected.createdAt)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Läuft ab</dt>
                      <dd className="text-slate-600">{formatDate(selected.expiresAt)}</dd>
                    </div>
                  </dl>

                  {selected.blockers.length > 0 && (
                    <div className="rounded-lg border border-amber-800/40 bg-amber-900/10 p-3">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-amber-400">Blocker</p>
                      <ul className="space-y-1">
                        {selected.blockers.map((b, i) => (
                          <li key={i} className="flex items-start gap-1 text-xs text-amber-300">
                            <span className="mt-0.5 shrink-0">⚠</span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selected.sources.length > 0 && (
                    <div>
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Quellen ({selected.sources.length})
                      </p>
                      <div className="space-y-1.5">
                        {selected.sources.map(src => (
                          <div key={src.sourceId} className={cx('flex items-center justify-between rounded px-2 py-1.5 text-xs', src.included ? 'bg-slate-800' : 'bg-slate-900 opacity-50')}>
                            <span className="truncate text-slate-300">{src.label}</span>
                            <Badge>{src.tokenCount} tk</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Content preview — accordion */}
                  {selected.content && (
                    <details>
                      <summary className="cursor-pointer select-none text-[10px] font-bold uppercase tracking-wide text-slate-500 hover:text-slate-300">
                        Content-Vorschau ▸
                      </summary>
                      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-slate-950 p-2 text-[10px] leading-relaxed text-slate-400">
                        {selected.content.slice(0, 1500)}
                        {selected.content.length > 1500 ? '\n…' : ''}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}
    </main>
  )
}
