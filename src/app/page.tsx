import { ConnectorHealthBar } from '@/components/command-center/ConnectorHealthBar'
import { NBAPanel } from '@/components/command-center/NBAPanel'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <ConnectorHealthBar />
      <div className="max-w-4xl mx-auto p-6">
        <header className="mb-8 mt-4">
          <h1 className="text-3xl font-bold">ForgePilot Command Center</h1>
          <p className="text-gray-400 mt-2">Next Best Action Empfehlungen (M2)</p>
        </header>
        
        <NBAPanel />
      </div>
    </main>
  )
}
