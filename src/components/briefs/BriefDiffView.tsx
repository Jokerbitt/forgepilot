'use client'

import { useEffect, useState } from 'react'
import type { FieldDiff } from '@/lib/project-briefs/brief-versions'
import type { BriefVersion } from '@/lib/project-briefs/brief-versions'

interface Props {
  briefId: string
  onClose: () => void
}

interface DiffResponse {
  briefId: string
  before: { versionId: string; savedAt: string }
  after: { versionId: string; savedAt: string }
  changedCount: number
  diffs: FieldDiff[]
}

interface VersionsResponse {
  versions: BriefVersion[]
}

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function BriefDiffView({ briefId, onClose }: Props) {
  const [versions, setVersions] = useState<BriefVersion[]>([])
  const [v1Id, setV1Id] = useState<string>('')
  const [v2Id, setV2Id] = useState<string>('current')
  const [diff, setDiff] = useState<DiffResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Load versions list
  useEffect(() => {
    fetch(`/api/project-briefs/${briefId}/versions`)
      .then(r => r.json())
      .then((data: VersionsResponse) => {
        setVersions(data.versions ?? [])
        if (data.versions?.length > 0) {
          setV1Id(data.versions[0].versionId) // most recent snapshot
        }
      })
      .catch(() => setError('Versionen konnten nicht geladen werden'))
  }, [briefId])

  // Load diff whenever v1 / v2 changes
  useEffect(() => {
    if (!v1Id) return
    setLoading(true)
    setError('')
    const params = new URLSearchParams()
    params.set('v1', v1Id)
    if (v2Id !== 'current') params.set('v2', v2Id)
    fetch(`/api/project-briefs/${briefId}/diff?${params}`)
      .then(r => r.ok ? r.json() as Promise<DiffResponse> : r.json().then(e => { throw new Error((e as { error?: string }).error ?? 'Fehler') }))
      .then(data => setDiff(data))
      .catch(e => setError(String(e.message ?? e)))
      .finally(() => setLoading(false))
  }, [briefId, v1Id, v2Id])

  const changedDiffs = diff?.diffs.filter(d => d.changed) ?? []
  const unchangedDiffs = diff?.diffs.filter(d => !d.changed) ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-12">
      <div className="w-full max-w-4xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Versionsvergleich</h2>
            {diff && (
              <p className="mt-0.5 text-sm text-slate-400">
                {diff.changedCount === 0
                  ? 'Keine Änderungen'
                  : `${diff.changedCount} Feld${diff.changedCount !== 1 ? 'er' : ''} geändert`}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            ✕ Schließen
          </button>
        </div>

        {/* Version selectors */}
        <div className="flex flex-wrap gap-4 border-b border-slate-800 px-6 py-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-400">Vorher (Snapshot)</label>
            <select
              value={v1Id}
              onChange={e => setV1Id(e.target.value)}
              className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              {versions.length === 0 && <option value="">Keine Snapshots</option>}
              {versions.map(v => (
                <option key={v.versionId} value={v.versionId}>
                  v{v.versionNumber} — {fmt(v.savedAt)}{v.label ? ` (${v.label})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end text-slate-500 pb-1.5">→</div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-400">Nachher</label>
            <select
              value={v2Id}
              onChange={e => setV2Id(e.target.value)}
              className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              <option value="current">Aktueller Stand</option>
              {versions.map(v => (
                <option key={v.versionId} value={v.versionId}>
                  v{v.versionNumber} — {fmt(v.savedAt)}{v.label ? ` (${v.label})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {error && (
            <p className="mb-4 rounded-md border border-red-700/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          )}

          {versions.length === 0 && !loading && !error && (
            <p className="py-8 text-center text-sm text-slate-500">
              Noch keine Snapshots vorhanden. Änderungen werden automatisch beim nächsten Speichern gespeichert.
            </p>
          )}

          {loading && (
            <p className="py-8 text-center text-sm text-slate-500 animate-pulse">Vergleich wird geladen…</p>
          )}

          {diff && !loading && (
            <div className="space-y-3">
              {/* Changed fields first */}
              {changedDiffs.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                    Geändert ({changedDiffs.length})
                  </h3>
                  {changedDiffs.map(d => (
                    <DiffRow key={d.field} diff={d} />
                  ))}
                </div>
              )}

              {/* Unchanged fields (collapsed) */}
              {unchangedDiffs.length > 0 && (
                <details className="group">
                  <summary className="cursor-pointer list-none py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300">
                    <span className="group-open:hidden">▶ Unverändert ({unchangedDiffs.length})</span>
                    <span className="hidden group-open:inline">▼ Unverändert ({unchangedDiffs.length})</span>
                  </summary>
                  <div className="mt-2 space-y-2">
                    {unchangedDiffs.map(d => (
                      <DiffRow key={d.field} diff={d} />
                    ))}
                  </div>
                </details>
              )}

              {diff.changedCount === 0 && (
                <p className="py-6 text-center text-sm text-slate-400">
                  Keine Unterschiede zwischen den gewählten Versionen.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DiffRow({ diff }: { diff: FieldDiff }) {
  const isEmpty = (s: string) => !s || s.trim() === ''

  return (
    <div className={`rounded-lg border px-4 py-3 ${diff.changed ? 'border-amber-700/40 bg-amber-950/20' : 'border-slate-800 bg-slate-900/50'}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-300">{diff.label}</span>
        {diff.changed && (
          <span className="rounded bg-amber-900/60 px-1.5 py-0.5 text-xs text-amber-300">geändert</span>
        )}
      </div>
      {diff.changed ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded border border-red-800/40 bg-red-950/30 px-3 py-2">
            <span className="mb-1 block text-xs text-red-400">Vorher</span>
            <pre className="whitespace-pre-wrap text-xs text-red-200/80 font-sans">
              {isEmpty(diff.before) ? <em className="text-slate-500">leer</em> : diff.before}
            </pre>
          </div>
          <div className="rounded border border-emerald-800/40 bg-emerald-950/30 px-3 py-2">
            <span className="mb-1 block text-xs text-emerald-400">Nachher</span>
            <pre className="whitespace-pre-wrap text-xs text-emerald-200/80 font-sans">
              {isEmpty(diff.after) ? <em className="text-slate-500">leer</em> : diff.after}
            </pre>
          </div>
        </div>
      ) : (
        <pre className="whitespace-pre-wrap text-xs text-slate-500 font-sans">
          {isEmpty(diff.before) ? <em>leer</em> : diff.before}
        </pre>
      )}
    </div>
  )
}
