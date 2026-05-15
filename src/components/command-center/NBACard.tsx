import type { NBARecommendation } from '@/lib/models/nba'
import { useState } from 'react'

const actionTranslations: Record<string, string> = {
  'do-now': 'JETZT MACHEN',
  'delegate-ai': 'AN KI DELEGIEREN',
  'delegate-runner': 'AN RUNNER DELEGIEREN',
  'research': 'RECHERCHE NÖTIG',
  'wait': 'WARTEN',
  'blocked': 'BLOCKIERT'
}

export function NBACard({ rec }: { rec: NBARecommendation }) {
  const { workItem, score, suggestedAction, rationale } = rec
  const [isPinning, setIsPinning] = useState(false)

  const handlePin = async () => {
    setIsPinning(true)
    const config = await fetch('/api/settings').then(res => res.json())
    const currentPins = config.pinnedItems || []
    
    // Toggle pin
    const newPins = currentPins.includes(workItem.id) 
      ? currentPins.filter((id: string) => id !== workItem.id)
      : [...currentPins, workItem.id]
      
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinnedItems: newPins })
    })
    
    // Force a reload to get new scores
    window.location.reload()
  }
  
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 hover:border-gray-700 transition-colors">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center">
          <span className="text-xs font-mono text-gray-500 mr-2">{workItem.id}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${workItem.source === 'github' ? 'bg-gray-800 text-white' : 'bg-indigo-900/50 text-indigo-300'}`}>
            {workItem.source}
          </span>
          <button 
            onClick={handlePin} 
            disabled={isPinning}
            className="text-xs ml-2 opacity-50 hover:opacity-100 hover:scale-110 transition-all"
            title="Ticket anpinnen (+1000 Score)"
          >
            📌
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-1 rounded-md ${score.total >= 70 ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
            Score: {score.total}
          </span>
        </div>
      </div>
      
      <h3 className="text-white font-medium mb-2">{workItem.title}</h3>
      
      <div className="flex flex-wrap gap-2 mb-4">
        {workItem.labels?.map(label => (
          <span key={label} className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded">
            {label}
          </span>
        ))}
      </div>
      
      <div className="border-t border-gray-800 pt-3 flex justify-between items-center mt-3">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-gray-400">{rationale}</p>
          <div className="flex items-center space-x-3 text-xs text-gray-500 mt-1">
            {workItem.estimate && <span>🎯 {workItem.estimate} pts</span>}
            {workItem.assigneeName && (
              <div className="flex items-center space-x-1">
                {workItem.assigneeAvatarUrl && (
                  <img src={workItem.assigneeAvatarUrl} alt="Avatar" className="w-4 h-4 rounded-full" />
                )}
                <span>{workItem.assigneeName}</span>
              </div>
            )}
          </div>
        </div>
        <span className={`text-xs font-bold px-3 py-1.5 rounded ${suggestedAction === 'delegate-ai' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'}`}>
          {actionTranslations[suggestedAction] || suggestedAction.replace('-', ' ').toUpperCase()}
        </span>
      </div>
    </div>
  )
}
