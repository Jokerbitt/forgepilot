import Link from 'next/link'
import { readProjectBriefs } from '@/lib/project-briefs'

const STATUS_CHIP: Record<string, string> = {
  draft:     'bg-gray-800 text-gray-400',
  in_review: 'bg-yellow-900/40 text-yellow-400',
  accepted:  'bg-green-900/40 text-green-400',
  archived:  'bg-gray-900 text-gray-600',
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Entwurf', in_review: 'In Review', accepted: 'Freigegeben', archived: 'Archiviert',
}

export function ProjectBriefsSummary() {
  const all = readProjectBriefs()
  const active = all.filter(b => b.status !== 'archived')

  if (active.length === 0) return null

  const inReview  = active.filter(b => b.status === 'in_review').length
  const accepted  = active.filter(b => b.status === 'accepted').length
  const recent    = [...active].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3)

  return (
    <div className="mb-6 bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <span>◇</span> Projekte
        </h2>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {inReview > 0 && (
            <span className="text-yellow-400">{inReview} in Review</span>
          )}
          {accepted > 0 && (
            <span className="text-green-400">{accepted} freigegeben</span>
          )}
          <Link href="/project-briefs" className="text-blue-400 hover:text-blue-300 transition-colors">
            Alle →
          </Link>
        </div>
      </div>

      <div className="space-y-2">
        {recent.map(brief => {
          const acceptedReqs = brief.requirements.filter(r => r.status === 'accepted').length
          const totalReqs    = brief.requirements.length
          return (
            <Link
              key={brief.id}
              href={`/project-briefs/${brief.id}`}
              className="flex items-center justify-between px-3 py-2 bg-gray-800/50 hover:bg-gray-800 rounded-lg transition-colors group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`shrink-0 px-1.5 py-0.5 text-xs rounded-full font-medium ${STATUS_CHIP[brief.status]}`}>
                  {STATUS_LABEL[brief.status]}
                </span>
                <span className="text-sm text-white truncate group-hover:text-blue-300 transition-colors">
                  {brief.title}
                </span>
              </div>
              <span className="shrink-0 text-xs text-gray-600 ml-3">
                {totalReqs > 0 ? `${acceptedReqs}/${totalReqs} REQ` : '—'}
              </span>
            </Link>
          )
        })}
      </div>

      {active.length > 3 && (
        <p className="mt-2 text-center text-xs text-gray-600">
          +{active.length - 3} weitere
        </p>
      )}
    </div>
  )
}
