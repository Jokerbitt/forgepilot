'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { AttentionItem, AttentionSeverity, DigestEntry } from '@/lib/models/attention'

const SEVERITY_STYLES: Record<AttentionSeverity, string> = {
  critical: 'border-red-800/50 bg-red-950/20',
  warning:  'border-amber-800/40 bg-amber-950/10',
  info:     'border-slate-700 bg-slate-900/30',
}

const SEVERITY_BADGE: Record<AttentionSeverity, string> = {
  critical: 'border-red-700/50 bg-red-950/30 text-red-400',
  warning:  'border-amber-700/50 bg-amber-950/30 text-amber-400',
  info:     'border-slate-700 bg-slate-800/50 text-slate-400',
}

const SEVERITY_LABEL: Record<AttentionSeverity, string> = {
  critical: 'Kritisch',
  warning:  'Warnung',
  info:     'Info',
}

const TYPE_ICON: Record<string, string> = {
  delegation_failed:  '❌',
  delegation_stalled: '⏸',
  budget_exceeded:    '💸',
  approval_pending:   '⏳',
  escalation:         '🚨',
  system_error:       '⚠️',
}

export default function InboxPage() {
  const [items, setItems] = useState<AttentionItem[]>([])
  const [digest, setDigest] = useState<DigestEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [attRes, digRes] = await Promise.all([
      fetch('/api/attention'),
      fetch('/api/digest'),
    ])
    setItems(await attRes.json() as AttentionItem[])
    setDigest(await digRes.json() as DigestEntry)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [load])

  const handleResolve = async (id: string) => {
    setResolving(id)
    await fetch(`/api/attention/${encodeURIComponent(id)}/resolve`, { method: 'POST' })
    await load()
    setResolving(null)
  }

  const critical = items.filter(i => i.severity === 'critical')
  const warnings = items.filter(i => i.severity === 'warning')
  const infos    = items.filter(i => i.severity === 'info')

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="h-8 w-48 animate-pulse rounded bg-slate-800" />
          <div className="h-32 animate-pulse rounded-xl border border-slate-800 bg-slate-900" />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Inbox</h1>
            <p className="mt-1 text-sm text-slate-500">
              {items.length === 0
                ? 'Alles erledigt — keine offenen Punkte'
                : `${items.length} offene${items.length !== 1 ? ' Punkte' : 'r Punkt'}`}
            </p>
          </div>
          <Link href="/active" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
            Active Runs →
          </Link>
        </div>

        {/* Daily Digest */}
        {digest && (
          <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Letzte 24 Stunden</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <DigestMetric label="Abgeschlossen" value={digest.delegationsCompleted} tone="success" />
              <DigestMetric label="Fehlgeschlagen" value={digest.delegationsFailed} tone={digest.delegationsFailed > 0 ? 'danger' : 'neutral'} />
              <DigestMetric label="PRs erstellt" value={digest.prsCreated.length} tone="info" />
              <DigestMetric label="Kosten" value={`$${digest.totalCostUsd.toFixed(3)}`} tone="neutral" />
            </div>
            {digest.prsCreated.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {digest.prsCreated.map(url => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-sky-400 hover:text-sky-300 transition-colors"
                  >
                    {url.split('/').slice(-2).join('#')}
                  </a>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Empty state */}
        {items.length === 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-12 text-center">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-slate-400 font-medium">Inbox ist leer</p>
            <p className="mt-1 text-sm text-slate-600">Alle Agents laufen problemlos.</p>
          </div>
        )}

        {/* Critical */}
        {critical.length > 0 && (
          <AttentionSection title="Kritisch" items={critical} onResolve={handleResolve} resolvingId={resolving} />
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <AttentionSection title="Warnungen" items={warnings} onResolve={handleResolve} resolvingId={resolving} />
        )}

        {/* Info */}
        {infos.length > 0 && (
          <AttentionSection title="Informationen" items={infos} onResolve={handleResolve} resolvingId={resolving} />
        )}

      </div>
    </main>
  )
}

function DigestMetric({ label, value, tone }: { label: string; value: string | number; tone: 'success' | 'danger' | 'info' | 'neutral' }) {
  const valueClass =
    tone === 'success' ? 'text-emerald-400' :
    tone === 'danger'  ? 'text-red-400' :
    tone === 'info'    ? 'text-sky-400' :
    'text-white'
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${valueClass}`}>{value}</p>
    </div>
  )
}

function AttentionSection({
  title,
  items,
  onResolve,
  resolvingId,
}: {
  title: string
  items: AttentionItem[]
  onResolve: (id: string) => void
  resolvingId: string | null
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {items.map(item => (
        <AttentionCard
          key={item.id}
          item={item}
          onResolve={onResolve}
          resolving={resolvingId === item.id}
        />
      ))}
    </section>
  )
}

function AttentionCard({
  item,
  onResolve,
  resolving,
}: {
  item: AttentionItem
  onResolve: (id: string) => void
  resolving: boolean
}) {
  return (
    <div className={`rounded-xl border p-4 ${SEVERITY_STYLES[item.severity]}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-base">{TYPE_ICON[item.type] ?? '📌'}</span>
            <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${SEVERITY_BADGE[item.severity]}`}>
              {SEVERITY_LABEL[item.severity]}
            </span>
            <span className="text-xs text-slate-600">
              {new Date(item.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p className="text-sm font-medium text-white">{item.title}</p>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">{item.body}</p>

          {/* Escalation context */}
          {item.escalationContext && (
            <div className="mt-3 rounded border border-amber-800/30 bg-amber-950/10 p-3 space-y-2">
              <p className="text-xs font-medium text-amber-300">Problem</p>
              <p className="text-xs text-slate-300">{item.escalationContext.problem}</p>
              {item.escalationContext.options && item.escalationContext.options.length > 0 && (
                <>
                  <p className="text-xs font-medium text-amber-300">Optionen</p>
                  <ul className="space-y-1">
                    {item.escalationContext.options.map((opt, i) => (
                      <li key={i} className="text-xs text-slate-300">
                        <span className="font-medium text-amber-400">Option {String.fromCharCode(65 + i)}:</span> {opt}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {item.escalationContext.recommendation && (
                <p className="text-xs text-emerald-400">
                  Empfehlung: {item.escalationContext.recommendation}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {item.actionUrl && (
            <Link
              href={item.actionUrl}
              className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:border-slate-500 transition-colors"
            >
              Detail →
            </Link>
          )}
          <button
            onClick={() => onResolve(item.id)}
            disabled={resolving}
            className="rounded border border-emerald-800/50 bg-emerald-950/20 px-2 py-1 text-xs text-emerald-400 hover:border-emerald-600 transition-colors disabled:opacity-50"
          >
            {resolving ? '…' : '✓ Erledigt'}
          </button>
        </div>
      </div>
    </div>
  )
}
