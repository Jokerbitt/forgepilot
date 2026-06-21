'use client'

import { useCallback, useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { AttentionItem, AttentionSeverity, DigestEntry } from '@/lib/models/attention'
import type { Notification, NotificationType } from '@/lib/models/notification'
import { cx } from '@/components/ui/primitives'

// ─── Attention (tab 1) ────────────────────────────────────────────────────────

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

const ATTENTION_TYPE_ICON: Record<string, string> = {
  delegation_completed: '✅',
  delegation_failed:    '❌',
  delegation_stalled:   '⏸',
  budget_exceeded:      '💸',
  approval_pending:     '⏳',
  escalation:           '🚨',
  system_error:         '⚠️',
  review_passed:        '👍',
  review_failed:        '🔴',
  sla_warning:          '🕐',
  sla_breached:         '🔥',
}

// ─── Notifications (tab 2) ────────────────────────────────────────────────────

const NOTIF_TYPE_ICON: Record<NotificationType, string> = {
  run_complete: '✅',
  loop_complete: '🔁',
  run_failed:               '❌',
  delegation_approved:      '✓',
  delegation_pending:       '⏳',
  delegation_completed:     '✅',
  delegation_failed:        '❌',
  brief_ready:              '📋',
  system:                   'ℹ️',
  'pm-alert':               '🚨',
  'research-complete':      '🔬',
  'delegation-blocked':     '🚫',
  'milestone-at-risk':      '⚠️',
  'orchestration-complete': '✅',
  'orchestration-failed':   '❌',
}

type NotifFilter = 'all' | 'unread' | 'runs' | 'delegations'
const RUN_TYPES: NotificationType[] = ['run_complete', 'run_failed', 'orchestration-complete', 'orchestration-failed']
const DELEGATION_TYPES: NotificationType[] = ['delegation_approved', 'delegation-blocked']

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'gerade eben'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `vor ${diffMin} Min.`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `vor ${diffH} Std.`
  const diffD = Math.floor(diffH / 24)
  return `vor ${diffD} Tag${diffD !== 1 ? 'en' : ''}`
}

// ─── Inner component (needs useSearchParams) ──────────────────────────────────

function InboxInner() {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') === 'notifications' ? 'notifications' : 'attention'

  const [tab, setTab] = useState<'attention' | 'notifications'>(initialTab as 'attention' | 'notifications')

  // Attention state
  const [items, setItems] = useState<AttentionItem[]>([])
  const [digest, setDigest] = useState<DigestEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState<string | null>(null)

  // Notifications state
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notifLoading, setNotifLoading] = useState(true)
  const [notifFilter, setNotifFilter] = useState<NotifFilter>('all')
  const [markingAll, setMarkingAll] = useState(false)

  const loadAttention = useCallback(async () => {
    const [attRes, digRes] = await Promise.all([
      fetch('/api/attention'),
      fetch('/api/digest'),
    ])
    setItems(await attRes.json() as AttentionItem[])
    setDigest(await digRes.json() as DigestEntry)
    setLoading(false)
  }, [])

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      const data = await res.json() as Notification[]
      if (Array.isArray(data)) setNotifications(data)
    } catch { /* non-critical */ } finally {
      setNotifLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAttention()
    void loadNotifications()
    const interval = setInterval(() => {
      void loadAttention()
      void loadNotifications()
    }, 10000)
    return () => clearInterval(interval)
  }, [loadAttention, loadNotifications])

  const handleResolve = async (id: string) => {
    setResolving(id)
    await fetch(`/api/attention/${encodeURIComponent(id)}/resolve`, { method: 'POST' })
    await loadAttention()
    setResolving(null)
  }

  const markRead = async (id: string) => {
    await fetch('/api/notifications/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const markAllRead = async () => {
    setMarkingAll(true)
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } finally { setMarkingAll(false) }
  }

  const critical = items.filter(i => i.severity === 'critical')
  const warnings = items.filter(i => i.severity === 'warning')
  const infos    = items.filter(i => i.severity === 'info')

  const unreadCount = notifications.filter(n => !n.read).length
  const displayedNotifs = (() => {
    switch (notifFilter) {
      case 'unread': return notifications.filter(n => !n.read)
      case 'runs': return notifications.filter(n => RUN_TYPES.includes(n.type))
      case 'delegations': return notifications.filter(n => DELEGATION_TYPES.includes(n.type))
      default: return notifications
    }
  })()

  const attentionBadge = items.length > 0 ? items.length : null
  const notifBadge = unreadCount > 0 ? unreadCount : null

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Inbox</h1>
          <p className="mt-1 text-sm text-slate-500">
            {tab === 'attention'
              ? (items.length === 0 ? 'Alles erledigt — keine offenen Punkte' : `${items.length} offene${items.length !== 1 ? ' Punkte' : 'r Punkt'}`)
              : (unreadCount > 0 ? `${unreadCount} ungelesen` : 'Alles gelesen')}
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1">
          <button
            onClick={() => setTab('attention')}
            className={cx(
              'flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors',
              tab === 'attention' ? 'bg-violet-500/20 text-violet-200' : 'text-slate-500 hover:text-slate-300',
            )}
          >
            Attention
            {attentionBadge && (
              <span className="rounded-full bg-red-500/80 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                {attentionBadge}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('notifications')}
            className={cx(
              'flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors',
              tab === 'notifications' ? 'bg-violet-500/20 text-violet-200' : 'text-slate-500 hover:text-slate-300',
            )}
          >
            Benachrichtigungen
            {notifBadge && (
              <span className="rounded-full bg-violet-500/80 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                {notifBadge}
              </span>
            )}
          </button>
        </div>

        {/* ── Tab: Attention ── */}
        {tab === 'attention' && (
          <>
            {loading ? (
              <div className="h-32 animate-pulse rounded-xl border border-slate-800 bg-slate-900" />
            ) : (
              <>
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
                          <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                            className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-sky-400 hover:text-sky-300 transition-colors">
                            {url.split('/').slice(-2).join('#')}
                          </a>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {items.length === 0 && (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-12 text-center">
                    <p className="text-4xl mb-3">✅</p>
                    <p className="text-slate-400 font-medium">Inbox ist leer</p>
                    <p className="mt-1 text-sm text-slate-600">Alle Agents laufen problemlos.</p>
                  </div>
                )}

                {critical.length > 0 && <AttentionSection title="Kritisch" items={critical} onResolve={handleResolve} resolvingId={resolving} />}
                {warnings.length > 0 && <AttentionSection title="Warnungen" items={warnings} onResolve={handleResolve} resolvingId={resolving} />}
                {infos.length > 0    && <AttentionSection title="Informationen" items={infos} onResolve={handleResolve} resolvingId={resolving} />}
              </>
            )}
          </>
        )}

        {/* ── Tab: Notifications ── */}
        {tab === 'notifications' && (
          <>
            {/* Actions row */}
            <div className="flex items-center justify-between">
              {unreadCount > 0 && (
                <button
                  onClick={() => { void markAllRead() }}
                  disabled={markingAll}
                  className="rounded-lg border border-violet-500/30 bg-violet-500/[0.07] px-3 py-1.5 text-xs font-medium text-violet-300 transition-colors hover:bg-violet-500/[0.12] disabled:opacity-50"
                >
                  {markingAll ? 'Markiere…' : 'Alle als gelesen markieren'}
                </button>
              )}
              <div className="flex-1" />
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 rounded-lg border border-white/[0.06] bg-white/[0.03] p-1">
              {(['all', 'unread', 'runs', 'delegations'] as NotifFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setNotifFilter(f)}
                  className={cx(
                    'flex-1 rounded-md py-1.5 text-xs font-medium transition-colors',
                    notifFilter === f ? 'bg-violet-500/20 text-violet-200' : 'text-slate-500 hover:text-slate-300',
                  )}
                >
                  {f === 'all' ? 'Alle' : f === 'unread' ? 'Ungelesen' : f === 'runs' ? 'Runs' : 'Delegations'}
                  {f === 'unread' && unreadCount > 0 && (
                    <span className="ml-1 rounded-full bg-red-500 px-1 py-0.5 text-[9px] font-bold text-white leading-none">{unreadCount}</span>
                  )}
                </button>
              ))}
            </div>

            {notifLoading ? (
              <div className="h-32 animate-pulse rounded-xl border border-slate-800 bg-slate-900" />
            ) : displayedNotifs.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-12 text-center">
                <p className="mb-3 text-4xl">🔔</p>
                <p className="font-medium text-slate-400">Keine Benachrichtigungen</p>
                <p className="mt-1 text-sm text-slate-600">
                  {notifFilter === 'all' ? 'Du bist auf dem neuesten Stand.' : 'Keine Einträge in diesem Filter.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {displayedNotifs.map(n => (
                  <NotificationRow key={n.id} notification={n} onMarkRead={markRead} />
                ))}
              </div>
            )}
          </>
        )}

      </div>
    </main>
  )
}

export default function InboxPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-slate-950 text-white p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="h-8 w-48 animate-pulse rounded bg-slate-800" />
          <div className="h-32 animate-pulse rounded-xl border border-slate-800 bg-slate-900" />
        </div>
      </main>
    }>
      <InboxInner />
    </Suspense>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function AttentionSection({ title, items, onResolve, resolvingId }: {
  title: string; items: AttentionItem[]; onResolve: (id: string) => void; resolvingId: string | null
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {items.map(item => (
        <AttentionCard key={item.id} item={item} onResolve={onResolve} resolving={resolvingId === item.id} />
      ))}
    </section>
  )
}

function AttentionCard({ item, onResolve, resolving }: {
  item: AttentionItem; onResolve: (id: string) => void; resolving: boolean
}) {
  return (
    <div className={`rounded-xl border p-4 ${SEVERITY_STYLES[item.severity]}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-base">{ATTENTION_TYPE_ICON[item.type] ?? '📌'}</span>
            <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${SEVERITY_BADGE[item.severity]}`}>
              {SEVERITY_LABEL[item.severity]}
            </span>
            <span className="text-xs text-slate-600">
              {new Date(item.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p className="text-sm font-medium text-white">{item.title}</p>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">{item.body}</p>
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
                <p className="text-xs text-emerald-400">Empfehlung: {item.escalationContext.recommendation}</p>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {item.actionUrl && (
            <Link href={item.actionUrl}
              className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:border-slate-500 transition-colors">
              Detail →
            </Link>
          )}
          <button onClick={() => onResolve(item.id)} disabled={resolving}
            className="rounded border border-emerald-800/50 bg-emerald-950/20 px-2 py-1 text-xs text-emerald-400 hover:border-emerald-600 transition-colors disabled:opacity-50">
            {resolving ? '…' : '✓ Erledigt'}
          </button>
        </div>
      </div>
    </div>
  )
}

function NotificationRow({ notification: n, onMarkRead }: { notification: Notification; onMarkRead: (id: string) => void }) {
  return (
    <div className={cx(
      'flex items-start gap-4 rounded-xl border p-4 transition-colors',
      n.read ? 'border-white/[0.04] bg-white/[0.02]' : 'border-violet-500/20 bg-violet-500/[0.04]',
    )}>
      <span className="shrink-0 text-lg leading-none mt-0.5">{NOTIF_TYPE_ICON[n.type] ?? 'ℹ️'}</span>
      <div className="min-w-0 flex-1">
        <p className={cx('text-sm font-medium', n.read ? 'text-slate-400' : 'text-white')}>{n.title}</p>
        <p className="mt-1 text-xs text-slate-500 leading-relaxed">{n.body}</p>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-[10px] text-slate-600">{relativeTime(n.createdAt)}</span>
          <span className="text-[10px] text-slate-700 capitalize">{n.type.replace(/_/g, ' ')}</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        {n.link && (
          <a href={n.link} target="_blank" rel="noopener noreferrer"
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] text-slate-300 hover:border-slate-500 transition-colors">
            Detail →
          </a>
        )}
        {!n.read && (
          <button onClick={() => onMarkRead(n.id)}
            className="rounded border border-violet-500/30 px-2 py-1 text-[10px] font-medium text-violet-400 hover:border-violet-500/50 transition-colors">
            Gelesen
          </button>
        )}
      </div>
    </div>
  )
}
