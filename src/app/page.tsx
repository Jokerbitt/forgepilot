import { ConnectorHealthBar } from '@/components/command-center/ConnectorHealthBar'
import { NBAPanel } from '@/components/command-center/NBAPanel'
import { ActiveAgentsPanel } from '@/components/delegation/ActiveAgentsPanel'
import { DelegationQueueSummary } from '@/components/delegation/DelegationQueueSummary'
import { MagicCreate } from '@/components/command-center/MagicCreate'
import { ApiKeysBanner } from '@/components/shared/ApiKeysBanner'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <ConnectorHealthBar />
      <ApiKeysBanner />
      <div className="max-w-4xl mx-auto p-6">
        <header className="mb-8 mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Command Center</h1>
            <p className="text-gray-400 mt-1 text-sm">AI Workflow OS — Next Best Actions</p>
          </div>
          <a
            href="/delegations?new=1"
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors mt-1"
          >
            <span>⚡</span>
            <span className="hidden sm:block">Neue Delegation</span>
          </a>
        </header>

        <MagicCreate />
        <ActiveAgentsPanel />
        <DelegationQueueSummary />
        <NBAPanel />
      </div>
    </main>
  )
}
