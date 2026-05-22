import Link from 'next/link'
import { readProjectBriefs } from '@/lib/project-briefs'
import { buildProjectBriefsWorkspaceViewModel } from '@/lib/project-briefs-workspace'
import { readMilestones } from '@/lib/knowledge/milestone-store'
import {
  DecisionCallout,
  EmptyState,
  Metric,
  buttonClassName,
} from '@/components/ui/primitives'
import { TemplatePicker } from '@/components/project-briefs/TemplatePicker'
import { BriefListClient } from '@/components/project-briefs/BriefListClient'

export const dynamic = 'force-dynamic'

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
          <BriefListClient
            active={viewModel.active}
            archived={viewModel.archived}
            milestonesPerBrief={milestonesPerBrief}
            metrics={viewModel.metrics}
          />
        )}
      </div>
    </main>
  )
}
