'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { Delegation } from '@/lib/models/delegation'

interface NavItem {
  label: string
  shortLabel?: string
  href: string
  section: string
  keywords: string[]
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Command Center', href: '/', section: 'Navigate', keywords: ['home', 'dashboard', 'overview'] },
  { label: 'Inbox', href: '/inbox', section: 'Navigate', keywords: ['attention', 'alerts', 'notifications'] },
  { label: 'Agent Board', href: '/board', section: 'Navigate', keywords: ['kanban', 'board', 'overview'] },
  { label: 'Active Runs', href: '/active', section: 'Navigate', keywords: ['running', 'live', 'agents'] },
  { label: 'Delegation Queue', href: '/delegations', section: 'Navigate', keywords: ['queue', 'tasks', 'delegate'] },
  { label: 'Project Briefs', href: '/project-briefs', section: 'Navigate', keywords: ['briefs', 'projects'] },
  { label: 'Work Items', href: '/work-items', section: 'Navigate', keywords: ['linear', 'issues', 'tickets'] },
  { label: 'Agent Runs', href: '/agent-runs', section: 'Navigate', keywords: ['history', 'traces', 'logs'] },
  { label: 'Knowledge Center', href: '/knowledge', section: 'Navigate', keywords: ['memory', 'cards', 'knowledge'] },
  { label: 'Settings', href: '/settings', section: 'Navigate', keywords: ['config', 'keys', 'api'] },
]

function matchScore(item: NavItem, query: string): number {
  const q = query.toLowerCase()
  if (item.label.toLowerCase().startsWith(q)) return 3
  if (item.label.toLowerCase().includes(q)) return 2
  if (item.keywords.some(k => k.includes(q))) return 1
  return 0
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [delegations, setDelegations] = useState<Delegation[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIdx(0)
      inputRef.current?.focus()
      // Load recent delegations for quick navigation
      fetch('/api/delegations')
        .then(r => r.json())
        .then((all: Delegation[]) => setDelegations(all.slice(0, 20)))
        .catch(() => {})
    }
  }, [open])

  type ResultItem =
    | { kind: 'nav'; item: NavItem }
    | { kind: 'del'; item: Delegation }

  const { navResults, delResults, results } = useMemo<{
    navResults: NavItem[]
    delResults: Delegation[]
    results: ResultItem[]
  }>(() => {
    const nav = query
      ? NAV_ITEMS.filter(i => matchScore(i, query) > 0).sort((a, b) => matchScore(b, query) - matchScore(a, query))
      : NAV_ITEMS.slice(0, 6)
    const del = query
      ? delegations.filter(d =>
          (d.title || d.contract.goal).toLowerCase().includes(query.toLowerCase()) ||
          d.contract.workItemId.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 4)
      : delegations.filter(d => d.status === 'running' || d.status === 'approved').slice(0, 4)
    return {
      navResults: nav,
      delResults: del,
      results: [
        ...nav.map(item => ({ kind: 'nav' as const, item })),
        ...del.map(item => ({ kind: 'del' as const, item })),
      ],
    }
  }, [query, delegations])

  const navigate = useCallback((idx: number) => {
    const r = results[idx]
    if (!r) return
    if (r.kind === 'nav') router.push(r.item.href)
    else router.push(`/delegations/${r.item.id}`)
    onClose()
  }, [results, router, onClose])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { setSelectedIdx(i => Math.min(i + 1, results.length - 1)); e.preventDefault(); return }
    if (e.key === 'ArrowUp') { setSelectedIdx(i => Math.max(i - 1, 0)); e.preventDefault(); return }
    if (e.key === 'Enter') { navigate(selectedIdx); return }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/60"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
          <span className="text-slate-500">⌘</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIdx(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Navigation, Delegationen, Seiten…"
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-600 outline-none"
          />
          <kbd className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-600">Keine Ergebnisse</p>
          ) : (
            <>
              {navResults.length > 0 && (
                <div>
                  <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">Navigation</p>
                  {navResults.map((item, i) => (
                    <button
                      key={item.href}
                      onMouseEnter={() => setSelectedIdx(i)}
                      onClick={() => navigate(i)}
                      className={`w-full flex items-center justify-between px-4 py-2 text-sm ${
                        selectedIdx === i ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/50'
                      }`}
                    >
                      <span>{item.label}</span>
                      <span className="text-xs text-slate-600">{item.section}</span>
                    </button>
                  ))}
                </div>
              )}
              {delResults.length > 0 && (
                <div>
                  <p className="mt-1 px-4 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    {query ? 'Delegationen' : 'Aktive Delegationen'}
                  </p>
                  {delResults.map((d, i) => {
                    const idx = navResults.length + i
                    return (
                      <button
                        key={d.id}
                        onMouseEnter={() => setSelectedIdx(idx)}
                        onClick={() => navigate(idx)}
                        className={`w-full flex items-center justify-between px-4 py-2 text-sm ${
                          selectedIdx === idx ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/50'
                        }`}
                      >
                        <span className="truncate">{d.title || d.contract.goal.slice(0, 50)}</span>
                        <span className={`ml-2 shrink-0 text-xs ${
                          d.status === 'running' ? 'text-amber-400' :
                          d.status === 'approved' ? 'text-blue-400' : 'text-slate-600'
                        }`}>{d.status}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t border-slate-800 px-4 py-2">
          <span className="text-[10px] text-slate-600"><kbd className="font-mono">↑↓</kbd> navigieren</span>
          <span className="text-[10px] text-slate-600"><kbd className="font-mono">↵</kbd> öffnen</span>
          <span className="text-[10px] text-slate-600"><kbd className="font-mono">?</kbd> Shortcuts</span>
        </div>
      </div>
    </div>
  )
}
