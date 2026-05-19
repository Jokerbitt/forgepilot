import Link from 'next/link'
import { readProjectBriefs } from '@/lib/project-briefs'
import { Badge, Panel } from '@/components/ui/primitives'

const STATUS_TONE: Record<string, 'neutral' | 'warning' | 'success'> = {
  draft: 'neutral',
  in_review: 'warning',
  accepted: 'success',
  archived: 'neutral',
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
    <Panel className="mb-6 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
          Projekte
        </h2>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {inReview > 0 && (
            <span className="text-yellow-400">{inReview} in Review</span>
          )}
          {accepted > 0 && (
            <span className="text-green-400">{accepted} freigegeben</span>
          )}
          <Link href="/project-briefs" className="text-blue-400 hover:text-blue-300 transition-colors">
            Alle
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
                <Badge tone={STATUS_TONE[brief.status]} className="shrink-0">
                  {STATUS_LABEL[brief.status]}
                </Badge>
                <span className="text-sm text-white truncate group-hover:text-blue-300 transition-colors">
                  {brief.title}
                </span>
              </div>
              <span className="shrink-0 text-xs text-gray-600 ml-3">
                {totalReqs > 0 ? `${acceptedReqs}/${totalReqs} REQ` : '-'}
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
    </Panel>
  )
}
