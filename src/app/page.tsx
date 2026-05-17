import { ConnectorHealthBar } from '@/components/command-center/ConnectorHealthBar'
import { NBAPanel } from '@/components/command-center/NBAPanel'
import { ActiveAgentsPanel } from '@/components/delegation/ActiveAgentsPanel'
import { DelegationQueueSummary } from '@/components/delegation/DelegationQueueSummary'
import { FailedDelegationsWidget } from '@/components/delegation/FailedDelegationsWidget'
import { DailyCostWidget } from '@/components/command-center/DailyCostWidget'
import { MagicCreate } from '@/components/command-center/MagicCreate'
import { ApiKeysBanner } from '@/components/shared/ApiKeysBanner'
import { ProjectBriefsSummary } from '@/components/project-briefs/ProjectBriefsSummary'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <ConnectorHealthBar />
      <ApiKeysBanner />
      <div className="mx-auto max-w-4xl p-6">
        <header className="mb-8 mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Command Center</h1>
            <p className="mt-1 text-sm text-gray-400">AI Workflow OS - Next Best Actions</p>
          </div>
          <div className="flex flex-shrink-0 gap-2">
            <a
              href="/project-briefs"
              className="mt-1 flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-500"
            >
              <span>◇</span>
              <span className="hidden sm:block">Neue Idee</span>
            </a>
            <a
              href="/delegations?new=1"
              className="mt-1 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
            >
              <span>⚡</span>
              <span className="hidden sm:block">Neue Delegation</span>
            </a>
          </div>
        </header>

        <MagicCreate />
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
