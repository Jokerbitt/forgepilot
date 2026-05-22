'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { WorkspaceBrief } from '@/lib/project-briefs-workspace'
import {
  Badge,
  Panel,
  RiskIndicator,
  Toolbar,
  cx,
} from '@/components/ui/primitives'

const STATUS_TONES: Record<WorkspaceBrief['status'], 'neutral' | 'warning' | 'success'> = {
  draft: 'neutral',
  in_review: 'warning',
  accepted: 'success',
  archived: 'neutral',
}

const RISK_LABELS: Record<WorkspaceBrief['riskLevel'], string> = {
  low: 'niedrig',
  medium: 'mittel',
  high: 'hoch',
  critical: 'kritisch',
}

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'Alle' },
  { value: 'draft', label: 'Entwurf' },
  { value: 'in_review', label: 'In Review' },
  { value: 'accepted', label: 'Freigegeben' },
  { value: 'archived', label: 'Archiviert' },
]

interface Props {
  active: WorkspaceBrief[]
  archived: WorkspaceBrief[]
  milestonesPerBrief: Record<string, number>
  metrics: { active: number; reviewCount: number; openRiskCount: number }
}

export function BriefListClient({ active, archived, milestonesPerBrief, metrics }: Props) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const allBriefs = useMemo(() => [...active, ...archived], [active, archived])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return allBriefs.filter(brief => {
      const matchStatus = statusFilter === 'all' || brief.status === statusFilter
      const matchQuery = !q ||
        brief.title.toLowerCase().includes(q) ||
        brief.problemStatement.toLowerCase().includes(q) ||
        brief.nextAction.toLowerCase().includes(q)
      return matchStatus && matchQuery
    })
  }, [allBriefs, query, statusFilter])

  const filteredActive = filtered.filter(b => b.status !== 'archived')
  const filteredArchived = filtered.filter(b => b.status === 'archived')

  return (
    <Panel>
      <Toolbar>
        <div>
          <h2 className="text-sm font-semibold text-white">Aktive Projektbriefs</h2>
          <p className="mt-1 text-xs text-slate-500">Sortiert nach Aktualitaet, mit Readiness, Risiko und naechster Aktion.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter chips */}
          <div className="flex gap-1 flex-wrap">
            {STATUS_FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                  statusFilter === opt.value
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {/* Search input */}
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Titel oder Beschreibung suchen…"
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 w-48 transition-colors"
          />
          {/* Counts */}
          <Badge tone="info">{metrics.active} aktiv</Badge>
          {metrics.reviewCount > 0 && <Badge tone="warning">{metrics.reviewCount} in Review</Badge>}
          {metrics.openRiskCount > 0 && <Badge tone="danger">{metrics.openRiskCount} Risiko</Badge>}
        </div>
      </Toolbar>

      {filtered.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-slate-500">
          Keine Projektbriefs für diese Suche gefunden.
        </div>
      ) : (
        <>
          <div className="divide-y divide-slate-800">
            {filteredActive.map(brief => (
              <BriefRow key={brief.id} brief={brief} milestoneCount={milestonesPerBrief[brief.id] ?? 0} />
            ))}
          </div>

          {filteredArchived.length > 0 && (
            <div className="border-t border-slate-800">
              <div className="px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Archiviert ({filteredArchived.length})</p>
              </div>
              <div className="divide-y divide-slate-800">
                {filteredArchived.map(brief => (
                  <BriefRow key={brief.id} brief={brief} milestoneCount={milestonesPerBrief[brief.id] ?? 0} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Panel>
  )
}

function BriefRow({ brief, milestoneCount }: { brief: WorkspaceBrief; milestoneCount: number }) {
  return (
    <Link
      href={`/project-briefs/${brief.id}`}
      className="grid gap-4 px-4 py-4 transition-colors hover:bg-slate-900/70 lg:grid-cols-[minmax(0,1.5fr)_140px_150px_180px] lg:items-center"
    >
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONES[brief.status]}>{brief.statusLabel}</Badge>
          <RiskIndicator level={brief.riskLevel} label={`Risiko ${RISK_LABELS[brief.riskLevel]}`} />
          {brief.delegationCount > 0 && <Badge tone="privacy">{brief.delegationCount} Delegationen</Badge>}
          {milestoneCount > 0 && (
            <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
              {milestoneCount} Meilenstein{milestoneCount === 1 ? '' : 'e'}
            </span>
          )}
        </div>
        <p className="truncate text-sm font-semibold text-white">{brief.title}</p>
        <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-400">{brief.problemStatement}</p>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Readiness</p>
        <div className="mt-2 h-2 rounded-full bg-slate-800">
          <div
            className={cx('h-2 rounded-full', brief.readiness >= 75 ? 'bg-emerald-400' : brief.readiness >= 45 ? 'bg-amber-400' : 'bg-sky-400')}
            style={{ width: `${brief.readiness}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-slate-500">{brief.readiness}% bereit</p>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Requirements</p>
        {brief.totalRequirements === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Noch offen</p>
        ) : brief.acceptedRequirements === brief.totalRequirements ? (
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-xs font-semibold text-emerald-400">
            ✓ {brief.acceptedRequirements}/{brief.totalRequirements} akzeptiert
          </span>
        ) : (brief.pendingRequirements ?? 0) > 0 ? (
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-xs font-semibold text-amber-400">
            ⏳ {brief.pendingRequirements} offen
          </span>
        ) : (
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 text-xs font-semibold text-sky-400">
            {brief.acceptedRequirements}/{brief.totalRequirements} akzeptiert
          </span>
        )}
      </div>

      <div className="lg:text-right">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Naechste Aktion</p>
        <p className="mt-2 text-sm font-medium text-slate-200">{brief.nextAction}</p>
        <p className="mt-1 text-xs text-slate-500">{brief.updatedAtLabel}</p>
      </div>
    </Link>
  )
}
