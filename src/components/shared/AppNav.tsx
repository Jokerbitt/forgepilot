'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { Delegation } from '@/lib/models/delegation'
import { Badge, StatusDot, cx } from '@/components/ui/primitives'

const navItems = [
  { href: '/', label: 'Command Center', shortLabel: 'Command', section: 'Operate' },
  { href: '/project-briefs', label: 'Project Briefs', shortLabel: 'Briefs', section: 'Plan' },
  { href: '/work-items', label: 'Work Items', shortLabel: 'Items', section: 'Execute' },
  { href: '/delegations', label: 'Delegation Queue', shortLabel: 'Queue', section: 'Execute' },
  { href: '/agent-runs', label: 'Agent Runs', shortLabel: 'Runs', section: 'Execute' },
  { href: '/agents', label: 'Agent Control Plane', shortLabel: 'Agents', section: 'Execute' },
  { href: '/knowledge', label: 'Knowledge Center', shortLabel: 'Knowledge', section: 'Knowledge' },
  { href: '/context-packages', label: 'Context Packages', shortLabel: 'Context', section: 'Knowledge' },
  { href: '/model-router', label: 'Model Router', shortLabel: 'Router', section: 'System' },
  { href: '/pilot', label: 'E2E Pilot', shortLabel: 'Pilot', section: 'System' },
  { href: '/settings', label: 'Settings', shortLabel: 'Settings', section: 'System' },
]

const plannedItems = [
  'Governance Hub',
]

export function AppNav() {
  const pathname = usePathname()
  const [running, setRunning] = useState(0)
  const [pending, setPending] = useState(0)

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/delegations')
        const data = await res.json() as Delegation[]
        if (Array.isArray(data)) {
          setRunning(data.filter(d => d.status === 'running').length)
          setPending(data.filter(d => d.status === 'pending' || d.status === 'approved').length)
        }
      } catch {
        // ignore — nav badge is non-critical
      }
    }
    fetchStatus()
    const interval = setInterval(fetchStatus, 8000)
    return () => clearInterval(interval)
  }, [])

  const totalActive = running + pending

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-slate-800 bg-slate-950 lg:flex lg:flex-col">
        <div className="border-b border-slate-800 px-5 py-5">
          <Link href="/" className="group flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-md border border-sky-500/30 bg-sky-500/10 text-sm font-bold text-sky-300">
              FP
            </span>
            <span>
              <span className="block text-sm font-semibold text-white group-hover:text-sky-200">ForgePilot</span>
              <span className="block text-xs text-slate-500">AI Workflow OS</span>
            </span>
          </Link>
        </div>

        <div className="space-y-6 px-3 py-4">
          <div>
            <p className="px-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Workspace</p>
            <div className="mt-2 space-y-1">
              {navItems.map(item => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  section={item.section}
                  isActive={item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)}
                  count={item.href === '/delegations' ? totalActive : undefined}
                  running={item.href === '/delegations' ? running : undefined}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="px-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Next Modules</p>
            <div className="mt-2 space-y-1">
              {plannedItems.map(item => (
                <div key={item} className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-slate-500">
                  <span>{item}</span>
                  <Badge>Geplant</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-auto border-t border-slate-800 p-4">
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Local AI</p>
                <p className="mt-1 text-sm font-medium text-white">On-demand bereit</p>
              </div>
              <StatusDot tone="success" />
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">Ollama/LM Studio nur starten, wenn Workloads sie brauchen.</p>
          </div>
        </div>
      </aside>

      <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/95 backdrop-blur lg:hidden">
        <div className="flex min-h-14 items-center gap-2 px-3">
          <Link href="/" className="flex shrink-0 items-center gap-2 pr-1">
            <span className="grid h-7 w-7 place-items-center rounded-md border border-sky-500/30 bg-sky-500/10 text-xs font-bold text-sky-300">
              FP
            </span>
            <span className="hidden text-sm font-semibold text-white sm:block">ForgePilot</span>
          </Link>
          <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {navItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={cx(
                  'shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                  (item.href === '/' ? pathname === '/' : pathname.startsWith(item.href))
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                )}
              >
                {item.shortLabel}
              </Link>
            ))}
          </div>
          {totalActive > 0 && (
            <span className="shrink-0 rounded-full bg-sky-500/20 px-2 py-0.5 text-xs font-medium text-sky-300">
              {totalActive}
            </span>
          )}
        </div>
      </nav>
    </>
  )
}

function NavLink({
  href,
  label,
  section,
  isActive,
  count,
  running,
}: {
  href: string
  label: string
  section: string
  isActive: boolean
  count?: number
  running?: number
}) {
  return (
    <Link
      href={href}
      className={cx(
        'group flex items-center justify-between rounded-md px-3 py-2.5 text-sm transition-colors',
        isActive
          ? 'bg-slate-800 text-white shadow-sm shadow-black/10'
          : 'text-slate-400 hover:bg-slate-900 hover:text-white'
      )}
    >
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-xs text-slate-600 group-hover:text-slate-500">{section}</span>
      </span>
      {count !== undefined && count > 0 ? (
        <span
          className={cx(
            'ml-3 grid min-w-6 place-items-center rounded-full px-1.5 py-0.5 text-xs font-bold',
            running && running > 0 ? 'bg-emerald-500 text-slate-950' : 'bg-amber-400 text-slate-950'
          )}
          title={running && running > 0 ? `${running} laufend` : `${count} offen`}
        >
          {count}
        </span>
      ) : (
        <span className={cx('h-2 w-2 rounded-full', isActive ? 'bg-sky-300' : 'bg-slate-700')} aria-hidden="true" />
      )}
    </Link>
  )
}
