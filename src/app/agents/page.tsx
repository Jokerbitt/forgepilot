'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { AgentProfile, AgentRole, AgentAvailability, AgentAutonomyLevel } from '@/lib/models/agent-profile'
import type { SkillPerformanceSummary } from '@/lib/agents/skill-evolver'
import type { OrchestratedRun } from '@/lib/agents/orchestrated-run'
import type { AgentControlPlaneSummary } from '@/lib/agents/control-plane'
import { Badge, StatusDot, cx } from '@/components/ui/primitives'

// ─── constants ───────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<AgentRole, string> = {
  'product-planner':       'Product Planner',
  'architect':             'Architect',
  'backend-engineer':      'Backend Engineer',
  'frontend-saas-designer':'Frontend Designer',
  'local-ai-worker':       'Local AI Worker',
  'qa-reviewer':           'QA Reviewer',
  'devops-automation':     'DevOps / Automation',
  'knowledge-curator':     'Knowledge Curator',
  'critic-reviewer':       'Critic Reviewer',
  'external-coding-agent': 'External Coding Agent',
}

const ROLE_ICON: Record<AgentRole, string> = {
  'product-planner':       'PP',
  'architect':             'AR',
  'backend-engineer':      'BE',
  'frontend-saas-designer':'FD',
  'local-ai-worker':       'LA',
  'qa-reviewer':           'QA',
  'devops-automation':     'DO',
  'knowledge-curator':     'KC',
  'critic-reviewer':       'CR',
  'external-coding-agent': 'EA',
}

const ROLE_SECTION: Record<AgentRole, string> = {
  'product-planner':       'Plan',
  'architect':             'Plan',
  'backend-engineer':      'Execute',
  'frontend-saas-designer':'Execute',
  'local-ai-worker':       'Execute',
  'qa-reviewer':           'Quality',
  'devops-automation':     'Ops',
  'knowledge-curator':     'Knowledge',
  'critic-reviewer':       'Quality',
  'external-coding-agent': 'Execute',
}

const AVAIL_COLOR: Record<AgentAvailability, string> = {
  available: 'text-emerald-400',
  busy:      'text-amber-400',
  offline:   'text-slate-500',
  disabled:  'text-slate-600',
}

const AVAIL_TONE: Record<AgentAvailability, 'success' | 'warning' | 'neutral'> = {
  available: 'success',
  busy:      'warning',
  offline:   'neutral',
  disabled:  'neutral',
}

const AVAIL_LABEL: Record<AgentAvailability, string> = {
  available: 'Verfügbar',
  busy:      'Beschäftigt',
  offline:   'Offline',
  disabled:  'Deaktiviert',
}

const AUTONOMY_LABEL: Record<AgentAutonomyLevel, string> = {
  'read-only':        'Read-Only',
  'propose-only':     'Propose-Only',
  'supervised-write': 'Supervised',
  'autopilot':        'Autopilot',
}

const AUTONOMY_COLOR: Record<AgentAutonomyLevel, string> = {
  'read-only':        'text-slate-400 border-slate-700',
  'propose-only':     'text-sky-400 border-sky-800/60',
  'supervised-write': 'text-amber-400 border-amber-800/60',
  'autopilot':        'text-emerald-400 border-emerald-800/60',
}

const COST_LABEL: Record<string, string> = {
  'free-local':             'Lokal / Free',
  'included-subscription':  'Im Abo',
  'metered-low':            'Metered (günstig)',
  'metered-high':           'Metered (teuer)',
}

const COST_COLOR: Record<string, string> = {
  'free-local':             'text-emerald-400',
  'included-subscription':  'text-sky-400',
  'metered-low':            'text-amber-400',
  'metered-high':           'text-red-400',
}

type Tab = 'control-plane' | 'performance' | 'orchestrate'

// ─── component ───────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AgentProfile | null>(null)
  const [roleFilter, setRoleFilter] = useState<AgentRole | ''>('')
  const [tab, setTab] = useState<Tab>('control-plane')
  const [summary, setSummary] = useState<AgentControlPlaneSummary | null>(null)

  useEffect(() => {
    async function loadControlPlane() {
      try {
        const [agentsResult, summaryResult] = await Promise.allSettled([
          fetch('/api/agents').then(r => r.json() as Promise<AgentProfile[]>),
          fetch('/api/agents/control-plane').then(r => r.json() as Promise<AgentControlPlaneSummary>),
        ])

        if (agentsResult.status === 'fulfilled') {
          setAgents(Array.isArray(agentsResult.value) ? agentsResult.value : [])
        }

        if (summaryResult.status === 'fulfilled' && summaryResult.value?.generatedAt) {
          setSummary(summaryResult.value)
        }
      } finally {
        setLoading(false)
      }
    }

    void loadControlPlane()
  }, [])

  const available = agents.filter(a => a.availability === 'available').length
  const busy      = agents.filter(a => a.availability === 'busy').length
  const sections  = Array.from(new Set(agents.map(a => ROLE_SECTION[a.role])))
  const filtered  = roleFilter ? agents.filter(a => a.role === roleFilter) : agents

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl p-6">

        {/* Header */}
        <header className="mb-6 mt-2 border-b border-slate-800 pb-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Execute</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Agent Control Plane</h1>
              <p className="mt-2 text-sm text-slate-400">Agentenprofile, Skills, Performance und Orchestrierung.</p>
            </div>
            <Link
              href="/agents/skills"
              className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
            >
              Skill Library
            </Link>
            <div className="flex gap-4 text-right text-xs">
              <div>
                <p className="text-slate-500">Gesamt</p>
                <p className="mt-0.5 text-lg font-bold text-white">{agents.length}</p>
              </div>
              <div>
                <p className="text-slate-500">Verfügbar</p>
                <p className="mt-0.5 text-lg font-bold text-emerald-400">{available}</p>
              </div>
              {busy > 0 && (
                <div>
                  <p className="text-slate-500">Beschäftigt</p>
                  <p className="mt-0.5 text-lg font-bold text-amber-400">{busy}</p>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 border-b border-slate-800 pb-0">
          {([
            { id: 'control-plane', label: 'Control Plane' },
            { id: 'performance',   label: 'Performance' },
            { id: 'orchestrate',   label: 'Orchestrierung' },
          ] as { id: Tab; label: string }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cx(
                'rounded-t-lg border-b-2 px-4 py-2 text-xs font-medium transition-colors -mb-px',
                tab === t.id
                  ? 'border-sky-500 text-sky-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'control-plane' && (
          <>
            <CoordinationOverview summary={summary} />

            {!loading && agents.length > 0 && (
              <div className="mb-6 flex flex-wrap gap-1">
                <button
                  onClick={() => setRoleFilter('')}
                  className={cx('rounded-lg px-3 py-1.5 text-xs font-medium transition-colors', roleFilter === '' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300')}
                >
                  Alle
                </button>
                {Array.from(new Set(agents.map(a => a.role))).map(role => (
                  <button
                    key={role}
                    onClick={() => setRoleFilter(role)}
                    className={cx('rounded-lg px-3 py-1.5 text-xs font-medium transition-colors', roleFilter === role ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300')}
                  >
                    {ROLE_LABEL[role]}
                  </button>
                ))}
              </div>
            )}

            {loading ? (
              <p className="py-8 text-center text-sm text-slate-500">Lade Agenten…</p>
            ) : agents.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="flex gap-6">
                <div className={cx('flex-1 grid gap-3', selected ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4')}>
                  {(roleFilter ? filtered : sections.flatMap(sec => filtered.filter(a => ROLE_SECTION[a.role] === sec))).map(agent => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      isSelected={selected?.id === agent.id}
                      onClick={() => setSelected(prev => prev?.id === agent.id ? null : agent)}
                    />
                  ))}
                </div>
                {selected && (
                  <AgentDetailPanel agent={selected} onClose={() => setSelected(null)} />
                )}
              </div>
            )}
          </>
        )}

        {tab === 'performance' && <PerformanceTab />}
        {tab === 'orchestrate' && <OrchestrateTab />}
      </div>
    </main>
  )
}

// ─── AgentCard ────────────────────────────────────────────────────────────────

function AgentCard({
  agent,
  isSelected,
  onClick,
}: {
  agent: AgentProfile
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'group w-full rounded-xl border p-4 text-left transition-all',
        isSelected
          ? 'border-sky-600/60 bg-sky-900/10 shadow-sm shadow-sky-900/20'
          : agent.availability === 'available'
          ? 'border-slate-800 bg-slate-900 hover:border-slate-700 hover:bg-slate-800/60'
          : 'border-slate-800/60 bg-slate-900/40 opacity-70 hover:opacity-100'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className={cx(
            'grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-bold',
            isSelected ? 'bg-sky-600/20 text-sky-300' : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-slate-300'
          )}>
            {ROLE_ICON[agent.role]}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{agent.displayName}</p>
            <p className="mt-0.5 text-xs text-slate-500">{ROLE_LABEL[agent.role]}</p>
          </div>
        </div>
        <StatusDot tone={AVAIL_TONE[agent.availability]} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className={cx('rounded border px-1.5 py-0.5 text-xs', AUTONOMY_COLOR[agent.autonomyLevel])}>
          {AUTONOMY_LABEL[agent.autonomyLevel]}
        </span>
        <span className={cx('text-xs', COST_COLOR[agent.costClass])}>
          {COST_LABEL[agent.costClass]}
        </span>
      </div>

      {agent.strengths.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {agent.strengths.slice(0, 3).map(s => (
            <Badge key={s}>{s}</Badge>
          ))}
          {agent.strengths.length > 3 && (
            <span className="text-xs text-slate-600">+{agent.strengths.length - 3}</span>
          )}
        </div>
      )}
    </button>
  )
}

// ─── AgentDetailPanel ────────────────────────────────────────────────────────

function AgentDetailPanel({
  agent,
  onClose,
}: {
  agent: AgentProfile
  onClose: () => void
}) {
  return (
    <aside className="w-80 shrink-0 rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-800 text-sm font-bold text-slate-300">
            {ROLE_ICON[agent.role]}
          </span>
          <div>
            <p className="text-sm font-semibold text-white">{agent.displayName}</p>
            <p className="text-xs text-slate-500">{ROLE_LABEL[agent.role]}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-xs text-slate-600 hover:text-slate-400">✕</button>
      </div>

      {/* Status row */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
          <p className="text-xs text-slate-500">Status</p>
          <p className={cx('mt-0.5 text-sm font-semibold', AVAIL_COLOR[agent.availability])}>
            {AVAIL_LABEL[agent.availability]}
          </p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
          <p className="text-xs text-slate-500">Autonomie</p>
          <p className={cx('mt-0.5 text-sm font-semibold', AUTONOMY_COLOR[agent.autonomyLevel].split(' ')[0])}>
            {AUTONOMY_LABEL[agent.autonomyLevel]}
          </p>
        </div>
        <div className="col-span-2 rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
          <p className="text-xs text-slate-500">Kosten</p>
          <p className={cx('mt-0.5 text-sm font-semibold', COST_COLOR[agent.costClass])}>
            {COST_LABEL[agent.costClass]}
          </p>
        </div>
      </div>

      {/* Strengths */}
      {agent.strengths.length > 0 && (
        <Section title="Stärken">
          <div className="flex flex-wrap gap-1">
            {agent.strengths.map(s => <Badge key={s}>{s}</Badge>)}
          </div>
        </Section>
      )}

      {/* Workloads */}
      {agent.preferredWorkloads.length > 0 && (
        <Section title="Workloads">
          <div className="flex flex-wrap gap-1">
            {agent.preferredWorkloads.map(w => (
              <span key={w} className="rounded border border-sky-900/40 bg-sky-900/10 px-1.5 py-0.5 text-xs text-sky-400">
                {w}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Limits */}
      {agent.limits.length > 0 && (
        <Section title="Grenzen">
          <ul className="space-y-1">
            {agent.limits.map(l => (
              <li key={l} className="flex items-start gap-1.5 text-xs text-slate-500">
                <span className="mt-0.5 shrink-0 text-red-500/60">✗</span>
                {l}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Tools */}
      {agent.allowedToolIds.length > 0 && (
        <Section title="Erlaubte Tools">
          <div className="flex flex-wrap gap-1">
            {agent.allowedToolIds.map(t => (
              <span key={t} className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-slate-400">
                {t}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Skills */}
      {agent.skillRefs.length > 0 && (
        <Section title="Skills">
          <ul className="space-y-1.5">
            {agent.skillRefs.map(s => (
              <li key={s.id} className="text-xs text-slate-400">
                <span className="font-medium text-slate-300">{s.title}</span>
                <span className="ml-2 font-mono text-slate-600">{s.path}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Model */}
      {agent.defaultModelProfileId && (
        <Section title="Default Model">
          <span className="font-mono text-xs text-slate-400">{agent.defaultModelProfileId}</span>
        </Section>
      )}

      <div className="mt-4 border-t border-slate-800 pt-3">
        <Link
          href={`/agent-runs?agentId=${agent.id}`}
          className="text-xs font-medium text-sky-400 hover:underline"
        >
          Agent Runs ansehen →
        </Link>
      </div>
    </aside>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</p>
      {children}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
      <p className="text-sm font-medium text-white">Keine Agentenprofile</p>
      <p className="mt-1 text-xs text-slate-500">
        Registry läuft über <code className="text-sky-400">/api/agents</code> — Standard-Profile werden beim ersten Aufruf geladen.
      </p>
    </div>
  )
}

function CoordinationOverview({ summary }: { summary: AgentControlPlaneSummary | null }) {
  if (!summary) {
    return (
      <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-5">
        <p className="text-sm font-semibold text-white">Parallel Work Control</p>
        <p className="mt-1 text-xs text-slate-500">Koordinationsdaten werden geladen.</p>
      </div>
    )
  }

  const tone = summary.coordination.canStartMoreWork ? 'text-emerald-400' : 'text-amber-400'
  const healthTone = summary.pm.overallHealth === 'green'
    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
    : summary.pm.overallHealth === 'red'
    ? 'text-rose-400 border-rose-500/30 bg-rose-500/10'
    : summary.pm.overallHealth === 'yellow'
    ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
    : 'text-slate-400 border-slate-700 bg-slate-800/50'

  return (
    <section className="mb-6 min-w-0 space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Parallel Work Control</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Schwarmfaehigkeit und Write-Scopes</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Diese Sicht zeigt, wie viele Agenten gerade sicher parallel arbeiten koennen, welche Aufgaben als naechstes passen
            und ob kaputte Delegationen zuerst reviewt werden muessen.
          </p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3 text-right">
          <p className="text-xs text-slate-500">Freie Parallel-Slots</p>
          <p className={cx('mt-1 text-3xl font-semibold tabular-nums', tone)}>
            {summary.coordination.recommendedParallelSlots}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-violet-900/40 bg-violet-950/10 p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-300">PM Agent Steering</p>
            <p className="mt-1 text-sm font-semibold text-white">
              {summary.pm.hasPlan ? 'Projektleiter-Kontext aktiv' : 'Noch kein PM-Plan vorhanden'}
            </p>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-400">
              {summary.pm.summary ?? 'Starte den PM Agenten, damit Fortschritt, Blocker, Prioritaeten und naechste Delegationen zentral bewertet werden.'}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span className={cx('rounded-full border px-2 py-1 text-xs font-semibold', healthTone)}>
              {summary.pm.overallHealth ? `Health ${summary.pm.overallHealth}` : 'kein Plan'}
            </span>
            {summary.pm.stale && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-300">
                stale
              </span>
            )}
            <Link
              href="/pm-agent"
              className="rounded-lg border border-violet-700/60 bg-violet-600/15 px-3 py-1.5 text-xs font-semibold text-violet-200 transition-colors hover:bg-violet-600/25"
            >
              PM Agent oeffnen
            </Link>
          </div>
        </div>

        <div className="grid min-w-0 gap-3 lg:grid-cols-3">
          <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <p className="mb-2 text-xs font-semibold text-slate-300">Blocker</p>
            {summary.pm.blockers.length === 0 ? (
              <p className="text-xs text-slate-500">Keine PM-Blocker im aktuellen Plan.</p>
            ) : (
              <ul className="space-y-1.5">
                {summary.pm.blockers.slice(0, 3).map(blocker => (
                  <li key={blocker} className="truncate text-xs text-amber-300">{blocker}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <p className="mb-2 text-xs font-semibold text-slate-300">Handlungsempfehlungen</p>
            {summary.pm.recommendations.length === 0 ? (
              <p className="text-xs text-slate-500">Noch keine PM-Empfehlungen vorhanden.</p>
            ) : (
              <ul className="space-y-1.5">
                {summary.pm.recommendations.slice(0, 3).map(recommendation => (
                  <li key={recommendation} className="truncate text-xs text-slate-400">{recommendation}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <p className="mb-2 text-xs font-semibold text-slate-300">PM empfiehlt als naechstes</p>
            {summary.pm.nextDelegations.length === 0 ? (
              <p className="text-xs text-slate-500">Keine PM-Delegation freigegeben.</p>
            ) : (
              <ul className="space-y-1.5">
                {summary.pm.nextDelegations.slice(0, 3).map(item => (
                  <li key={`${item.workPackageId}-${item.title}`} className="truncate text-xs text-emerald-300">
                    {item.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {summary.coordination.blockedReason && (
        <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-300">
          {summary.coordination.blockedReason}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CoordinationMetric label="Approved Queue" value={summary.queue.approved} detail={`${summary.queue.pending} pending`} />
        <CoordinationMetric label="Aktive Write-Scopes" value={summary.scopes.active} detail={`${summary.queue.running} running`} />
        <CoordinationMetric label="Lokale Agenten" value={summary.agents.local} detail="local first" />
        <CoordinationMetric label="Cloud / Abo" value={summary.agents.cloudOrSubscription} detail="fuer komplexe Tasks" />
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Naechste sinnvolle Delegationen</p>
            <span className="text-xs text-slate-600">{summary.nextDelegations.length} Vorschlaege</span>
          </div>
          {summary.nextDelegations.length === 0 ? (
            <p className="text-xs text-slate-500">Keine freigegebenen Delegationen in der Queue.</p>
          ) : (
            <div className="space-y-2">
              {summary.nextDelegations.slice(0, 3).map(item => (
                <div key={item.delegationId} className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-white">{item.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{item.reason}</p>
                    </div>
                    <span className="rounded border border-sky-900/50 px-1.5 py-0.5 text-xs text-sky-300">
                      {item.suggestedAgentName ?? 'offen'}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge>{item.skillCategory}</Badge>
                    <Badge>Risk {item.riskClass}</Badge>
                    <Badge>Prio {item.priority}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Aktive Scopes</p>
            <span className="text-xs text-slate-600">Lease-basiert</span>
          </div>
          {summary.scopes.claims.length === 0 ? (
            <p className="text-xs text-slate-500">Derzeit haelt kein Agent einen Write-Scope.</p>
          ) : (
            <div className="space-y-2">
              {summary.scopes.claims.slice(0, 4).map(claim => (
                <div key={`${claim.agentId}-${claim.claimedAt}`} className="min-w-0 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
                  <p className="truncate text-xs font-semibold text-white">{claim.agentId}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{claim.milestone} · {claim.branch}</p>
                  <p className="mt-1 truncate font-mono text-xs text-slate-600">{claim.filePatterns.join(', ')}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function CoordinationMetric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{value}</p>
      <p className="mt-0.5 text-xs text-slate-600">{detail}</p>
    </div>
  )
}

// ─── Performance Tab ──────────────────────────────────────────────────────────

const TREND_ICON = { improving: '↑', stable: '→', declining: '↓' } as const
const TREND_COLOR = { improving: 'text-emerald-400', stable: 'text-slate-400', declining: 'text-red-400' } as const
const GRADE_COLOR = { A: 'text-emerald-400', B: 'text-sky-400', C: 'text-amber-400', D: 'text-orange-400', F: 'text-red-400' } as const
void GRADE_COLOR

function Sparkline({ scores }: { scores: number[] }) {
  if (scores.length < 2) return null
  const h = 24
  const w = scores.length * 10
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  const range = max - min || 1
  const pts = scores
    .map((v, i) => `${i * 10},${h - Math.round(((v - min) / range) * h)}`)
    .join(' ')
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" strokeWidth="1.5" className="stroke-sky-500/70" />
    </svg>
  )
}

function PerformanceTab() {
  const [summaries, setSummaries] = useState<SkillPerformanceSummary[]>([])
  const [warnings, setWarnings] = useState<{ agentType: string; skillCategory: string; message: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [applying, setApplying] = useState(false)
  const [applyResult, setApplyResult] = useState<{ applied: number; skipped: number } | null>(null)

  useEffect(() => {
    fetch('/api/agents/performance')
      .then(r => r.json())
      .then((d: { summaries: SkillPerformanceSummary[]; warnings: typeof warnings }) => {
        setSummaries(d.summaries ?? [])
        setWarnings(d.warnings ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleApply = async () => {
    setApplying(true)
    try {
      const res = await fetch('/api/agents/apply-recommendations', { method: 'POST' })
      const data = await res.json() as { applied: number; skipped: number }
      setApplyResult(data)
    } finally {
      setApplying(false)
    }
  }

  if (loading) return <p className="py-8 text-center text-sm text-slate-500">Lade Performance-Daten…</p>

  if (summaries.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
        <p className="text-sm font-medium text-white">Noch keine Performance-Daten</p>
        <p className="mt-1 text-xs text-slate-500">
          Nach dem ersten Delegations-Lauf erscheinen hier Skill-Konfidenz und Trends automatisch.
        </p>
      </div>
    )
  }

  const totalTasks = summaries.reduce((a, s) => a + s.taskCount, 0)
  const improving = summaries.filter(s => s.trend === 'improving').length
  const declining = summaries.filter(s => s.trend === 'declining').length
  const avgScore = Math.round(summaries.reduce((a, s) => a + s.averageScore, 0) / summaries.length)

  const agents = Array.from(new Set(summaries.map(s => s.agentType)))
  const visible = filter === 'all' ? summaries : summaries.filter(s => s.agentType === filter)

  const byAgent: Record<string, SkillPerformanceSummary[]> = {}
  for (const s of visible) {
    byAgent[s.agentType] = byAgent[s.agentType] ?? []
    byAgent[s.agentType].push(s)
  }

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Tasks tracked', value: totalTasks, color: 'text-white' },
          { label: 'Ø Quality Score', value: avgScore, color: avgScore >= 80 ? 'text-emerald-400' : avgScore >= 60 ? 'text-amber-400' : 'text-red-400' },
          { label: 'Improving', value: improving, color: 'text-emerald-400' },
          { label: 'Declining', value: declining, color: declining > 0 ? 'text-red-400' : 'text-slate-500' },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3">
            <p className="text-xs text-slate-500">{kpi.label}</p>
            <p className={cx('mt-0.5 text-2xl font-bold tabular-nums', kpi.color)}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Apply Recommendations action row */}
      <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-4 py-2.5">
        <div>
          <p className="text-xs font-medium text-slate-300">Skill-Konfidenz aktualisieren</p>
          <p className="text-xs text-slate-500 mt-0.5">Übernimmt Empfehlungen aus beobachteten Outcomes in das Agent-Profil</p>
        </div>
        <div className="flex items-center gap-3">
          {applyResult && (
            <span className="text-xs text-emerald-400">
              ✓ {applyResult.applied} angewendet, {applyResult.skipped} übersprungen
            </span>
          )}
          <button
            onClick={() => { void handleApply() }}
            disabled={applying}
            className="rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-600 disabled:opacity-50 transition-colors"
          >
            {applying ? 'Wird angewendet…' : 'Empfehlungen anwenden'}
          </button>
        </div>
      </div>

      {/* Drift warnings — prominent */}
      {warnings.length > 0 && (
        <div className="rounded-xl border border-red-800/50 bg-red-950/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
            <p className="text-xs font-semibold uppercase tracking-wide text-red-400">
              {warnings.length} Drift-Warnung{warnings.length > 1 ? 'en' : ''} erkannt
            </p>
          </div>
          <div className="space-y-2">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg bg-red-950/30 px-3 py-2">
                <span className="mt-0.5 shrink-0 text-red-400">⚠</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-red-300 capitalize">
                    {w.agentType} · {w.skillCategory.replace(/-/g, ' ')}
                  </p>
                  <p className="text-xs text-red-400/80 mt-0.5">{w.message}</p>
                </div>
                <span className="shrink-0 text-xs text-red-500 font-medium">Review →</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {warnings.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-900/30 bg-emerald-950/10 px-4 py-2.5">
          <span className="text-emerald-400">✓</span>
          <p className="text-xs text-emerald-400">Alle Agenten stabil — kein Agentic Drift erkannt</p>
        </div>
      )}

      {/* Agent filter */}
      <div className="flex flex-wrap gap-2">
        {['all', ...agents].map(a => (
          <button
            key={a}
            onClick={() => setFilter(a)}
            className={cx(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              filter === a
                ? 'bg-violet-700 text-white'
                : 'border border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300',
            )}
          >
            {a === 'all' ? 'Alle Agenten' : a}
          </button>
        ))}
      </div>

      {/* Skills per agent */}
      {Object.entries(byAgent).map(([agentType, skills]) => (
        <div key={agentType} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-white capitalize">{agentType}</p>
            <span className="text-xs text-slate-500">{skills.length} skills · {skills.reduce((a, s) => a + s.taskCount, 0)} tasks</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {skills.map(s => {
              const isDeclining = s.trend === 'declining'
              const delta = s.recommendedConfidence - s.currentConfidence
              return (
                <div key={s.skillCategory} className={cx(
                  'rounded-lg border p-3 transition-colors',
                  isDeclining ? 'border-red-900/40 bg-red-950/10' : 'border-slate-800 bg-slate-950/60',
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-slate-300 capitalize">{s.skillCategory.replace(/-/g, ' ')}</p>
                    <span className={cx('text-xs font-bold', TREND_COLOR[s.trend])}>
                      {TREND_ICON[s.trend]}
                    </span>
                  </div>

                  {/* Sparkline */}
                  <div className="flex items-end justify-between mb-2">
                    <div>
                      <p className="text-xs text-slate-500">Ø Score</p>
                      <p className={cx('text-xl font-bold tabular-nums', s.averageScore >= 90 ? 'text-emerald-400' : s.averageScore >= 75 ? 'text-sky-400' : s.averageScore >= 60 ? 'text-amber-400' : 'text-red-400')}>
                        {s.averageScore}
                      </p>
                    </div>
                    <Sparkline scores={s.recentScores} />
                  </div>

                  {/* Confidence delta */}
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-500">Konfidenz</span>
                    <span className={cx('font-semibold', delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-slate-400')}>
                      {s.currentConfidence}% → {s.recommendedConfidence}%
                      {delta !== 0 && <span className="ml-1">({delta > 0 ? '+' : ''}{delta})</span>}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800">
                    <div
                      className={cx('h-1.5 rounded-full transition-all', isDeclining ? 'bg-red-500' : 'bg-sky-500')}
                      style={{ width: `${s.recommendedConfidence}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-right text-xs text-slate-600">{s.taskCount} tasks</p>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Orchestrate Tab ──────────────────────────────────────────────────────────

function OrchestrateTab() {
  const [runs, setRuns] = useState<OrchestratedRun[]>([])
  const [loading, setLoading] = useState(true)
  const [goal, setGoal] = useState('')
  const [context, setContext] = useState('')
  const [creating, setCreating] = useState(false)
  const [executing, setExecuting] = useState<string | null>(null)
  const [preview, setPreview] = useState<OrchestratedRun | null>(null)

  useEffect(() => {
    fetch('/api/agents/orchestrate')
      .then(r => r.json())
      .then((d: { runs: OrchestratedRun[] }) => {
        setRuns(d.runs ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleCreate = async () => {
    if (!goal.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/agents/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delegationId: `manual-${Date.now()}`, delegationTitle: goal, goal, context }),
      })
      const data = await res.json() as { run: OrchestratedRun }
      setRuns(prev => [data.run, ...prev])
      setPreview(data.run)
      setGoal('')
      setContext('')
    } finally {
      setCreating(false)
    }
  }

  const handleExecuteRun = async (runId: string) => {
    setExecuting(runId)
    try {
      await fetch(`/api/agents/orchestrate/${runId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      // Refresh run list after a moment
      setTimeout(async () => {
        const res = await fetch('/api/agents/orchestrate')
        const d = await res.json() as { runs: OrchestratedRun[] }
        setRuns(d.runs ?? [])
        setExecuting(null)
      }, 2000)
    } catch {
      setExecuting(null)
    }
  }

  const STATUS_COLOR: Record<string, string> = {
    planning: 'text-slate-400',
    running: 'text-sky-400',
    done: 'text-emerald-400',
    failed: 'text-red-400',
    aborted: 'text-orange-400',
  }

  const TASK_STATUS_COLOR: Record<string, string> = {
    pending: 'bg-slate-700',
    assigned: 'bg-sky-800',
    running: 'bg-sky-600',
    done: 'bg-emerald-700',
    failed: 'bg-red-800',
    skipped: 'bg-slate-800',
  }

  const EFFORT_LABEL = { S: '~15min', M: '~45min', L: '~2h' }

  return (
    <div className="space-y-6">
      {/* New run form */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <p className="mb-4 text-sm font-semibold text-white">Task dekompilieren &amp; orchestrieren</p>
        <p className="mb-4 text-xs text-slate-500">
          Gib ein Ziel ein — der Orchestrator zerlegt es in atomare Sub-Tasks und weist jeden dem besten Agenten zu.
          Kleine Tasks = weniger Drift, zuverlässigere Ergebnisse.
        </p>
        <div className="space-y-3">
          <input
            type="text"
            value={goal}
            onChange={e => setGoal(e.target.value)}
            placeholder="z.B. Build API route for knowledge export with tests"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-sky-600 focus:outline-none"
          />
          <textarea
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="Kontext (optional): z.B. aktueller Code-Stand, Abhängigkeiten, Constraints…"
            rows={2}
            className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-sky-600 focus:outline-none"
          />
          <button
            onClick={handleCreate}
            disabled={!goal.trim() || creating}
            className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-500 disabled:opacity-40"
          >
            {creating ? 'Zerlege…' : 'Jetzt orchestrieren'}
          </button>
        </div>
      </div>

      {/* Preview of last created run */}
      {preview && (
        <div className="rounded-xl border border-sky-800/40 bg-sky-950/20 p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Sub-Tasks für: <span className="text-sky-400">{preview.goal}</span></p>
            <button onClick={() => setPreview(null)} className="text-xs text-slate-600 hover:text-slate-400">✕</button>
          </div>
          <div className="space-y-2">
            {preview.tasks.map((entry, i) => (
              <div key={entry.task.id} className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900 p-3">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded bg-slate-700 text-xs font-bold text-slate-400">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white">{entry.task.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500 truncate">{entry.task.description}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <span className="rounded border border-slate-700 px-1.5 py-0.5 text-xs text-slate-400 capitalize">
                      {entry.task.skillCategory.replace(/-/g, ' ')}
                    </span>
                    <span className="rounded border border-sky-900/40 px-1.5 py-0.5 text-xs text-sky-400">
                      {entry.agentType}
                    </span>
                    <span className="text-xs text-slate-600">{EFFORT_LABEL[entry.task.effort]}</span>
                  </div>
                </div>
                <span className={cx('mt-1 h-2 w-2 shrink-0 rounded-full', TASK_STATUS_COLOR[entry.status])} />
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-slate-600">
              Klare Acceptance Criteria pro Task → weniger Drift, zuverlässigere Ergebnisse
            </p>
            <button
              onClick={() => handleExecuteRun(preview.id)}
              disabled={executing === preview.id || preview.status === 'running'}
              className="rounded-lg bg-violet-700 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-600 disabled:opacity-40"
            >
              {executing === preview.id ? 'Startet…' : preview.status === 'running' ? 'Läuft…' : '▶ Alle Tasks ausführen'}
            </button>
          </div>
        </div>
      )}

      {/* Run history */}
      {!loading && runs.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <p className="mb-4 text-sm font-semibold text-white">Orchestrierungs-Verlauf</p>
          <div className="space-y-2">
            {runs.slice(0, 10).map(run => (
              <div key={run.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-white">{run.delegationTitle}</p>
                  <p className="text-xs text-slate-600">{run.tasks.length} Tasks · {new Date(run.createdAt).toLocaleDateString('de-DE')}</p>
                </div>
                <div className="flex items-center gap-3">
                  {run.overallQualityScore !== undefined && (
                    <span className={cx('text-xs font-bold', run.overallQualityScore >= 90 ? 'text-emerald-400' : run.overallQualityScore >= 75 ? 'text-sky-400' : 'text-amber-400')}>
                      {run.overallQualityScore}pts
                    </span>
                  )}
                  <span className={cx('text-xs font-semibold capitalize', STATUS_COLOR[run.status])}>
                    {run.status}
                  </span>
                  {(run.status === 'planning' || run.status === 'failed') && (
                    <button
                      onClick={() => handleExecuteRun(run.id)}
                      disabled={executing === run.id}
                      className="rounded bg-violet-800/60 px-2 py-0.5 text-xs text-violet-300 hover:bg-violet-700/60 disabled:opacity-40"
                    >
                      {executing === run.id ? '…' : '▶'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
