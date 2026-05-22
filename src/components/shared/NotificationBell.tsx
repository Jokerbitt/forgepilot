'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import type { Notification, NotificationType } from '@/lib/models/notification'
import { cx } from '@/components/ui/primitives'

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

const TYPE_ICON: Record<NotificationType, string> = {
  run_complete: '✅',
  run_failed: '❌',
  delegation_approved: '✓',
  delegation_pending: '⏳',
  delegation_completed: '✅',
  delegation_failed: '❌',
  brief_ready: '📋',
  system: 'ℹ️',
  'pm-alert': '🚨',
  'research-complete': '🔬',
  'delegation-blocked': '🚫',
  'milestone-at-risk': '⚠️',
  'orchestration-complete': '✅',
  'orchestration-failed': '❌',
}

interface Props {
  /** Initial unread count (hydrated from server); will refresh via polling. */
  initialUnreadCount?: number
}

export function NotificationBell({ initialUnreadCount = 0 }: Props) {
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loadingDropdown, setLoadingDropdown] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Poll unread count every 10s
  const refreshCount = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?unread=true')
      const data = await res.json() as Notification[]
      if (Array.isArray(data)) setUnreadCount(data.length)
    } catch {
      // non-critical
    }
  }, [])

  useEffect(() => {
    refreshCount()
    const interval = setInterval(refreshCount, 10000)
    return () => clearInterval(interval)
  }, [refreshCount])

  // Load dropdown content when opened
  useEffect(() => {
    if (!open) return
    setLoadingDropdown(true)
    fetch('/api/notifications')
      .then(r => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setNotifications((data as Notification[]).slice(0, 5))
        }
      })
      .catch(() => { /* non-critical */ })
      .finally(() => setLoadingDropdown(false))
  }, [open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const markRead = async (id: string) => {
    await fetch('/api/notifications/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        aria-label="Notifications"
        onClick={() => setOpen(v => !v)}
        className={cx(
          'relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
          open
            ? 'bg-white/[0.08] text-white'
            : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
        )}
      >
        <Bell className="h-[15px] w-[15px]" strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-white/[0.08] bg-[#0d0d14] shadow-xl shadow-black/50">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Benachrichtigungen</span>
            {unreadCount > 0 && (
              <button
                onClick={async () => {
                  await fetch('/api/notifications/mark-read', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ all: true }),
                  })
                  setNotifications(prev => prev.map(n => ({ ...n, read: true })))
                  setUnreadCount(0)
                }}
                className="text-[10px] font-medium text-violet-400 hover:text-violet-300 transition-colors"
              >
                Alle gelesen
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto">
            {loadingDropdown ? (
              <div className="flex h-20 items-center justify-center">
                <span className="text-xs text-slate-500">Laden…</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex h-20 items-center justify-center">
                <span className="text-xs text-slate-500">Keine Benachrichtigungen</span>
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => { void markRead(n.id) }}
                  className={cx(
                    'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]',
                    !n.read && 'bg-violet-500/[0.04]'
                  )}
                >
                  <span className="shrink-0 text-base leading-none mt-0.5">
                    {TYPE_ICON[n.type] ?? 'ℹ️'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cx('truncate text-xs font-medium', n.read ? 'text-slate-400' : 'text-white')}>
                      {n.title}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-600">{relativeTime(n.createdAt)}</p>
                  </div>
                  {!n.read && (
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/[0.06] px-4 py-2.5">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors"
            >
              Alle anzeigen →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
