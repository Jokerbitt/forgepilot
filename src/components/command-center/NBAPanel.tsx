'use client'

import { useEffect, useState } from 'react'
import type { NBARecommendation } from '@/lib/models/nba'
import { NBACard } from './NBACard'

export function NBAPanel() {
  const [recs, setRecs] = useState<NBARecommendation[]>([])
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="space-y-4">
      {recs.slice(0, 5).map(rec => (
        <NBACard key={rec.workItem.id} rec={rec} />
      ))}
    </div>
  )
}
