'use client'

import { useEffect, useState } from 'react'
import type { NBARecommendation } from '@/lib/models/nba'
import { NBACard } from './NBACard'

export function NBAPanel() {
  const [recs, setRecs] = useState<NBARecommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [activeProject, setActiveProject] = useState<string>('Alle')

  useEffect(() => {
    fetch('/api/recommendations')
      .then(res => res.json())
      .then(data => {
        setRecs(data.recommendations || [])
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [])

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
