import { ConnectorHealthBar } from '@/components/command-center/ConnectorHealthBar'
import { NBAPanel } from '@/components/command-center/NBAPanel'
import { ActiveAgentsPanel } from '@/components/delegation/ActiveAgentsPanel'
import { MagicCreate } from '@/components/command-center/MagicCreate'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <ConnectorHealthBar />
      <div className="max-w-4xl mx-auto p-6">
        <header className="mb-8 mt-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">ForgePilot</h1>
            <p className="text-gray-400 mt-1 text-sm">AI Workflow OS — Command Center</p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/delegations"
              className="text-sm text-gray-400 hover:text-white flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg transition-colors border border-gray-700"
            >
              <span>📋</span>
              <span>Delegationen</span>
            </a>
            <a
              href="/settings"
              className="text-sm text-gray-400 hover:text-white flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg transition-colors border border-gray-700"
            >
              <span>⚙️</span>
              <span>Einstellungen</span>
            </a>
          </div>
        </header>

        <MagicCreate />
        <ActiveAgentsPanel />
        <NBAPanel />
      </div>
    </main>
  )
}
