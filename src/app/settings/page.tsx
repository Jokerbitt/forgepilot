'use client'

import { useEffect, useState } from 'react'
import type { NBAConfig } from '@/lib/nba-engine/nba-config'

export default function SettingsPage() {
  const [config, setConfig] = useState<NBAConfig | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(setConfig)
  }, [])

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    })
    setSaving(false)
  }

  if (!config) return <div className="p-8 text-white">Lade Einstellungen...</div>

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="flex justify-between items-center border-b border-gray-800 pb-4">
          <h1 className="text-3xl font-bold">Engine Einstellungen</h1>
          <a href="/" className="text-blue-500 hover:text-blue-400">Zurück zum Dashboard</a>
        </header>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-gray-300">Anzeige Limits</h2>
          <div className="flex justify-between items-center bg-gray-900 p-4 rounded-lg">
            <span>Maximal sichtbare Empfehlungen</span>
            <input 
              type="number" 
              value={config.maxRecommendations}
              onChange={e => setConfig({...config, maxRecommendations: parseInt(e.target.value)})}
              className="bg-gray-800 text-white px-3 py-1 rounded w-20 text-center"
            />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-gray-300">Time-Decay (Verrottende Backlogs)</h2>
          <div className="bg-gray-900 p-4 rounded-lg space-y-4">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input 
                type="checkbox" 
                checked={config.penalizeOldBacklogs}
                onChange={e => setConfig({...config, penalizeOldBacklogs: e.target.checked})}
                className="form-checkbox h-5 w-5 text-blue-600 rounded bg-gray-800 border-gray-700"
              />
              <span>Alte Backlogs automatisch abwerten</span>
            </label>
            
            <div className="flex justify-between items-center opacity-80">
              <span>Alter in Tagen (Threshold)</span>
              <input 
                type="number" 
                value={config.backlogPenaltyAgeDays}
                onChange={e => setConfig({...config, backlogPenaltyAgeDays: parseInt(e.target.value)})}
                className="bg-gray-800 text-white px-3 py-1 rounded w-20 text-center"
              />
            </div>
            
            <div className="flex justify-between items-center opacity-80">
              <span>Punkte Abzug (Penalty)</span>
              <input 
                type="number" 
                value={config.backlogPenaltyScore}
                onChange={e => setConfig({...config, backlogPenaltyScore: parseInt(e.target.value)})}
                className="bg-gray-800 text-white px-3 py-1 rounded w-20 text-center"
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-gray-300">Triage & Extras</h2>
          <div className="bg-gray-900 p-4 rounded-lg">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input 
                type="checkbox" 
                checked={config.showTriageJoker}
                onChange={e => setConfig({...config, showTriageJoker: e.target.checked})}
                className="form-checkbox h-5 w-5 text-blue-600 rounded bg-gray-800 border-gray-700"
              />
              <div>
                <span className="block">Triage-Joker aktivieren</span>
                <span className="text-xs text-gray-500">Mischt gelegentlich ein uraltes Ticket ins Dashboard, um es aufzuräumen.</span>
              </div>
            </label>
          </div>
        </section>

        <div className="pt-4 border-t border-gray-800">
          <button 
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            {saving ? 'Wird gespeichert...' : 'Einstellungen speichern'}
          </button>
        </div>
      </div>
    </main>
  )
}
