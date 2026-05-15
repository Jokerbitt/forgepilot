import type { NBARecommendation } from '@/lib/models/nba'

export function NBACard({ rec }: { rec: NBARecommendation }) {
  const { workItem, score, suggestedAction, rationale } = rec
  
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 hover:border-gray-700 transition-colors">
      <div className="flex justify-between items-start mb-3">
        <div>
          <span className="text-xs font-mono text-gray-500 mr-2">{workItem.id}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${workItem.source === 'github' ? 'bg-gray-800 text-white' : 'bg-indigo-900/50 text-indigo-300'}`}>
            {workItem.source}
          </span>
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
      
      <div className="border-t border-gray-800 pt-3 flex justify-between items-center">
        <p className="text-sm text-gray-400">{rationale}</p>
        <span className={`text-xs font-bold px-3 py-1.5 rounded ${suggestedAction === 'delegate-ai' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'}`}>
          {suggestedAction.replace('-', ' ').toUpperCase()}
        </span>
      </div>
    </div>
  )
}
