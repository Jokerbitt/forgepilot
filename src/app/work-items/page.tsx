'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import type { WorkItem, WorkItemSource } from '@/lib/models/work-item'
import { Badge, StatusDot, cx } from '@/components/ui/primitives'
import { BlockedByBadge } from '@/components/work-items/BlockedByBadge'
import { CSVImport } from '@/components/work-items/CSVImport'

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
const WP_STATUS_COLOR: Record<string, string> = {
  backlog: 'text-slate-500',
  ready: 'text-sky-400',
  in_progress: 'text-amber-400',
  in_review: 'text-purple-400',
  done: 'text-emerald-400',
  blocked: 'text-red-400',
  cancelled: 'text-slate-600',
}
const WP_PRIORITY_COLOR: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-amber-300',
  medium: 'text-sky-300',
  low: 'text-slate-400',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// ─── WorkPackage types (inline to avoid server-only import issues) ──

interface WorkPackage {
  id: string
  milestoneId: string
  briefId: string
  title: string
  description: string
  definitionOfDone: string[]
  riskClass: 'A' | 'B' | 'C'
  priority: 'critical' | 'high' | 'medium' | 'low'
  estimatedHours: number
  dependsOn: string[]
  status: 'backlog' | 'ready' | 'in_progress' | 'in_review' | 'done' | 'blocked' | 'cancelled'
  delegationIds: string[]
  tags: string[]
  createdAt: string
  updatedAt: string
}

interface Milestone {
  id: string
  briefId: string
  title: string
  description: string
  goal: string
  targetWeek?: number
  status: string
  workPackageIds: string[]
  createdAt: string
  updatedAt: string
}

interface WorkPackagesData {
  workPackages: WorkPackage[]
  milestones: Milestone[]
}

// ─── Work Items Tab ─────────────────────────────────────────────────

function WorkItemsTab({ projectId }: { projectId: string | null }) {
  const [items, setItems] = useState<WorkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<WorkItemSource | ''>('')
  const [creating, setCreating] = useState<string | null>(null)
  const [created, setCreated] = useState<Set<string>>(new Set())
  const [orchestrating, setOrchestrating] = useState<string | null>(null)
  const [orchestrated, setOrchestrated] = useState<Map<string, string>>(new Map()) // itemId → runId
  const [csvImportOpen, setCsvImportOpen] = useState(false)

  const load = useCallback((isSyncClick = false) => {
    if (isSyncClick) setSyncing(true)
    const url = projectId ? `/api/work-items?projectId=${encodeURIComponent(projectId)}` : '/api/work-items'
    fetch(url)
      .then(r => r.json())
      .then((data: { items: WorkItem[]; errors?: string[] }) => {
        setItems(Array.isArray(data.items) ? data.items : [])
        setErrors(data.errors ?? [])
        setLastSync(new Date())
      })
      .catch(() => setItems([]))
      .finally(() => { setLoading(false); setSyncing(false) })
  }, [projectId])

  useEffect(() => { load() }, [load])

  const buildDelegationPayload = (item: WorkItem) => ({
    id: `wi-${item.id}-${Date.now()}`,
    title: item.title,
    status: 'approved',
    contract: {
      id: `tc-wi-${item.id}`,
      workItemId: item.id,
      goal: item.title,
      context: `Source: ${item.source}${item.url ? `, URL: ${item.url}` : ''}`,
      definitionOfDone: ['Implementiert', 'Tests grün', 'PR erstellt'],
      riskClass: item.risk,
      maxBudgetUsd: item.costEstimateUsd ?? 5,
      allowedTools: ['Bash', 'Read', 'Write', 'Edit'],
      branchStrategy: 'feature',
      requiresApproval: item.risk === 'C',
      privacyMode: 'local',
      createdAt: new Date().toISOString(),
    },
    executionRoute: 'local-agent',
    costEstimateUsd: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  const createDelegation = async (item: WorkItem) => {
    setCreating(item.id)
    try {
      const res = await fetch('/api/delegations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildDelegationPayload(item)),
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

  const createAndOrchestrate = async (item: WorkItem) => {
    setOrchestrating(item.id)
    try {
      // 1. Create delegation
      const delPayload = buildDelegationPayload(item)
      await fetch('/api/delegations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(delPayload),
      })
      // 2. Decompose with AI → create orchestrated run
      const orchRes = await fetch('/api/agents/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delegationId: delPayload.id,
          delegationTitle: item.title,
          goal: item.title,
          context: delPayload.contract.context,
        }),
      })
      if (orchRes.ok) {
        const { run } = await orchRes.json() as { run: { id: string } }
        setOrchestrated(prev => new Map(Array.from(prev).concat([[item.id, run.id]])))
        setCreated(prev => new Set(Array.from(prev).concat(item.id)))
      }
    } catch {
      // silent
    } finally {
      setOrchestrating(null)
    }
  }

  const searchLower = search.toLowerCase()
  const filtered = items
    .filter(i => !sourceFilter || i.source === sourceFilter)
    .filter(i => !searchLower || i.title.toLowerCase().includes(searchLower) || i.id.toLowerCase().includes(searchLower))

  const sources = Array.from(new Set(items.map(i => i.source))) as WorkItemSource[]
  const exportParams = new URLSearchParams()
  exportParams.set('cached', '1')
  if (sourceFilter) exportParams.set('source', sourceFilter)
  if (projectId) exportParams.set('projectId', projectId)
  const exportHref = `/api/work-items/export?${exportParams.toString()}`

  return (
    <div>
      {csvImportOpen && (
        <CSVImport
          onClose={() => setCsvImportOpen(false)}
          onImported={(newItems) => { setItems(prev => [...prev, ...newItems]) }}
        />
      )}
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
        <div className="ml-auto flex items-center gap-3">
          {lastSync && (
            <p className="text-xs text-slate-600">
              Sync {lastSync.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
          <button
            onClick={() => setCsvImportOpen(true)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
          >
            ↑ CSV Import
          </button>
          <a
            href={exportHref}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800 hover:text-white"
          >
            ↓ CSV Export
          </a>
          <button
            onClick={() => load(true)}
            disabled={syncing}
            className={cx(
              'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
              syncing ? 'bg-slate-800 text-slate-500' : 'bg-slate-700 text-white hover:bg-slate-600'
            )}
          >
            {syncing ? 'Lädt…' : '↻ Sync'}
          </button>
          <span className="text-xs text-slate-500">{items.length} Items</span>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-800/40 bg-amber-900/10 px-3 py-2 text-xs text-amber-400">
          {errors[0]}
        </div>
      )}

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
                        {item.blockedBy && item.blockedBy.length > 0 && (
                          <div className="mt-2">
                            <BlockedByBadge itemId={item.id} blockedBy={item.blockedBy} />
                          </div>
                        )}
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
                    {orchestrated.has(item.id) ? (
                      <Link
                        href={`/orchestrations`}
                        className="text-xs font-medium text-violet-400 hover:underline"
                      >
                        ⚙ Orchestriert ✓
                      </Link>
                    ) : created.has(item.id) ? (
                      <Link
                        href="/delegations"
                        className="text-xs font-medium text-emerald-400 hover:underline"
                      >
                        Angelegt ✓
                      </Link>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => createDelegation(item)}
                          disabled={creating === item.id || orchestrating === item.id}
                          className={cx(
                            'rounded px-2 py-1 text-xs font-semibold transition-colors',
                            creating === item.id
                              ? 'bg-slate-700 text-slate-400'
                              : 'bg-slate-700 text-white hover:bg-slate-600'
                          )}
                          title="Delegation erstellen"
                        >
                          {creating === item.id ? '…' : '→ Del'}
                        </button>
                        <button
                          onClick={() => createAndOrchestrate(item)}
                          disabled={creating === item.id || orchestrating === item.id}
                          className={cx(
                            'rounded px-2 py-1 text-xs font-semibold transition-colors',
                            orchestrating === item.id
                              ? 'bg-violet-900 text-violet-400'
                              : 'bg-violet-800 text-white hover:bg-violet-700'
                          )}
                          title="Delegation erstellen + sofort in Sub-Tasks zerlegen"
                        >
                          {orchestrating === item.id ? '⚙…' : '⚙ Auto'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Work Packages Tab ──────────────────────────────────────────────

function WorkPackagesTab() {
  const [data, setData] = useState<WorkPackagesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState<string | null>(null)
  const [delegated, setDelegated] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    Promise.all([
      fetch('/api/work-packages').then(r => r.json()) as Promise<WorkPackage[]>,
      fetch('/api/milestones').then(r => r.json()) as Promise<Milestone[]>,
    ])
      .then(([wps, milestones]) => {
        setData({
          workPackages: Array.isArray(wps) ? wps : [],
          milestones: Array.isArray(milestones) ? milestones : [],
        })
      })
      .catch(() => setData({ workPackages: [], milestones: [] }))
      .finally(() => setLoading(false))
  }, [])

  const handleDelegate = async (wp: WorkPackage) => {
    setCreating(wp.id)
    try {
      const res = await fetch(`/api/work-packages/${wp.id}/create-delegation`, { method: 'POST' })
      if (res.ok) {
        const result = await res.json() as { delegationId: string }
        setDelegated(prev => new Map(Array.from(prev).concat([[wp.id, result.delegationId]])))
      }
    } catch {
      // silent
    } finally {
      setCreating(null)
    }
  }

  if (loading) return <p className="py-8 text-center text-sm text-slate-500">Lade Work Packages…</p>

  if (!data || data.workPackages.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
        <p className="text-sm font-medium text-white">Keine Work Packages</p>
        <p className="mt-1 text-xs text-slate-500">
          Erstelle zuerst einen Project Brief und generiere Milestones + Work Packages.
        </p>
      </div>
    )
  }

  // Group by milestoneId
  const milestoneMap = new Map(data.milestones.map(m => [m.id, m]))
  const grouped = new Map<string, WorkPackage[]>()
  for (const wp of data.workPackages) {
    const group = grouped.get(wp.milestoneId) ?? []
    group.push(wp)
    grouped.set(wp.milestoneId, group)
  }

  // Collect WPs with unknown milestones
  const unknownMilestoneWps = data.workPackages.filter(wp => !milestoneMap.has(wp.milestoneId))

  return (
    <div className="space-y-8">
      {Array.from(grouped.entries()).map(([milestoneId, wps]) => {
        const milestone = milestoneMap.get(milestoneId)
        const done = wps.filter(wp => wp.status === 'done').length
        return (
          <div key={milestoneId}>
            <div className="mb-3 flex items-center gap-3">
              <h3 className="text-sm font-semibold text-white">
                {milestone?.title ?? milestoneId}
              </h3>
              {milestone?.targetWeek != null && (
                <span className="text-xs text-slate-500">Woche {milestone.targetWeek}</span>
              )}
              <span className={cx(
                'rounded-full px-2 py-0.5 text-xs font-medium border',
                milestone?.status === 'completed' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800/40' :
                milestone?.status === 'in_progress' ? 'bg-amber-900/30 text-amber-400 border-amber-800/40' :
                milestone?.status === 'blocked' ? 'bg-red-900/30 text-red-400 border-red-800/40' :
                'bg-slate-800 text-slate-400 border-slate-700'
              )}>
                {milestone?.status ?? 'unknown'}
              </span>
              <span className="text-xs text-slate-600">{done}/{wps.length} done</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Work Package</th>
                    <th className="hidden px-4 py-3 sm:table-cell">Status</th>
                    <th className="hidden px-4 py-3 md:table-cell">Priorität</th>
                    <th className="px-4 py-3">Risk</th>
                    <th className="hidden px-4 py-3 lg:table-cell">Stunden</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {wps.map(wp => (
                    <tr key={wp.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-white max-w-xs">{wp.title}</p>
                          <p className="mt-0.5 font-mono text-xs text-slate-600">{wp.id}</p>
                          {wp.tags.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {wp.tags.slice(0, 3).map(tag => (
                                <span key={tag} className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400">{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className={cx('hidden px-4 py-3 text-xs font-medium sm:table-cell', WP_STATUS_COLOR[wp.status])}>
                        {wp.status.replace('_', ' ')}
                      </td>
                      <td className={cx('hidden px-4 py-3 text-xs font-medium md:table-cell', WP_PRIORITY_COLOR[wp.priority])}>
                        {wp.priority}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cx('rounded border px-1.5 py-0.5 text-xs font-bold', RISK_COLOR[wp.riskClass])}>
                          {wp.riskClass}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-slate-500 lg:table-cell">{wp.estimatedHours}h</td>
                      <td className="px-4 py-3">
                        {delegated.has(wp.id) ? (
                          <Link
                            href="/delegations"
                            className="text-xs font-medium text-emerald-400 hover:underline"
                          >
                            Delegiert ✓
                          </Link>
                        ) : (
                          <button
                            onClick={() => handleDelegate(wp)}
                            disabled={creating === wp.id || wp.status === 'done' || wp.status === 'cancelled'}
                            className={cx(
                              'rounded px-2.5 py-1 text-xs font-semibold transition-colors',
                              creating === wp.id
                                ? 'bg-slate-700 text-slate-400'
                                : wp.status === 'done' || wp.status === 'cancelled'
                                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                                  : 'bg-slate-700 text-white hover:bg-slate-600'
                            )}
                          >
                            {creating === wp.id ? '…' : '→ Delegieren'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {unknownMilestoneWps.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-400">Ohne Milestone</h3>
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-800">
                {unknownMilestoneWps.map(wp => (
                  <tr key={wp.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <p className="truncate font-medium text-white max-w-xs">{wp.title}</p>
                      <p className="mt-0.5 font-mono text-xs text-slate-600">{wp.id}</p>
                    </td>
                    <td className={cx('px-4 py-3 text-xs font-medium', WP_STATUS_COLOR[wp.status])}>
                      {wp.status}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cx('rounded border px-1.5 py-0.5 text-xs font-bold', RISK_COLOR[wp.riskClass])}>
                        {wp.riskClass}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────

type ActiveTab = 'work-items' | 'work-packages'

function WorkItemsPageInner() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('work-items')
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl p-6">
        <header className="mb-8 mt-2 border-b border-slate-800 pb-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Execute</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Work Items</h1>
              <p className="mt-2 text-sm text-slate-400">Linear, GitHub und lokale Tickets — oder AI-generierte Work Packages.</p>
            </div>
            {projectId && (
              <Link
                href="/work-items"
                className="text-xs text-violet-400 hover:underline"
              >
                ✕ Projektfilter entfernen
              </Link>
            )}
          </div>
          {projectId && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/[0.07] px-3 py-2">
              <span className="text-xs text-violet-300">
                Gefiltert nach Projekt: <span className="font-mono text-violet-200">{projectId}</span>
              </span>
            </div>
          )}
        </header>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 border-b border-slate-800 pb-0">
          <button
            onClick={() => setActiveTab('work-items')}
            className={cx(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === 'work-items'
                ? 'border-sky-500 text-white'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            )}
          >
            Work Items
          </button>
          <button
            onClick={() => setActiveTab('work-packages')}
            className={cx(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === 'work-packages'
                ? 'border-sky-500 text-white'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            )}
          >
            Work Packages
          </button>
        </div>

        {activeTab === 'work-items' ? <WorkItemsTab projectId={projectId} /> : <WorkPackagesTab />}
      </div>
    </main>
  )
}

export default function WorkItemsPage() {
  return (
    <Suspense fallback={null}>
      <WorkItemsPageInner />
    </Suspense>
  )
}
