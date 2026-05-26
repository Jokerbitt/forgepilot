'use client'

import { useEffect, useState, useCallback } from 'react'
import type { NBARecommendation } from '@/lib/models/nba'
import { NBACard } from './NBACard'
import { captureError } from '@/lib/logger/browser'

export function NBAPanel() {
  const [recs, setRecs] = useState<NBARecommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [activeProject, setActiveProject] = useState<string>('Alle')

  const fetchRecs = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    try {
      const res = await fetch('/api/recommendations')
      const data = await res.json() as { recommendations?: NBARecommendation[] }
      setRecs(data.recommendations || [])
      setLastRefreshed(new Date())
    } catch (err) {
      captureError(err, 'NBAPanel:fetchRecs')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchRecs()
    // Auto-refresh every 60s to pick up new Linear/GitHub items
    const interval = setInterval(() => fetchRecs(), 60000)
    return () => clearInterval(interval)
  }, [fetchRecs])

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-gray-900 rounded-xl border border-gray-800"></div>
        <div className="h-32 bg-gray-900 rounded-xl border border-gray-800"></div>
      </div>
    )
  }

  if (recs.length === 0) {
    return (
      <div className="text-center p-8 bg-gray-900 rounded-xl border border-gray-800">
        <p className="text-gray-400">Keine WorkItems gefunden. Du bist frei!</p>
      </div>
    )
  }

  const uniqueProjects = Array.from(new Set(recs.map(r => r.workItem.projectId || r.workItem.source))).sort()
  const filteredRecs = activeProject === 'Alle' ? recs : recs.filter(r => (r.workItem.projectId || r.workItem.source) === activeProject)

  return (
    <div className="space-y-4">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
          Next Best Actions
        </h2>
        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="text-xs text-gray-600">
              {lastRefreshed.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => fetchRecs(true)}
            disabled={refreshing}
            className="p-1.5 text-gray-600 hover:text-gray-400 transition-colors disabled:opacity-50"
            title="Empfehlungen neu laden"
          >
            <span className={refreshing ? 'animate-spin inline-block' : ''}>↻</span>
          </button>
        </div>
      </div>

      {uniqueProjects.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveProject('Alle')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeProject === 'Alle' ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800 border border-gray-800'
            }`}
          >
            Alle Projekte
          </button>
          {uniqueProjects.map(proj => (
            <button
              key={proj}
              onClick={() => setActiveProject(proj)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeProject === proj ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800 border border-gray-800'
              }`}
            >
              {proj}
            </button>
          ))}
        </div>
      )}

      {filteredRecs.length === 0 ? (
        <div className="text-center p-8 bg-gray-900 rounded-xl border border-gray-800">
          <p className="text-gray-400">Keine offenen Aufgaben für {activeProject}.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRecs.map(rec => (
            <NBACard key={rec.workItem.id} rec={rec} />
          ))}
        </div>
      )}
    </div>
  )
}
