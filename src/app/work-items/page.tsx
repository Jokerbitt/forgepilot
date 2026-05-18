'use client'

import { useEffect, useState, useCallback } from 'react'
import type { WorkItem, WorkItemSource } from '@/lib/models/work-item'
import { Badge, StatusDot, cx } from '@/components/ui/primitives'

// ─── helpers ─────────────────────────────────────────────────────

const PRIORITY_LABEL: Record<number, string> = { 0: 'Urgent', 1: 'Hoch', 2: 'Mittel', 3: 'Niedrig', 4: '—' }
const PRIORITY_COLOR: Record<number, string> = {
  0: 'text-red-400', 1: 'text-amber-300', 2: 'text-sky-300', 3: 'text-slate-400', 4: 'text-slate-600',
}
const SOURCE_LABEL: Record<WorkItemSource, string> = { linear: 'Linear', github: 'GitHub', local: 'Lokal' }
const RISK_COLOR: Record<string, string> = {
  A: 'bg-emerald-900/30 text-emerald-400 border-emerald-800/40',
  B: 'bg-amber-900/30 text-amber-400 border-amber-800/40',
  C: 'bg-red-900/30 text-red-400 border-red-800/40',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// ─── page ────────────────────────────────────────────────────────

export default function WorkItemsPage() {
  const [items, setItems] = useState<WorkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<WorkItemSource | ''>('')
  const [creating, setCreating] = useState<string | null>(null)
  const [created, setCreated] = useState<Set<string>>(new Set())

  const load = useCallback(() => {
    fetch('/api/work-items')
      .then(r => r.json())
      .then((data: { items: WorkItem[]; errors?: string[] }) => {
        setItems(Array.isArray(data.items) ? data.items : [])
        setErrors(data.errors ?? [])
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const createDelegation = async (item: WorkItem) => {
    setCreating(item.id)
    try {
      const res = await fetch('/api/delegations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.title,
          contract: {
            workItemId: item.id,
            goal: item.title,
            context: `Source: ${item.source}, URL: ${item.url}`,
            definitionOfDone: ['Implementiert', 'Tests grün', 'PR erstellt'],
            riskClass: item.risk,
            maxBudgetUsd: item.costEstimateUsd ?? 5,
            allowedTools: ['Bash', 'Read', 'Write', 'Edit'],
            branchStrategy: 'feature',
            requiresApproval: item.risk === 'C',
            privacyMode: 'local',
          },
          executionRoute: 'local-agent',
          privacyMode: 'local',
        }),
      })
      if (res.ok) {
        setCreated(prev => new Set(Array.from(prev).concat(item.id)))
      }
    } catch {
      // silent
    } finally {
      setCreating(null)
    }
  }

  const searchLower = search.toLowerCase()
  const filtered = items
    .filter(i => !sourceFilter || i.source === sourceFilter)
    .filter(i => !searchLower || i.title.toLowerCase().includes(searchLower) || i.id.toLowerCase().includes(searchLower))

  const sources = Array.from(new Set(items.map(i => i.source))) as WorkItemSource[]

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl p-6">
        <header className="mb-8 mt-2 border-b border-slate-800 pb-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Execute</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Work Items</h1>
              <p className="mt-2 text-sm text-slate-400">Linear, GitHub und lokale Tickets — direkt als Delegation anlegen.</p>
            </div>
            <div className="text-xs text-slate-500">{items.length} Items</div>
          </div>
          {errors.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-800/40 bg-amber-900/10 px-3 py-2 text-xs text-amber-400">
              {errors[0]}
            </div>
          )}
        </header>

        {/* Filters */}
        <div className="mb-5 flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Suchen…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-48 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-sky-600"
          />
          <div className="flex gap-1">
            <button
              onClick={() => setSourceFilter('')}
              className={cx('rounded-lg px-3 py-2 text-xs font-medium transition-colors', sourceFilter === '' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300')}
            >
              Alle
            </button>
            {sources.map(src => (
              <button
                key={src}
                onClick={() => setSourceFilter(src)}
                className={cx('rounded-lg px-3 py-2 text-xs font-medium transition-colors', sourceFilter === src ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300')}
              >
                {SOURCE_LABEL[src]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">Lade Work Items…</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
            <p className="text-sm font-medium text-white">Keine Work Items</p>
            <p className="mt-1 text-xs text-slate-500">
              Linear/GitHub-Keys in den Settings eintragen oder lokale Items in <code className="text-sky-400">config/local-items.json</code> anlegen.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Ticket</th>
                  <th className="hidden px-4 py-3 sm:table-cell">Quelle</th>
                  <th className="hidden px-4 py-3 md:table-cell">Priorität</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="hidden px-4 py-3 lg:table-cell">Aktualisiert</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filtered.map(item => (
                  <tr key={item.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <StatusDot tone={item.blocked ? 'warning' : 'neutral'} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-white max-w-xs">{item.title}</p>
                          <p className="mt-0.5 font-mono text-xs text-slate-600">{item.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <Badge>{SOURCE_LABEL[item.source]}</Badge>
                    </td>
                    <td className={cx('hidden px-4 py-3 text-xs font-medium md:table-cell', PRIORITY_COLOR[item.priority])}>
                      {PRIORITY_LABEL[item.priority]}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cx('rounded border px-1.5 py-0.5 text-xs font-bold', RISK_COLOR[item.risk])}>
                        {item.risk}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-slate-500 lg:table-cell">{formatDate(item.updatedAt)}</td>
                    <td className="px-4 py-3">
                      {created.has(item.id) ? (
                        <a
                          href="/delegations"
                          className="text-xs font-medium text-emerald-400 hover:underline"
                        >
                          Angelegt ✓
                        </a>
                      ) : (
                        <button
                          onClick={() => createDelegation(item)}
                          disabled={creating === item.id}
                          className={cx(
                            'rounded px-2.5 py-1 text-xs font-semibold transition-colors',
                            creating === item.id
                              ? 'bg-slate-700 text-slate-400'
                              : 'bg-slate-700 text-white hover:bg-slate-600'
                          )}
                        >
                          {creating === item.id ? '…' : '→ Delegation'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
