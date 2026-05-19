import Link from 'next/link'
import { readProjectBriefs } from '@/lib/project-briefs'
import type { ProjectBrief } from '@/lib/models/project-brief'
import { buildProjectBriefsWorkspaceViewModel, type WorkspaceBrief } from '@/lib/project-briefs-workspace'
import { readMilestones } from '@/lib/knowledge/milestone-store'
import {
  Badge,
  DecisionCallout,
  EmptyState,
  Metric,
  Panel,
  RiskIndicator,
  Toolbar,
  buttonClassName,
  cx,
} from '@/components/ui/primitives'
import { TemplatePicker } from '@/components/project-briefs/TemplatePicker'

export const dynamic = 'force-dynamic'

const STATUS_TONES: Record<ProjectBrief['status'], 'neutral' | 'warning' | 'success'> = {
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

export default function ProjectBriefsPage() {
  const briefs = readProjectBriefs()
  const viewModel = buildProjectBriefsWorkspaceViewModel(briefs)
  const allMilestones = readMilestones()
  const milestonesPerBrief = allMilestones.reduce<Record<string, number>>((acc, m) => {
    acc[m.briefId] = (acc[m.briefId] ?? 0) + 1
    return acc
  }, {})

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 border-b border-slate-800 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Project Blueprint</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Project Briefs Workspace</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Ideen werden hier zu pruefbaren Projektbriefs, Requirements, Risiken und delegierbaren Arbeitspaketen verdichtet.
            </p>
          </div>
          <Link href="/project-briefs/new" className={buttonClassName('primary', 'w-full sm:w-auto')}>
            Neue Idee erfassen
          </Link>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Aktive Briefs" value={viewModel.metrics.active} detail="nicht archiviert" tone="info" />
          <Metric label="In Review" value={viewModel.metrics.reviewCount} detail="brauchen Entscheidung" tone={viewModel.metrics.reviewCount > 0 ? 'warning' : 'neutral'} />
          <Metric label="Freigegeben" value={viewModel.metrics.acceptedCount} detail="bereit fuer Umsetzung" tone="success" />
          <Metric label="Delegiert" value={viewModel.metrics.delegatedCount} detail="mit Agentenbezug" tone="privacy" />
          <Metric label="Risikosignale" value={viewModel.metrics.openRiskCount} detail="offen oder hoch" tone={viewModel.metrics.openRiskCount > 0 ? 'danger' : 'neutral'} />
        </section>

        {viewModel.nextAction && (
          <div className="mb-6">
            <DecisionCallout
              label="Next Best Action"
              title={viewModel.nextAction.title}
              description={viewModel.nextAction.description}
              tone="info"
              action={(
                <Link href={viewModel.nextAction.href} className={buttonClassName('secondary')}>
                  Brief oeffnen
                </Link>
              )}
            />
          </div>
        )}

        <div className="mb-6">
          <TemplatePicker />
        </div>

        {briefs.length === 0 ? (
          <EmptyState
            title="Noch keine Projektbriefs"
            description="Starte mit einer Idee oder wähle ein Template oben. ForgePilot fuehrt sie danach in Requirements, Risiken, Research und konkrete Arbeitspakete."
            action={(
              <Link href="/project-briefs/new" className={buttonClassName('primary')}>
                Erste Idee erfassen
              </Link>
            )}
          />
        ) : (
          <Panel>
            <Toolbar>
              <div>
                <h2 className="text-sm font-semibold text-white">Aktive Projektbriefs</h2>
                <p className="mt-1 text-xs text-slate-500">Sortiert nach Aktualitaet, mit Readiness, Risiko und naechster Aktion.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="info">{viewModel.metrics.active} aktiv</Badge>
                {viewModel.metrics.reviewCount > 0 && <Badge tone="warning">{viewModel.metrics.reviewCount} in Review</Badge>}
                {viewModel.metrics.openRiskCount > 0 && <Badge tone="danger">{viewModel.metrics.openRiskCount} Risiko</Badge>}
              </div>
            </Toolbar>

            <div className="divide-y divide-slate-800">
              {viewModel.active.map(brief => (
                <BriefRow key={brief.id} brief={brief} milestoneCount={milestonesPerBrief[brief.id] ?? 0} />
              ))}
            </div>

            {viewModel.archived.length > 0 && (
              <div className="border-t border-slate-800">
                <div className="px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Archiviert ({viewModel.archived.length})</p>
                </div>
                <div className="divide-y divide-slate-800">
                  {viewModel.archived.map(brief => (
                    <BriefRow key={brief.id} brief={brief} milestoneCount={milestonesPerBrief[brief.id] ?? 0} />
                  ))}
                </div>
              </div>
            )}
          </Panel>
        )}
      </div>
    </main>
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
        <p className="mt-2 text-sm font-semibold text-white">
          {brief.totalRequirements > 0 ? `${brief.acceptedRequirements}/${brief.totalRequirements}` : 'Noch offen'}
        </p>
        <p className="mt-1 text-xs text-slate-500">akzeptiert</p>
      </div>

      <div className="lg:text-right">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Naechste Aktion</p>
        <p className="mt-2 text-sm font-medium text-slate-200">{brief.nextAction}</p>
        <p className="mt-1 text-xs text-slate-500">{brief.updatedAtLabel}</p>
      </div>
    </Link>
  )
}
