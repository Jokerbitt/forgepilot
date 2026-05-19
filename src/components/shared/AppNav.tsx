'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  Inbox,
  FileText,
  CheckSquare,
  Kanban,
  Activity,
  ListChecks,
  History,
  Bot,
  BookOpen,
  Package,
  GitBranch,
  Shield,
  FlaskConical,
  Settings,
  Command,
  ChevronRight,
  Zap,
  BarChart3,
  Search,
  Brain,
  Network,
  Lightbulb,
} from 'lucide-react'
import type { Delegation } from '@/lib/models/delegation'
import type { AttentionItem } from '@/lib/models/attention'
import type { Notification } from '@/lib/models/notification'
import { cx } from '@/components/ui/primitives'

interface NavItem {
  href: string
  label: string
  shortLabel: string
  icon: React.ElementType
  section: string
  isNew?: boolean
}

const navItems: NavItem[] = [
  { href: '/', label: 'Command Center', shortLabel: 'Command', icon: LayoutDashboard, section: 'Operate' },
  { href: '/inbox', label: 'Inbox', shortLabel: 'Inbox', icon: Inbox, section: 'Operate' },
  { href: '/project-briefs', label: 'Project Briefs', shortLabel: 'Briefs', icon: FileText, section: 'Plan' },
  { href: '/work-items', label: 'Work Items', shortLabel: 'Items', icon: CheckSquare, section: 'Plan' },
  { href: '/board', label: 'Agent Board', shortLabel: 'Board', icon: Kanban, section: 'Execute' },
  { href: '/active', label: 'Active Runs', shortLabel: 'Active', icon: Activity, section: 'Execute' },
  { href: '/delegations', label: 'Delegation Queue', shortLabel: 'Queue', icon: ListChecks, section: 'Execute' },
  { href: '/agent-runs', label: 'Agent Runs', shortLabel: 'Runs', icon: History, section: 'Execute' },
  { href: '/agents', label: 'Agent Control', shortLabel: 'Agents', icon: Bot, section: 'Execute' },
  { href: '/orchestrations', label: 'Orchestrierungen', shortLabel: 'Orch.', icon: Network, section: 'Execute', isNew: true },
  { href: '/pm-agent', label: 'PM Agent', shortLabel: 'PM Agent', icon: Brain, section: 'Execute', isNew: true },
  { href: '/knowledge', label: 'Knowledge Center', shortLabel: 'Knowledge', icon: BookOpen, section: 'Knowledge' },
  { href: '/knowledge/research', label: 'Research Platform', shortLabel: 'Research', icon: Search, section: 'Knowledge', isNew: true },
  { href: '/context-packages', label: 'Context Packages', shortLabel: 'Context', icon: Package, section: 'Knowledge' },
  { href: '/model-router', label: 'Model Router', shortLabel: 'Router', icon: GitBranch, section: 'System' },
  { href: '/governance', label: 'Governance Hub', shortLabel: 'Gov', icon: Shield, section: 'System' },
  { href: '/analytics', label: 'Cost Analytics', shortLabel: 'Analytics', icon: BarChart3, section: 'System' },
  { href: '/idea', label: 'Idea → Production', shortLabel: 'Idea', icon: Lightbulb, section: 'System', isNew: true },
  { href: '/pilot', label: 'E2E Pilot', shortLabel: 'Pilot', icon: FlaskConical, section: 'System' },
  { href: '/settings', label: 'Settings', shortLabel: 'Settings', icon: Settings, section: 'System' },
]

const sectionOrder = ['Operate', 'Plan', 'Execute', 'Knowledge', 'System']

const sectionColors: Record<string, string> = {
  Operate: 'text-violet-400',
  Plan: 'text-sky-400',
  Execute: 'text-emerald-400',
  Knowledge: 'text-amber-400',
  System: 'text-slate-500',
}

export function AppNav() {
  const pathname = usePathname()
  const [running, setRunning] = useState(0)
  const [pending, setPending] = useState(0)
  const [attentionCount, setAttentionCount] = useState(0)
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const [delRes, attRes, notifRes] = await Promise.all([
          fetch('/api/delegations'),
          fetch('/api/attention'),
          fetch('/api/notifications?unread=true'),
        ])
        const data = await delRes.json() as Delegation[]
        if (Array.isArray(data)) {
          setRunning(data.filter(d => d.status === 'running').length)
          setPending(data.filter(d => d.status === 'pending' || d.status === 'approved').length)
        }
        const att = await attRes.json() as AttentionItem[]
        if (Array.isArray(att)) {
          setAttentionCount(att.filter(i => !i.resolvedAt).length)
        }
        const notifs = await notifRes.json() as Notification[]
        if (Array.isArray(notifs)) {
          setUnreadNotificationCount(notifs.length)
        }
      } catch {
        // nav badge is non-critical
      }
    }
    fetchStatus()
    const interval = setInterval(fetchStatus, 8000)
    return () => clearInterval(interval)
  }, [])

  const totalActive = running + pending

  const grouped = sectionOrder.map(section => ({
    section,
    items: navItems.filter(i => i.section === section),
  }))

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-white/[0.06] bg-[#0a0a0f] lg:flex">
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

        {/* Nav sections */}
        <div className="flex-1 overflow-y-auto py-3 scrollbar-hide">
          {grouped.map(({ section, items }) => (
            <div key={section} className="mb-1">
              <p className={cx(
                'mb-0.5 px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest',
                sectionColors[section] ?? 'text-slate-500'
              )}>
                {section}
              </p>
              {items.map(item => {
                const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
                const count =
                  item.href === '/delegations' ? totalActive
                    : item.href === '/active' ? running
                    : item.href === '/inbox' ? attentionCount + unreadNotificationCount
                    : undefined
                const isLive = (item.href === '/delegations' || item.href === '/active') && running > 0
                return (
                  <SidebarLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    isActive={isActive}
                    count={count}
                    isLive={isLive}
                    isNew={item.isNew}
                  />
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.06] p-3 space-y-2">
          <button
            onClick={() => {
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
            }}
            className="group flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-slate-500 transition-all hover:border-violet-500/30 hover:bg-violet-500/5 hover:text-slate-300"
          >
            <span className="flex items-center gap-2">
              <Command className="h-3 w-3" />
              <span>Quick search</span>
            </span>
            <kbd className="rounded border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-slate-500">⌘K</kbd>
          </button>

          {running > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.07] px-3 py-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <p className="text-xs font-medium text-emerald-300">{running} Agent{running > 1 ? 's' : ''} running</p>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile top nav */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a0a0f]/95 backdrop-blur lg:hidden">
        <div className="flex h-12 items-center gap-1.5 px-3">
          <Link href="/" className="flex shrink-0 items-center gap-2 pr-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600">
              <Zap className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="hidden text-sm font-bold text-white sm:block">ForgePilot</span>
          </Link>
          <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto scrollbar-hide">
            {navItems.map(item => {
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
                  {item.shortLabel}
                </Link>
              )
            })}
          </div>
          {totalActive > 0 && (
            <span className="shrink-0 rounded-full bg-violet-500/20 px-2 py-0.5 text-xs font-bold text-violet-300">
              {totalActive}
            </span>
          )}
        </div>
      </nav>
    </>
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
}: {
  href: string
  label: string
  icon: React.ElementType
  isActive: boolean
  count?: number
  isLive?: boolean
  isNew?: boolean
}) {
  return (
    <Link
      href={href}
      className={cx(
        'group relative mx-2 flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-all duration-150',
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
      ) : isNew ? (
        <span className="ml-auto rounded bg-violet-500/20 px-1 py-0.5 text-[9px] font-bold text-violet-400">NEU</span>
      ) : isActive ? (
        <ChevronRight className="ml-2 h-3 w-3 shrink-0 text-violet-400/50" />
      ) : null}
    </Link>
  )
}
