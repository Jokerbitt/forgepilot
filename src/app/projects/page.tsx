'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { cx } from '@/components/ui/primitives'
import type { ProjectSummary } from '@/app/api/projects/route'

type RunStatus = 'building' | 'running' | 'done' | 'failed'

const STATUS_LABEL: Record<RunStatus, string> = {
  building: 'Wird aufgebaut',
  running:  'Agenten aktiv',
  done:     'Abgeschlossen',
  failed:   'Fehler',
}

const STATUS_COLOR: Record<RunStatus, string> = {
  building: 'text-slate-500 border-slate-700/50 bg-slate-800/30',
  running:  'text-violet-400 border-violet-500/30 bg-violet-950/20',
  done:     'text-emerald-400 border-emerald-500/20 bg-emerald-950/10',
  failed:   'text-rose-400 border-rose-500/20 bg-rose-950/10',
}

const STATUS_DOT: Record<RunStatus, string> = {
  building: 'bg-slate-600',
  running:  'bg-violet-400 animate-pulse',
  done:     'bg-emerald-400',
  failed:   'bg-rose-400',
}

function ProgressBar({ done, total, status }: { done: number; total: number; status: RunStatus }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const barColor =
    status === 'done'    ? 'bg-emerald-500' :
    status === 'failed'  ? 'bg-rose-500' :
    status === 'running' ? 'bg-violet-500' :
    'bg-slate-600'
  return (
    <div className="w-full h-1 bg-white/[0.05] rounded-full overflow-hidden">
      <div
        className={cx('h-full rounded-full transition-all duration-700', barColor)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function ProjectCard({ project }: { project: ProjectSummary }) {
  const p = project.pipeline
  const status: RunStatus = p?.runStatus ?? 'building'
  const hasPipeline = !!p

  return (
    <div className={cx(
      'rounded-xl border p-5 transition-all hover:border-white/20',
      hasPipeline ? STATUS_COLOR[status] : 'border-white/[0.06] bg-white/[0.02]',
    )}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <a
            href={`/project-briefs/${project.id}`}
            className="text-sm font-semibold text-white hover:text-violet-300 transition-colors truncate block"
          >
            {project.title}
          </a>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{project.problemStatement}</p>
        </div>
        {hasPipeline && (
          <div className={cx('flex items-center gap-1.5 shrink-0 rounded-full border px-2.5 py-1', STATUS_COLOR[status])}>
            <span className={cx('h-1.5 w-1.5 rounded-full', STATUS_DOT[status])} />
            <span className="text-xs font-medium">{STATUS_LABEL[status]}</span>
          </div>
        )}
        {!hasPipeline && (
          <span className="text-xs text-slate-600 shrink-0">Manuell</span>
        )}
      </div>

      {hasPipeline && p && (
        <>
          <p className="text-xs text-slate-600 mb-3 italic line-clamp-1">&quot;{p.idea}&quot;</p>

          <ProgressBar done={p.doneTasks} total={p.taskCount} status={status} />

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <a
                href={`/work-items?projectId=${project.id}`}
                className="hover:text-violet-400 transition-colors"
              >
                {p.workItemCount} Work Items
              </a>
              <span>{p.doneTasks}/{p.taskCount} Tasks</span>
            </div>
            <a
              href="/orchestrations"
              className="text-xs text-violet-400 hover:underline"
            >
              Run ansehen →
            </a>
          </div>
        </>
      )}

      {!hasPipeline && (
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-slate-600">
            {new Date(project.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
          <a
            href={`/project-briefs/${project.id}`}
            className="text-xs text-violet-400 hover:underline"
          >
            Brief öffnen →
          </a>
        </div>
      )}
    </div>
  )
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadProjects = useCallback(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) setProjects(data as ProjectSummary[])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Initial load
  useEffect(() => { loadProjects() }, [loadProjects])

  // Adaptive polling: fast (3s) when runs are active, slow (15s) otherwise
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    const hasActive = projects.some(
      p => p.pipeline?.runStatus === 'running' || p.pipeline?.runStatus === 'building'
    )
    const interval = hasActive ? 3_000 : 15_000
    pollRef.current = setInterval(loadProjects, interval)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [projects, loadProjects])

  const pipelineProjects = projects.filter(p => p.pipeline)
  const manualProjects = projects.filter(p => !p.pipeline)
  const running = pipelineProjects.filter(p => p.pipeline?.runStatus === 'running').length
  const done = pipelineProjects.filter(p => p.pipeline?.runStatus === 'done').length

  return (
    <main className="min-h-screen bg-[#08080d]">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">← Command Center</a>
          <span className="text-slate-700">/</span>
          <span className="text-sm text-slate-400">My Projects</span>
        </div>
        <a
          href="/idea"
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold bg-violet-600 text-white hover:bg-violet-500 transition-colors"
        >
          <span>💡</span> Neue Idee
        </a>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Stats bar */}
        {pipelineProjects.length > 0 && (
          <div className="flex items-center gap-6 mb-8">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{pipelineProjects.length}</p>
              <p className="text-xs text-slate-500">Gesamt</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-violet-400">{running}</p>
              <p className="text-xs text-slate-500">Aktiv</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-400">{done}</p>
              <p className="text-xs text-slate-500">Fertig</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="flex gap-1.5">
              {[0, 1, 2].map(d => (
                <span key={d} className="h-2 w-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: `${d * 150}ms` }} />
              ))}
            </div>
            <p className="text-xs text-slate-600">Projekte werden geladen…</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <p className="text-4xl">💡</p>
            <h2 className="text-lg font-semibold text-white">Noch keine Projekte</h2>
            <p className="text-sm text-slate-500 max-w-xs">
              Beschreibe deine erste Idee — ForgePilot baut sie vollautomatisch.
            </p>
            <a
              href="/idea"
              className="mt-2 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold bg-violet-600 text-white hover:bg-violet-500 transition-colors"
            >
              Erste Idee eingeben →
            </a>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Pipeline Projects */}
            {pipelineProjects.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Idea → Production
                  </h2>
                  <span className="text-xs text-slate-700">({pipelineProjects.length})</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {pipelineProjects.map(p => (
                    <ProjectCard key={p.id} project={p} />
                  ))}
                </div>
              </section>
            )}

            {/* Manual Projects */}
            {manualProjects.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Manuell erstellt
                  </h2>
                  <span className="text-xs text-slate-700">({manualProjects.length})</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {manualProjects.map(p => (
                    <ProjectCard key={p.id} project={p} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
