'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  ListChecks,
  Wrench,
  Settings,
  Command,
  ChevronRight,
  Zap,
  Lightbulb,
  FolderOpen,
  Monitor,
  AlertTriangle,
  Sparkles,
  Map,
  ScanText,
  Sun,
  Rocket,
} from 'lucide-react'
import type { DelegationStats } from '@/app/api/delegations/stats/route'
import type { AttentionItem } from '@/lib/models/attention'
import type { Notification } from '@/lib/models/notification'
import type { AutonomousConfig } from '@/lib/config/autonomous-config'
import { cx } from '@/components/ui/primitives'
import { NotificationBell } from '@/components/shared/NotificationBell'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { type Locale, useI18n } from '@/lib/i18n'

/**
 * group controls where an item appears in the sidebar:
 *   'core'     — always visible, prominent (the daily-use workflow)
 *   'workflow' — always visible, slightly smaller (contextual tools)
 *   'expert'   — collapsed under "Mehr" (power-user / rarely needed)
 */
type NavGroup = 'core' | 'workflow' | 'expert'

interface NavItem {
  href: string
  key: keyof ReturnType<typeof useI18n>['nav']
  icon: React.ElementType
  /** @deprecated use group instead — kept for backward compat */
  section?: string
  group: NavGroup
  isNew?: boolean
}

const navItems: NavItem[] = [
  // ── Core — daily-use loop (main's lean structure + our loop pages) ──────
  { href: '/',            key: 'commandCenter',    icon: LayoutDashboard, group: 'core' },
  { href: '/studio',      key: 'ideaStudio',       icon: Sparkles,        group: 'core', isNew: true },
  { href: '/morning',     key: 'briefing',         icon: Sun,             group: 'core' },
  { href: '/idea',        key: 'ideaToProduction', icon: Lightbulb,       group: 'core', isNew: true },
  { href: '/delegations', key: 'execute',          icon: ListChecks,      group: 'core' },
  { href: '/settings',    key: 'settings',         icon: Settings,        group: 'core' },

  // ── Workflow (visible but secondary) ────────────────────────────────────
  { href: '/live',             key: 'liveView',        icon: Monitor,    group: 'workflow' },
  { href: '/projects',         key: 'plan',            icon: FolderOpen, group: 'workflow' },
  { href: '/delegations/plan', key: 'planMode',        icon: Map,        group: 'workflow', isNew: true },
  { href: '/suggestions',      key: 'suggestions',     icon: Lightbulb,  group: 'workflow', isNew: true },
  { href: '/concept',          key: 'conceptAnalyzer', icon: ScanText,   group: 'workflow', isNew: true },
  { href: '/deploy',           key: 'deploy',          icon: Rocket,     group: 'workflow', isNew: true },

  // ── Werkzeuge (collapsed — /tools hub links to everything else) ─────────
  { href: '/tools',  key: 'tools',  icon: Wrench,   group: 'expert' },
  { href: '/skills', key: 'skills', icon: Sparkles, group: 'expert' },
]

const coreNavItems     = navItems.filter(item => item.group === 'core')
const workflowNavItems = navItems.filter(item => item.group === 'workflow')
const expertNavItems   = navItems.filter(item => item.group === 'expert')

// Aliases used by render helpers
const primaryNavItems  = coreNavItems
const moreNavItems     = expertNavItems

export function AppNav() {
  const { locale, setLocale, nav, ui } = useI18n()
  const pathname = usePathname()
  const [running, setRunning] = useState(0)
  const [pending, setPending] = useState(0)
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0)
  const [attentionCount, setAttentionCount] = useState(0)
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [autonomousModeActive, setAutonomousModeActive] = useState(false)
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const [delRes, attRes, notifRes, autoRes] = await Promise.all([
          fetch('/api/delegations/stats'),
          fetch('/api/attention'),
          fetch('/api/notifications?unread=true'),
          fetch('/api/settings/autonomous'),
        ])
        const stats = await delRes.json() as DelegationStats
        if (stats && typeof stats.running === 'number') {
          setRunning(stats.running)
          setPending((stats.pending ?? 0) + (stats.approved ?? 0))
          setPendingApprovalCount(stats.pending ?? 0)
        }
        const att = await attRes.json() as AttentionItem[]
        if (Array.isArray(att)) {
          setAttentionCount(att.filter(i => !i.resolvedAt).length)
        }
        const notifs = await notifRes.json() as Notification[]
        if (Array.isArray(notifs)) {
          setUnreadNotificationCount(notifs.length)
        }
        const autoData = await autoRes.json() as AutonomousConfig
        if (autoData && typeof autoData.enabled === 'boolean') {
          setAutonomousModeActive(autoData.enabled)
        }
      } catch {
        // nav badge is non-critical
      }
    }
    fetchStatus()
    const interval = setInterval(fetchStatus, 8000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch('/api/auth/session')
        if (!res.ok) return
        const data = await res.json() as { user?: { email?: string | null } }
        setSessionEmail(data.user?.email ?? null)
      } catch {
        setSessionEmail(null)
      }
    }
    fetchSession()
  }, [])

  const totalActive = running + pending
  const isMoreActive = moreNavItems.some(item => item.href === '/' ? pathname === '/' : pathname.startsWith(item.href))

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-white/[0.06] bg-[#0a0a0f] min-[600px]:flex lg:w-64">
        {/* Logo */}
        <div className="flex h-14 items-center gap-3 border-b border-white/[0.06] px-4">
          <Link href="/" className="group flex items-center gap-3 min-w-0">
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/20">
              <Zap className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold tracking-tight text-white">ForgePilot</p>
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">AI Workflow OS</p>
            </div>
          </Link>
        </div>

        {/* Pending Approvals Alert — visible when operator action is needed */}
        {pendingApprovalCount > 0 && (
          <Link
            href="/delegations?status=pending"
            className="mx-3 mt-2 flex items-center gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/[0.08] px-3 py-2.5 transition-all hover:border-amber-500/50 hover:bg-amber-500/[0.12]"
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" strokeWidth={2} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-amber-300 leading-none">
                {pendingApprovalCount} awaiting approval
              </p>
              <p className="mt-0.5 text-[10px] text-amber-500/80 leading-none">Tap to review →</p>
            </div>
            <span className="shrink-0 rounded-full bg-amber-500/25 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 tabular-nums">
              {pendingApprovalCount}
            </span>
          </Link>
        )}

        {/* Nav sections */}
        <div className="flex-1 overflow-y-auto py-3 scrollbar-hide">
          {/* ── Core workflow ──────────────────────────────────────────── */}
          <NavSection
            title={ui.workspace}
            items={primaryNavItems}
            pathname={pathname}
            running={running}
            totalActive={totalActive}
            attentionCount={attentionCount}
            unreadNotificationCount={unreadNotificationCount}
            autonomousModeActive={autonomousModeActive}
            titleClassName="text-violet-400"
            nav={nav}
            ui={ui}
          />

          {/* ── Workflow tools (secondary, always visible) ─────────────── */}
          <div className="mt-1 px-2">
            <p className="mb-1 px-2 text-[9px] font-bold uppercase tracking-widest text-slate-600">Tools</p>
            {workflowNavItems.map(item => {
              const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
              const count =
                item.href === '/inbox' ? (attentionCount + unreadNotificationCount) || undefined
                  : item.href === '/live' ? (running > 0 ? running : undefined)
                  : undefined
              return (
                <SidebarLink
                  key={item.href}
                  href={item.href}
                  label={nav[item.key].label}
                  icon={item.icon}
                  isActive={isActive}
                  count={count}
                  isNew={item.isNew}
                  compact
                />
              )
            })}
          </div>

          {/* ── Expert tools (collapsed by default) ────────────────────── */}
          <details
            open={expertNavItems.some(item => item.href === '/' ? pathname === '/' : pathname.startsWith(item.href))}
            className="mx-2 mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02]"
          >
            <summary
              className={cx(
                'cursor-pointer list-none px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors hover:text-slate-300',
                expertNavItems.some(item => item.href === '/' ? pathname === '/' : pathname.startsWith(item.href))
                  ? 'text-violet-300' : 'text-slate-500'
              )}
            >
              {locale === 'de' ? 'Werkzeuge' : 'Tools'}
            </summary>
            <p className="px-3 pb-2 text-[11px] leading-4 text-slate-600">
              {locale === 'de'
                ? 'Nur das, was du im Alltag wirklich brauchst.'
                : 'Only the tools you need day to day.'}
            </p>
            <div className="pb-2">
              {expertNavItems.map(item => {
                const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
                const count = item.href === '/tools' ? attentionCount : undefined
                const isLive = false
                const isAutonomousSettings = item.href === '/settings' && autonomousModeActive
                return (
                  <SidebarLink
                    key={item.href}
                    href={item.href}
                    label={nav[item.key].label}
                    icon={item.icon}
                    isActive={isActive}
                    count={count}
                    isLive={isLive}
                    isNew={item.isNew}
                    autonomousActive={isAutonomousSettings}
                    compact
                  />
                )
              })}
            </div>
          </details>
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.06] p-3 space-y-2">
          {sessionEmail && (
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <p className="truncate text-xs font-semibold text-slate-300">{sessionEmail}</p>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="mt-1 text-xs font-medium text-slate-500 transition hover:text-slate-300"
              >
                {ui.logout}
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
              }}
              className="group flex flex-1 items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-slate-500 transition-all hover:border-violet-500/30 hover:bg-violet-500/5 hover:text-slate-300"
            >
              <span className="flex items-center gap-2">
                <Command className="h-3 w-3" />
                <span className="lg:hidden">{ui.search}</span>
                <span className="hidden lg:inline">{ui.quickSearch}</span>
              </span>
              <kbd className="hidden rounded border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-slate-500 lg:inline">⌘K</kbd>
            </button>
            <ThemeToggle />
            <NotificationBell initialUnreadCount={unreadNotificationCount} />
          </div>

          <div className="flex rounded-lg border border-white/[0.06] bg-white/[0.02] p-1">
            {(['de', 'en'] as Locale[]).map(option => (
              <button
                key={option}
                type="button"
                onClick={() => setLocale(option)}
                className={cx(
                  'flex-1 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors',
                  locale === option
                    ? 'bg-violet-500/20 text-violet-200'
                    : 'text-slate-500 hover:text-slate-300'
                )}
              >
                {option}
              </button>
            ))}
          </div>

          {running > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.07] px-3 py-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <p className="text-xs font-medium text-emerald-300">
                {running} {running > 1 ? ui.agentsRunning : ui.agentRunning}
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile top nav */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a0a0f]/95 backdrop-blur min-[600px]:hidden">
        <div className="flex h-12 items-center gap-1.5 px-3">
          <Link href="/" className="flex shrink-0 items-center gap-2 pr-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600">
              <Zap className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="hidden text-sm font-bold text-white sm:block">ForgePilot</span>
          </Link>
          <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto scrollbar-hide">
            {primaryNavItems.map(item => {
              const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx(
                    'shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                    isActive
                      ? 'bg-violet-500/15 text-violet-200'
                      : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
                  )}
                >
                  {nav[item.key].short}
                </Link>
              )
            })}
            <Link
              href="/tools"
              className="shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              {ui.more}
            </Link>
          </div>
          {pendingApprovalCount > 0 && (
            <Link
              href="/delegations?status=pending"
              className="shrink-0 flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/[0.12] px-2 py-0.5"
              title={`${pendingApprovalCount} awaiting approval`}
            >
              <AlertTriangle className="h-3 w-3 text-amber-400" strokeWidth={2} />
              <span className="text-xs font-bold text-amber-300">{pendingApprovalCount}</span>
            </Link>
          )}
          {pendingApprovalCount === 0 && totalActive > 0 && (
            <span className="shrink-0 rounded-full bg-violet-500/20 px-2 py-0.5 text-xs font-bold text-violet-300">
              {totalActive}
            </span>
          )}
          <ThemeToggle />
          <NotificationBell initialUnreadCount={unreadNotificationCount} />
        </div>
      </nav>
    </>
  )
}

function NavSection({
  title,
  items,
  pathname,
  running,
  totalActive,
  attentionCount,
  unreadNotificationCount,
  autonomousModeActive,
  titleClassName,
  nav,
  ui,
}: {
  title: string
  items: NavItem[]
  pathname: string
  running: number
  totalActive: number
  attentionCount: number
  unreadNotificationCount: number
  autonomousModeActive: boolean
  titleClassName: string
  nav: ReturnType<typeof useI18n>['nav']
  ui: ReturnType<typeof useI18n>['ui']
}) {
  return (
    <div className="mb-1">
      <p className={cx('mb-0.5 px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest', titleClassName)}>
        {title}
      </p>
      {items.map(item => {
        const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
        const count =
          item.href === '/delegations' ? totalActive
            : item.href === '/inbox' ? attentionCount
            : item.href === '/notifications' ? unreadNotificationCount
            : undefined
        const isLive = item.href === '/delegations' && running > 0
        const isAutonomousSettings = item.href === '/settings' && autonomousModeActive
        return (
          <SidebarLink
            key={item.href}
            href={item.href}
            label={nav[item.key].label}
            icon={item.icon}
            isActive={isActive}
            count={count}
            isLive={isLive}
            isNew={item.isNew}
            newLabel={ui.new}
            autonomousActive={isAutonomousSettings}
          />
        )
      })}
    </div>
  )
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  isActive,
  count,
  isLive,
  isNew,
  newLabel = 'New',
  autonomousActive,
  compact = false,
}: {
  href: string
  label: string
  icon: React.ElementType
  isActive: boolean
  count?: number
  isLive?: boolean
  isNew?: boolean
  newLabel?: string
  autonomousActive?: boolean
  compact?: boolean
}) {
  return (
    <Link
      href={href}
      className={cx(
        'group relative mx-2 flex items-center justify-between rounded-lg px-3 text-sm transition-all duration-150',
        compact ? 'py-1.5' : 'py-2',
        isActive
          ? 'bg-white/[0.08] text-white shadow-sm'
          : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
      )}
    >
      {isActive && (
        <span className="absolute left-0 inset-y-1.5 w-[3px] rounded-r-full bg-violet-500" />
      )}
      <span className="flex min-w-0 items-center gap-3">
        <Icon
          className={cx(
            'h-[15px] w-[15px] shrink-0 transition-colors',
            isActive ? 'text-violet-400' : 'text-slate-500 group-hover:text-slate-400'
          )}
          strokeWidth={isActive ? 2 : 1.75}
        />
        <span className={cx('truncate text-sm font-medium', isActive ? 'text-white' : '')}>
          {label}
        </span>
      </span>
      {count !== undefined && count > 0 ? (
        <span
          className={cx(
            'ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none tabular-nums',
            isLive
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'bg-violet-500/20 text-violet-300'
          )}
        >
          {count}
        </span>
      ) : autonomousActive ? (
        <span className="relative ml-2 flex h-2 w-2 shrink-0" title="Autonomer Modus aktiv">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
      ) : isNew ? (
        <span className="ml-auto rounded bg-violet-500/20 px-1 py-0.5 text-[9px] font-bold uppercase text-violet-400">{newLabel}</span>
      ) : isActive ? (
        <ChevronRight className="ml-2 h-3 w-3 shrink-0 text-violet-400/50" />
      ) : null}
    </Link>
  )
}
