import { ConnectorHealthBar } from '@/components/command-center/ConnectorHealthBar'
import { NBAPanel } from '@/components/command-center/NBAPanel'
import { ActiveAgentsPanel } from '@/components/delegation/ActiveAgentsPanel'
import { MagicCreate } from '@/components/command-center/MagicCreate'
import { ApiKeysBanner } from '@/components/shared/ApiKeysBanner'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <ConnectorHealthBar />
      <ApiKeysBanner />
      <div className="max-w-4xl mx-auto p-6">
        <header className="mb-8 mt-2">
          <h1 className="text-3xl font-bold">Command Center</h1>
          <p className="text-gray-400 mt-1 text-sm">AI Workflow OS — Next Best Actions</p>
        </header>

        <MagicCreate />
        <ActiveAgentsPanel />
        <NBAPanel />
      </div>
    </main>
  )
}
