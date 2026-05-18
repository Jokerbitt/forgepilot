import { ConnectorHealthBar } from '@/components/command-center/ConnectorHealthBar'
import { AutopilotRunner } from '@/components/command-center/AutopilotRunner'
import { NBAPanel } from '@/components/command-center/NBAPanel'
import { ActiveAgentsPanel } from '@/components/delegation/ActiveAgentsPanel'
import { DelegationQueueSummary } from '@/components/delegation/DelegationQueueSummary'
import { FailedDelegationsWidget } from '@/components/delegation/FailedDelegationsWidget'
import { DailyCostWidget } from '@/components/command-center/DailyCostWidget'
import { MagicCreate } from '@/components/command-center/MagicCreate'
import { OperatorReadinessPanel } from '@/components/command-center/OperatorReadinessPanel'
import { ApiKeysBanner } from '@/components/shared/ApiKeysBanner'
import { ProjectBriefsSummary } from '@/components/project-briefs/ProjectBriefsSummary'
import { LocalAIPanel } from '@/components/command-center/LocalAIPanel'
import { SystemOverviewWidget } from '@/components/command-center/SystemOverviewWidget'
import { buttonClassName } from '@/components/ui/primitives'

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <ConnectorHealthBar />
      <AutopilotRunner />
      <ApiKeysBanner />
      <div className="mx-auto max-w-5xl p-6">
        <header className="mb-8 mt-2 flex flex-col gap-4 border-b border-slate-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Operations</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Command Center</h1>
            <p className="mt-2 text-sm text-gray-400">Next Best Actions, Agentenstatus, Kosten und Systemsignale in einer Arbeitsansicht.</p>
          </div>
          <div className="flex flex-shrink-0 flex-col gap-2 sm:flex-row">
            <a
              href="/project-briefs"
              className={buttonClassName('secondary')}
            >
              Neue Idee
            </a>
            <a
              href="/delegations?new=1"
              className={buttonClassName('primary')}
            >
              Neue Delegation
            </a>
          </div>
        </header>

        <SystemOverviewWidget />
        <MagicCreate />
        <OperatorReadinessPanel />
        <LocalAIPanel />
        <ProjectBriefsSummary />
        <ActiveAgentsPanel />
        <DelegationQueueSummary />
        <FailedDelegationsWidget />
        <DailyCostWidget />
        <NBAPanel />
      </div>
    </main>
  )
}
