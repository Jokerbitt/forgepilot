'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Notification, NotificationType } from '@/lib/models/notification'
import { cx } from '@/components/ui/primitives'

type Filter = 'all' | 'unread' | 'runs' | 'delegations'

const TYPE_ICON: Record<NotificationType, string> = {
  run_complete: '✅',
  run_failed: '❌',
  delegation_approved: '✓',
  delegation_pending: '⏳',
  brief_ready: '📋',
  system: 'ℹ️',
  'pm-alert': '🚨',
  'research-complete': '🔬',
  'delegation-blocked': '🚫',
  'milestone-at-risk': '⚠️',
  'orchestration-complete': '✅',
  'orchestration-failed': '❌',
}

const RUN_TYPES: NotificationType[] = ['run_complete', 'run_failed', 'orchestration-complete', 'orchestration-failed']
const DELEGATION_TYPES: NotificationType[] = ['delegation_approved', 'delegation-blocked']

const FILTER_LABELS: Record<Filter, string> = {
  all: 'Alle',
  unread: 'Ungelesen',
  runs: 'Runs',
  delegations: 'Delegations',
}

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

function applyFilter(notifications: Notification[], filter: Filter): Notification[] {
  switch (filter) {
    case 'unread':
      return notifications.filter(n => !n.read)
    case 'runs':
      return notifications.filter(n => RUN_TYPES.includes(n.type))
    case 'delegations':
      return notifications.filter(n => DELEGATION_TYPES.includes(n.type))
    default:
      return notifications
  }
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [markingAll, setMarkingAll] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      const data = await res.json() as Notification[]
      if (Array.isArray(data)) {
        setNotifications(data)
      }
    } catch {
      // non-critical
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

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
    } finally {
      setMarkingAll(false)
    }
  }

  const displayed = applyFilter(notifications, filter)
  const unreadCount = notifications.filter(n => !n.read).length

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="h-8 w-48 animate-pulse rounded bg-slate-800" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-slate-800 bg-slate-900" />
          ))}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-2xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Benachrichtigungen</h1>
            <p className="mt-1 text-sm text-slate-500">
              {unreadCount > 0
                ? `${unreadCount} ungelesen`
                : 'Alles gelesen'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => { void markAllRead() }}
              disabled={markingAll}
              className="rounded-lg border border-violet-500/30 bg-violet-500/[0.07] px-3 py-1.5 text-xs font-medium text-violet-300 transition-colors hover:bg-violet-500/[0.12] disabled:opacity-50"
            >
              {markingAll ? 'Markiere…' : 'Alle als gelesen markieren'}
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 rounded-lg border border-white/[0.06] bg-white/[0.03] p-1">
          {(Object.keys(FILTER_LABELS) as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cx(
                'flex-1 rounded-md py-1.5 text-xs font-medium transition-colors',
                filter === f
                  ? 'bg-violet-500/20 text-violet-200'
                  : 'text-slate-500 hover:text-slate-300'
              )}
            >
              {FILTER_LABELS[f]}
              {f === 'unread' && unreadCount > 0 && (
                <span className="ml-1 rounded-full bg-red-500 px-1 py-0.5 text-[9px] font-bold text-white leading-none">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        {displayed.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-12 text-center">
            <p className="mb-3 text-4xl">🔔</p>
            <p className="font-medium text-slate-400">Keine Benachrichtigungen</p>
            <p className="mt-1 text-sm text-slate-600">
              {filter === 'all' ? 'Du bist auf dem neuesten Stand.' : 'Keine Einträge in diesem Filter.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayed.map(n => (
              <NotificationRow key={n.id} notification={n} onMarkRead={markRead} />
            ))}
          </div>
        )}

      </div>
    </main>
  )
}

function NotificationRow({
  notification: n,
  onMarkRead,
}: {
  notification: Notification
  onMarkRead: (id: string) => void
}) {
  return (
    <div
      className={cx(
        'flex items-start gap-4 rounded-xl border p-4 transition-colors',
        n.read
          ? 'border-white/[0.04] bg-white/[0.02]'
          : 'border-violet-500/20 bg-violet-500/[0.04]'
      )}
    >
      <span className="shrink-0 text-lg leading-none mt-0.5">{TYPE_ICON[n.type] ?? 'ℹ️'}</span>
      <div className="min-w-0 flex-1">
        <p className={cx('text-sm font-medium', n.read ? 'text-slate-400' : 'text-white')}>
          {n.title}
        </p>
        <p className="mt-1 text-xs text-slate-500 leading-relaxed">{n.body}</p>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-[10px] text-slate-600">{relativeTime(n.createdAt)}</span>
          <span className="text-[10px] text-slate-700 capitalize">{n.type.replace(/_/g, ' ')}</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        {n.link && (
          <a
            href={n.link}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] text-slate-300 hover:border-slate-500 transition-colors"
          >
            Detail →
          </a>
        )}
        {!n.read && (
          <button
            onClick={() => onMarkRead(n.id)}
            className="rounded border border-violet-500/30 px-2 py-1 text-[10px] font-medium text-violet-400 hover:border-violet-500/50 transition-colors"
          >
            Gelesen
          </button>
        )}
      </div>
    </div>
  )
}
