import Link from 'next/link'
import { readProjectBriefs } from '@/lib/project-briefs'
import type { ProjectBrief } from '@/lib/models/project-brief'

const STATUS_LABELS: Record<ProjectBrief['status'], string> = {
  draft: 'Entwurf',
  in_review: 'In Review',
  accepted: 'Freigegeben',
  archived: 'Archiviert',
}

const STATUS_COLORS: Record<ProjectBrief['status'], string> = {
  draft: 'bg-gray-800 text-gray-400',
  in_review: 'bg-yellow-900/40 text-yellow-400',
  accepted: 'bg-green-900/40 text-green-400',
  archived: 'bg-gray-900 text-gray-600',
}

export default function ProjectBriefsPage() {
  const briefs = readProjectBriefs()
  const active = briefs.filter(b => b.status !== 'archived')
  const archived = briefs.filter(b => b.status === 'archived')

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Projekte</h1>
            <p className="text-sm text-gray-500 mt-1">
              {active.length} aktive Projekte
            </p>
          </div>
          <Link
            href="/project-briefs/new"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            ✦ Neue Idee
          </Link>
        </div>

        {briefs.length === 0 ? (
          <div className="text-center py-16">
            <span className="text-4xl block mb-3">💡</span>
            <p className="text-gray-400 mb-2">Noch keine Projekte.</p>
            <p className="text-gray-600 text-sm mb-6">Fange mit einer Idee an — ForgePilot hilft dir, sie zu strukturieren.</p>
            <Link
              href="/project-briefs/new"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Erste Idee erfassen
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {active.map(brief => (
              <BriefRow key={brief.id} brief={brief} />
            ))}

            {archived.length > 0 && (
              <>
                <div className="pt-4 pb-2">
                  <p className="text-xs text-gray-600 uppercase tracking-wider">Archiviert ({archived.length})</p>
                </div>
                {archived.map(brief => (
                  <BriefRow key={brief.id} brief={brief} />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function BriefRow({ brief }: { brief: ProjectBrief }) {
  const accepted = brief.requirements.filter(r => r.status === 'accepted').length
  const total = brief.requirements.length
  return (
    <Link
      href={`/project-briefs/${brief.id}`}
      className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-xl hover:border-gray-600 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-medium text-white truncate group-hover:text-blue-300 transition-colors">
            {brief.title}
          </p>
          <span className={`shrink-0 px-1.5 py-0.5 text-xs rounded-full font-medium ${STATUS_COLORS[brief.status]}`}>
            {STATUS_LABELS[brief.status]}
          </span>
        </div>
        <p className="text-xs text-gray-500 truncate">{brief.problemStatement}</p>
      </div>
      <div className="shrink-0 text-right ml-4">
        <p className="text-xs text-gray-500">{total > 0 ? `${accepted}/${total} REQ` : 'Neu'}</p>
        <p className="text-xs text-gray-700">{new Date(brief.updatedAt).toLocaleDateString('de-DE')}</p>
      </div>
    </Link>
  )
}
