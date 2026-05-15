import { ConnectorHealthBar } from '@/components/command-center/ConnectorHealthBar'
import { NBAPanel } from '@/components/command-center/NBAPanel'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="bg-blue-600 text-white text-center py-2 font-bold animate-pulse">
        🚀 LIVEDEMO AKTIV – Wenn du das siehst, bist du auf dem neuesten Stand! (Drücke F5, falls nicht)
      </div>
      <ConnectorHealthBar />
      <div className="max-w-4xl mx-auto p-6">
        <header className="mb-8 mt-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">ForgePilot Command Center</h1>
            <p className="text-gray-400 mt-2">Next Best Action Empfehlungen (M2)</p>
          </div>
          <a href="/settings" className="text-sm text-gray-400 hover:text-white flex items-center space-x-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg transition-colors border border-gray-700">
            <span>⚙️</span>
            <span>Einstellungen</span>
          </a>
        </header>
        
        <NBAPanel />
      </div>
    </main>
  )
}
