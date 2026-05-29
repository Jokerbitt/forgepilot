'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Loader2,
  Map,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { cx } from '@/components/ui/primitives'
import type { ConceptAnalysis } from '@/app/api/concept/analyze/route'

// ─── Types ────────────────────────────────────────────────────────────────────

type AnalysisState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; analysis: ConceptAnalysis }
  | { status: 'error'; message: string }

const TASK_TYPE_COLOR: Record<string, string> = {
  feature: 'text-violet-300 bg-violet-950/40 border-violet-800/40',
  bugfix:  'text-red-300 bg-red-950/40 border-red-800/40',
  docs:    'text-blue-300 bg-blue-950/40 border-blue-800/40',
  test:    'text-emerald-300 bg-emerald-950/40 border-emerald-800/40',
  infra:   'text-amber-300 bg-amber-950/40 border-amber-800/40',
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'image/png',
  'image/jpeg',
  'image/webp',
]
const ACCEPTED_EXT = '.pdf,.txt,.md,.png,.jpg,.jpeg,.webp'

// ─── Milestone card ───────────────────────────────────────────────────────────

function MilestoneCard({ milestone, index }: {
  milestone: ConceptAnalysis['milestones'][0]
  index: number
}) {
  const [expanded, setExpanded] = useState(index === 0)
  const totalHours = milestone.tasks.reduce((s, t) => s + t.estimatedHours, 0)

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-xs font-bold text-violet-200">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{milestone.title}</p>
          <p className="text-xs text-slate-500">{milestone.tasks.length} Tasks · ~{milestone.estimatedDays} Tage · {totalHours}h</p>
        </div>
        {expanded ? <ChevronDown className="h-4 w-4 text-slate-600 shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-600 shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-white/[0.05] px-4 pb-4 pt-3 space-y-2">
          <p className="text-xs text-slate-400 leading-5">{milestone.description}</p>
          <div className="space-y-1.5 mt-3">
            {milestone.tasks.map(task => (
              <div key={task.id} className="flex items-center gap-2">
                <span className={cx(
                  'shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium',
                  TASK_TYPE_COLOR[task.type] ?? TASK_TYPE_COLOR.feature,
                )}>
                  {task.type}
                </span>
                <span className="flex-1 text-xs text-slate-300">{task.title}</span>
                <span className="shrink-0 text-[10px] text-slate-600">{task.estimatedHours}h</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ConceptPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [textInput, setTextInput] = useState('')
  const [state, setState] = useState<AnalysisState>({ status: 'idle' })

  const handleFile = useCallback((f: File) => {
    if (f.size > 10 * 1024 * 1024) {
      setState({ status: 'error', message: 'Datei zu groß (max. 10 MB)' })
      return
    }
    setFile(f)
    setState({ status: 'idle' })
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleFile(dropped)
  }, [handleFile])

  const handleAnalyze = async () => {
    if (!file && !textInput.trim()) return
    setState({ status: 'loading' })

    const form = new FormData()
    if (file) form.append('file', file)
    else form.append('text', textInput.trim())

    try {
      const res = await fetch('/api/concept/analyze', { method: 'POST', body: form })
      const data = await res.json() as ConceptAnalysis & { error?: string }
      if (!res.ok) {
        setState({ status: 'error', message: data.error ?? 'Analyse fehlgeschlagen' })
        return
      }
      setState({ status: 'done', analysis: data })
    } catch {
      setState({ status: 'error', message: 'Netzwerkfehler — bitte erneut versuchen' })
    }
  }

  const handleOpenPlanMode = () => {
    if (state.status !== 'done') return
    const { analysis } = state
    const goal = `${analysis.projectName}: ${analysis.mvpScope}`
    const context = [
      `App-Typ: ${analysis.appType}`,
      analysis.stack.frontend ? `Frontend: ${analysis.stack.frontend}` : null,
      analysis.stack.backend ? `Backend: ${analysis.stack.backend}` : null,
      analysis.stack.database ? `Datenbank: ${analysis.stack.database}` : null,
      `Nächster Schritt: ${analysis.nextStep}`,
    ].filter(Boolean).join('\n')

    const params = new URLSearchParams({ goal, context })
    router.push(`/delegations/plan?${params.toString()}`)
  }

  const analysis = state.status === 'done' ? state.analysis : null
  const totalDays = analysis?.milestones.reduce((s, m) => s + m.estimatedDays, 0) ?? 0
  const totalTasks = analysis?.milestones.reduce((s, m) => s + m.tasks.length, 0) ?? 0

  return (
    <main className="min-h-screen bg-[#08080d] px-5 py-6 text-slate-100 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">

        {/* Header */}
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-slate-600 mb-4">
            <Link href="/" className="hover:text-slate-400 transition-colors">Command Center</Link>
            <span>›</span>
            <span className="text-slate-400">Konzept analysieren</span>
          </nav>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Konzept analysieren</h1>
              <p className="text-sm text-slate-400">PDF, Text oder Bild hochladen → KI plant Meilensteine & Tasks</p>
            </div>
          </div>
        </div>

        {/* Upload area */}
        {state.status !== 'done' && (
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-6 space-y-4">
            {/* Dropzone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cx(
                'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 cursor-pointer transition-colors',
                dragging
                  ? 'border-violet-400/60 bg-violet-500/[0.07]'
                  : file
                  ? 'border-emerald-600/40 bg-emerald-500/[0.04]'
                  : 'border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.02]',
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXT}
                className="hidden"
                onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
              />
              {file ? (
                <>
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-emerald-300">{file.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{(file.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); setFile(null) }}
                    className="flex items-center gap-1 text-xs text-slate-600 hover:text-red-400 transition-colors"
                  >
                    <X className="h-3 w-3" /> Entfernen
                  </button>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-slate-600" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-300">Datei hierher ziehen oder klicken</p>
                    <p className="text-xs text-slate-600 mt-1">PDF, TXT, MD, PNG, JPG, WEBP · max. 10 MB</p>
                  </div>
                </>
              )}
            </div>

            {/* OR text input */}
            {!file && (
              <>
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/[0.06]" />
                  <span className="text-xs text-slate-600">oder Text einfügen</span>
                  <div className="h-px flex-1 bg-white/[0.06]" />
                </div>
                <textarea
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  rows={6}
                  placeholder="Konzept, Anforderungen, Feature-Beschreibung, Idee… einfach hier einfügen."
                  className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/25"
                />
              </>
            )}

            {/* Error */}
            {state.status === 'error' && (
              <div className="flex items-start gap-2 rounded-lg border border-red-800/40 bg-red-950/20 px-3 py-2">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{state.message}</p>
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={(!file && !textInput.trim()) || state.status === 'loading'}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-40"
            >
              {state.status === 'loading'
                ? <><Loader2 className="h-4 w-4 animate-spin" />KI analysiert…</>
                : <><Sparkles className="h-4 w-4" />Jetzt analysieren</>
              }
            </button>
          </div>
        )}

        {/* Analysis result */}
        {analysis && (
          <div className="space-y-5">
            {/* Summary card */}
            <div className="rounded-xl border border-emerald-700/30 bg-emerald-950/10 p-5 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">Analysiert</p>
                  <h2 className="mt-1 text-xl font-bold text-white">{analysis.projectName}</h2>
                </div>
                <div className="flex gap-2 shrink-0">
                  <span className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-slate-300">
                    {analysis.appType}
                  </span>
                </div>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{analysis.summary}</p>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 pt-1">
                {[
                  { label: 'Meilensteine', value: analysis.milestones.length, icon: Map },
                  { label: 'Tasks', value: totalTasks, icon: CheckCircle2 },
                  { label: 'Geschätzte Dauer', value: `~${totalDays} Tage`, icon: Clock },
                ].map(s => {
                  const Icon = s.icon
                  return (
                    <div key={s.label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                      <Icon className="h-4 w-4 text-slate-500 mx-auto mb-1" />
                      <p className="text-lg font-bold text-white">{s.value}</p>
                      <p className="text-[10px] text-slate-600 uppercase tracking-wide">{s.label}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Stack */}
            {(analysis.stack.frontend || analysis.stack.backend || analysis.stack.database) && (
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Empfohlener Stack</p>
                <div className="flex flex-wrap gap-2">
                  {analysis.stack.frontend && (
                    <span className="rounded-lg border border-violet-700/30 bg-violet-950/20 px-3 py-1 text-xs font-medium text-violet-300">
                      Frontend: {analysis.stack.frontend}
                    </span>
                  )}
                  {analysis.stack.backend && (
                    <span className="rounded-lg border border-blue-700/30 bg-blue-950/20 px-3 py-1 text-xs font-medium text-blue-300">
                      Backend: {analysis.stack.backend}
                    </span>
                  )}
                  {analysis.stack.database && (
                    <span className="rounded-lg border border-amber-700/30 bg-amber-950/20 px-3 py-1 text-xs font-medium text-amber-300">
                      DB: {analysis.stack.database}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* MVP Scope */}
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">MVP-Schnitt</p>
              <p className="text-sm text-slate-300 leading-relaxed">{analysis.mvpScope}</p>
            </div>

            {/* Milestones */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Meilensteine & Tasks</p>
              {analysis.milestones.map((m, i) => (
                <MilestoneCard key={m.id} milestone={m} index={i} />
              ))}
            </div>

            {/* Risks + Recommendations */}
            <div className="grid gap-3 sm:grid-cols-2">
              {analysis.risks.length > 0 && (
                <div className="rounded-xl border border-red-800/30 bg-red-950/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-500 mb-2">Risiken</p>
                  <ul className="space-y-1.5">
                    {analysis.risks.map((r, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-400">
                        <span className="text-red-500 shrink-0 mt-0.5">⚠</span> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {analysis.recommendations.length > 0 && (
                <div className="rounded-xl border border-emerald-800/30 bg-emerald-950/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500 mb-2">Empfehlungen</p>
                  <ul className="space-y-1.5">
                    {analysis.recommendations.map((r, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-400">
                        <span className="text-emerald-500 shrink-0 mt-0.5">✓</span> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Next step */}
            <div className="rounded-xl border border-violet-700/30 bg-violet-950/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-400 mb-1">Nächster Schritt</p>
              <p className="text-sm text-white">{analysis.nextStep}</p>
            </div>

            {/* CTAs */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={handleOpenPlanMode}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
              >
                <Map className="h-4 w-4" />
                In Plan Mode öffnen
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => { setFile(null); setTextInput(''); setState({ status: 'idle' }) }}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] py-3 text-sm font-medium text-slate-300 transition hover:border-white/[0.15] hover:bg-white/[0.04]"
              >
                Neu analysieren
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
