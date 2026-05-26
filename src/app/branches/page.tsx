'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Check, ChevronRight, GitPullRequest, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { cx } from '@/components/ui/primitives'

interface PullRequestSummary {
  number: number
  title: string
  url: string
  state: 'open' | 'closed'
  draft: boolean
  author?: string
  headRef: string
  headSha: string
  baseRef: string
  updatedAt: string
  mergeable: boolean | null
  mergeableState?: string
  additions: number
  deletions: number
  changedFiles: number
  commits: number
  risk: 'low' | 'medium' | 'high'
}

interface PullRequestPreview extends PullRequestSummary {
  body?: string
  files: Array<{
    filename: string
    status: string
    additions: number
    deletions: number
    changes: number
    patchPreview?: string
  }>
  commitMessages: Array<{ sha: string; message: string; url?: string }>
  checks: {
    state: 'success' | 'failure' | 'pending' | 'error' | 'unknown'
    items: Array<{ name: string; status: string; url?: string }>
  }
  mergeRecommendation: {
    status: 'ready' | 'review' | 'blocked'
    reasons: string[]
  }
}

const riskTone: Record<PullRequestSummary['risk'], string> = {
  low: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  medium: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  high: 'border-red-500/20 bg-red-500/10 text-red-300',
}

const recommendationTone: Record<PullRequestPreview['mergeRecommendation']['status'], string> = {
  ready: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200',
  review: 'border-amber-500/25 bg-amber-500/10 text-amber-200',
  blocked: 'border-red-500/25 bg-red-500/10 text-red-200',
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

export default function BranchReviewPage() {
  const [pullRequests, setPullRequests] = useState<PullRequestSummary[]>([])
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null)
  const [preview, setPreview] = useState<PullRequestPreview | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [merging, setMerging] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reviewGate, setReviewGate] = useState({
    filesReviewed: false,
    checksReviewed: false,
    noSecrets: false,
  })

  const selected = useMemo(
    () => pullRequests.find(pr => pr.number === selectedNumber) ?? pullRequests[0],
    [pullRequests, selectedNumber],
  )

  const loadPullRequests = async () => {
    setLoadingList(true)
    setError(null)
    try {
      const res = await fetch('/api/github/pull-requests')
      const data = await res.json() as { pullRequests?: PullRequestSummary[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Pull Requests konnten nicht geladen werden')
      setPullRequests(data.pullRequests ?? [])
      setSelectedNumber(current => current ?? data.pullRequests?.[0]?.number ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pull Requests konnten nicht geladen werden')
    } finally {
      setLoadingList(false)
    }
  }

  const loadPreview = async (number: number) => {
    setLoadingPreview(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/github/pull-requests/${number}`)
      const data = await res.json() as PullRequestPreview & { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Preview konnte nicht geladen werden')
      setPreview(data)
      setReviewGate({ filesReviewed: false, checksReviewed: false, noSecrets: false })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview konnte nicht geladen werden')
      setPreview(null)
    } finally {
      setLoadingPreview(false)
    }
  }

  useEffect(() => { void loadPullRequests() }, [])

  useEffect(() => {
    if (selected?.number) void loadPreview(selected.number)
  }, [selected?.number])

  const allReviewChecksDone = reviewGate.filesReviewed && reviewGate.checksReviewed && reviewGate.noSecrets
  const canMergeSelected = Boolean(
    preview &&
    preview.mergeRecommendation.status === 'ready' &&
    allReviewChecksDone &&
    !merging,
  )

  const mergeSelected = async () => {
    if (!preview) return
    setMerging(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/github/pull-requests/${preview.number}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true, sha: preview.headSha, review: reviewGate }),
      })
      const data = await res.json() as { ok?: boolean; error?: string; result?: { message?: string } }
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Merge fehlgeschlagen')
      setMessage(data.result?.message ?? `PR #${preview.number} wurde gemergt.`)
      await loadPullRequests()
      setPreview(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Merge fehlgeschlagen')
    } finally {
      setMerging(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#08090f] px-6 py-6 text-slate-100 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-white/[0.06] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-300">Review & Merge</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Branches prüfen</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              Sieh dir offene Pull Requests an, prüfe Dateien, Checks und Risiko, und merge erst dann in den Main Branch,
              wenn die Änderung wirklich passt.
            </p>
          </div>
          <button
            onClick={() => void loadPullRequests()}
            disabled={loadingList}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-white/[0.09] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/[0.07] disabled:opacity-50"
          >
            <RefreshCw className={cx('h-4 w-4', loadingList && 'animate-spin')} />
            Aktualisieren
          </button>
        </header>

        {(error || message) && (
          <div
            className={cx(
              'rounded-lg border px-4 py-3 text-sm',
              error ? 'border-red-500/25 bg-red-500/10 text-red-200' : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200',
            )}
          >
            {error ?? message}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <section className="rounded-xl border border-white/[0.07] bg-white/[0.035]">
            <div className="border-b border-white/[0.06] px-4 py-3">
              <h2 className="text-sm font-semibold text-white">Offene Pull Requests</h2>
              <p className="mt-1 text-xs text-slate-500">{pullRequests.length} offen</p>
            </div>
            <div className="max-h-[calc(100vh-220px)] overflow-y-auto p-2">
              {loadingList ? (
                <div className="flex items-center gap-2 px-3 py-8 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Lade Pull Requests...
                </div>
              ) : pullRequests.length === 0 ? (
                <div className="px-3 py-8 text-sm text-slate-500">Keine offenen Pull Requests gefunden.</div>
              ) : (
                pullRequests.map(pr => (
                  <button
                    key={pr.number}
                    onClick={() => setSelectedNumber(pr.number)}
                    className={cx(
                      'mb-2 flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors',
                      selected?.number === pr.number
                        ? 'border-violet-500/35 bg-violet-500/10'
                        : 'border-white/[0.06] bg-black/10 hover:bg-white/[0.04]',
                    )}
                  >
                    <GitPullRequest className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-100">#{pr.number} {pr.title}</span>
                      <span className="mt-1 block truncate text-xs text-slate-500">{pr.headRef} → {pr.baseRef}</span>
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        <span className={cx('rounded-full border px-2 py-0.5 text-[10px] font-semibold', riskTone[pr.risk])}>{pr.risk}</span>
                        <span className="rounded-full border border-white/[0.07] bg-white/[0.04] px-2 py-0.5 text-[10px] text-slate-400">
                          {pr.changedFiles} Dateien
                        </span>
                      </span>
                    </span>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-600" />
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="min-h-[560px] rounded-xl border border-white/[0.07] bg-white/[0.035]">
            {loadingPreview ? (
              <div className="flex h-full min-h-[360px] items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Preview wird geladen...
              </div>
            ) : !preview ? (
              <div className="flex h-full min-h-[360px] items-center justify-center text-sm text-slate-500">
                Wähle einen Pull Request aus.
              </div>
            ) : (
              <div className="space-y-5 p-5">
                <div className="flex flex-col gap-4 border-b border-white/[0.06] pb-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-semibold text-slate-400">#{preview.number}</span>
                      <span className={cx('rounded-full border px-2 py-0.5 text-xs font-semibold', riskTone[preview.risk])}>{preview.risk} risk</span>
                      <span className={cx('rounded-full border px-2 py-0.5 text-xs font-semibold', recommendationTone[preview.mergeRecommendation.status])}>
                        {preview.mergeRecommendation.status === 'ready' ? 'Merge-ready' : preview.mergeRecommendation.status === 'review' ? 'Review nötig' : 'Blockiert'}
                      </span>
                    </div>
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">{preview.title}</h2>
                    <p className="mt-2 text-sm text-slate-500">
                      {preview.headRef} → {preview.baseRef} · {preview.changedFiles} Dateien · +{preview.additions}/-{preview.deletions} · aktualisiert {formatDate(preview.updatedAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={preview.url} target="_blank" className="rounded-md border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/[0.07]">
                      GitHub öffnen
                    </Link>
                    <button
                      onClick={() => void mergeSelected()}
                      disabled={!canMergeSelected}
                      className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                      title={!allReviewChecksDone ? 'Bitte zuerst die Review-Checkliste abhaken.' : preview.mergeRecommendation.status !== 'ready' ? 'Merge ist erst bei gruenen Checks und mergebarem PR erlaubt.' : undefined}
                    >
                      {merging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      In main mergen
                    </button>
                  </div>
                </div>

                <div className={cx('rounded-lg border p-4', recommendationTone[preview.mergeRecommendation.status])}>
                  <div className="flex items-start gap-3">
                    {preview.mergeRecommendation.status === 'ready' ? <ShieldCheck className="mt-0.5 h-4 w-4" /> : <AlertTriangle className="mt-0.5 h-4 w-4" />}
                    <div>
                      <p className="text-sm font-semibold">Merge-Empfehlung</p>
                      <ul className="mt-2 space-y-1 text-xs">
                        {preview.mergeRecommendation.reasons.map(reason => <li key={reason}>- {reason}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-white/[0.06] bg-black/15 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Merge-Freigabe</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        ForgePilot merged erst, wenn der PR technisch bereit ist und du die wichtigsten Prüfpunkte bestätigt hast.
                      </p>
                    </div>
                    <span className={cx(
                      'rounded-full border px-2.5 py-1 text-xs font-semibold',
                      canMergeSelected
                        ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
                        : 'border-white/[0.08] bg-white/[0.04] text-slate-400',
                    )}>
                      {canMergeSelected ? 'Freigegeben' : 'Wartet auf Prüfung'}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2 md:grid-cols-3">
                    <ReviewCheckbox
                      checked={reviewGate.filesReviewed}
                      label="Dateien geprüft"
                      description="Diff und betroffene Dateien passen fachlich."
                      onChange={checked => setReviewGate(current => ({ ...current, filesReviewed: checked }))}
                    />
                    <ReviewCheckbox
                      checked={reviewGate.checksReviewed}
                      label="Checks geprüft"
                      description="CI, Tests und Merge-Empfehlung sind grün."
                      onChange={checked => setReviewGate(current => ({ ...current, checksReviewed: checked }))}
                    />
                    <ReviewCheckbox
                      checked={reviewGate.noSecrets}
                      label="Keine Secrets"
                      description="Keine Tokens, Passwörter oder privaten Daten im Diff."
                      onChange={checked => setReviewGate(current => ({ ...current, noSecrets: checked }))}
                    />
                  </div>
                  {preview.mergeRecommendation.status !== 'ready' && (
                    <p className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-200">
                      Dieser PR ist noch nicht merge-ready. Bitte erst Blocker beheben oder Checks abwarten.
                    </p>
                  )}
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-lg border border-white/[0.06] bg-black/15 p-4">
                    <h3 className="text-sm font-semibold text-white">Commits</h3>
                    <div className="mt-3 space-y-2">
                      {preview.commitMessages.map(commit => (
                        <p key={commit.sha} className="text-xs text-slate-400">
                          <span className="font-mono text-slate-500">{commit.sha}</span> {commit.message}
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/[0.06] bg-black/15 p-4">
                    <h3 className="text-sm font-semibold text-white">Checks</h3>
                    <p className="mt-2 text-xs text-slate-400">Status: <span className="font-semibold text-slate-200">{preview.checks.state}</span></p>
                    {preview.checks.items.length > 0 && (
                      <div className="mt-3 max-h-32 space-y-1 overflow-y-auto">
                        {preview.checks.items.map(item => (
                          <p key={`${item.name}-${item.status}`} className="truncate text-xs text-slate-500">{item.status}: {item.name}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-white/[0.06] bg-black/15">
                  <div className="border-b border-white/[0.06] px-4 py-3">
                    <h3 className="text-sm font-semibold text-white">Dateien & Änderungsvorschau</h3>
                  </div>
                  <div className="divide-y divide-white/[0.06]">
                    {preview.files.map(file => (
                      <details key={file.filename} className="group">
                        <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-white/[0.03]">
                          <span className="min-w-0 truncate font-mono text-xs text-slate-300">{file.filename}</span>
                          <span className="shrink-0 text-xs text-slate-500">+{file.additions}/-{file.deletions}</span>
                        </summary>
                        {file.patchPreview ? (
                          <pre className="max-h-72 overflow-auto border-t border-white/[0.06] bg-black/35 px-4 py-3 text-[11px] leading-relaxed text-slate-400">
                            {file.patchPreview}
                          </pre>
                        ) : (
                          <p className="border-t border-white/[0.06] px-4 py-3 text-xs text-slate-500">Keine Patch-Vorschau verfügbar.</p>
                        )}
                      </details>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}

function ReviewCheckbox({
  checked,
  label,
  description,
  onChange,
}: {
  checked: boolean
  label: string
  description: string
  onChange: (checked: boolean) => void
}) {
  return (
    <label className={cx(
      'flex cursor-pointer gap-3 rounded-lg border px-3 py-3 transition',
      checked
        ? 'border-emerald-500/25 bg-emerald-500/10'
        : 'border-white/[0.06] bg-white/[0.025] hover:border-white/[0.12]',
    )}>
      <input
        type="checkbox"
        checked={checked}
        onChange={event => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-white/[0.18] bg-black/30 text-emerald-500"
      />
      <span>
        <span className="block text-sm font-semibold text-slate-100">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
      </span>
    </label>
  )
}
