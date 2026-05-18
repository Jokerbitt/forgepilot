'use client'

import { useEffect, useState, useRef } from 'react'
import {
  Search, BookOpen, Sparkles, ExternalLink, ChevronRight,
  Clock, CheckCircle2, XCircle, Loader2, Tag, GraduationCap,
  Building2, Newspaper, Globe, HelpCircle, Plus, FileText,
  AlertTriangle, ArrowRight,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ResearchDocument, ResearchCitation, SourceCredibility } from '@/lib/models/research'
import type { ResearchQuality } from '@/app/api/knowledge/research/[id]/quality/route'
import { cx } from '@/components/ui/primitives'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CREDIBILITY_META: Record<SourceCredibility, { label: string; icon: React.ElementType; color: string }> = {
  academic:   { label: 'Peer-reviewed', icon: GraduationCap, color: 'text-violet-400 border-violet-500/30 bg-violet-500/10' },
  government: { label: 'Offiziell',     icon: Building2,     color: 'text-sky-400 border-sky-500/30 bg-sky-500/10' },
  reputable:  { label: 'Seriös',        icon: Newspaper,     color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  general:    { label: 'Allgemein',     icon: Globe,         color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  unknown:    { label: 'Unbekannt',     icon: HelpCircle,    color: 'text-slate-400 border-slate-500/30 bg-slate-500/10' },
}

function CitationBadge({ credibility }: { credibility: SourceCredibility }) {
  const meta = CREDIBILITY_META[credibility] ?? CREDIBILITY_META.unknown
  const Icon = meta.icon
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold', meta.color)}>
      <Icon className="h-2.5 w-2.5" />
      {meta.label}
    </span>
  )
}

function StatusBadge({ status }: { status: ResearchDocument['status'] }) {
  switch (status) {
    case 'running':
      return (
        <span className="flex items-center gap-1.5 text-xs font-semibold text-violet-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          Recherchiert…
        </span>
      )
    case 'completed':
      return (
        <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
          <CheckCircle2 className="h-3 w-3" />
          Abgeschlossen
        </span>
      )
    case 'failed':
      return (
        <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
          <XCircle className="h-3 w-3" />
          Fehlgeschlagen
        </span>
      )
    default:
      return (
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <Clock className="h-3 w-3" />
          Ausstehend
        </span>
      )
  }
}

// ─── Quality Badge ────────────────────────────────────────────────────────────

const GRADE_COLORS: Record<ResearchQuality['grade'], string> = {
  A: 'text-violet-400 border-violet-500/30 bg-violet-500/10',
  B: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
  C: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  D: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
}

function QualityBadge({ docId }: { docId: string }) {
  const [quality, setQuality] = useState<ResearchQuality | null>(null)

  useEffect(() => {
    fetch(`/api/knowledge/research/${docId}/quality`)
      .then(r => r.ok ? r.json() as Promise<ResearchQuality> : Promise.reject())
      .then(setQuality)
      .catch(() => { /* non-critical */ })
  }, [docId])

  if (!quality) return null

  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold',
        GRADE_COLORS[quality.grade],
      )}
      title={`Quality Score: ${quality.score}/100`}
    >
      Grade {quality.grade}
      <span className="font-normal opacity-70">{quality.score}/100</span>
    </span>
  )
}

// ─── Document Viewer ──────────────────────────────────────────────────────────

function ResearchDocViewer({ doc }: { doc: ResearchDocument }) {
  const citationMap = new Map(doc.citations.map(c => [c.id, c]))

  return (
    <div className="space-y-6">
      {/* Quality Badge */}
      <div className="flex items-center gap-2">
        <QualityBadge docId={doc.id} />
      </div>

      {/* Abstract */}
      {doc.abstract && (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-5">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">Abstract</p>
          <p className="text-sm leading-relaxed text-slate-200">{doc.abstract}</p>
        </div>
      )}

      {/* Key Findings */}
      {doc.keyFindings.length > 0 && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-5">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-emerald-500">Kernaussagen</p>
          <ul className="space-y-2">
            {doc.keyFindings.map((f, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-slate-200">
                <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-400">
                  {i + 1}
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sections */}
      {doc.sections.map((section, si) => (
        <div key={si} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-5">
          <h3 className="mb-3 text-base font-bold text-white">{section.heading}</h3>
          <p className="mb-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{section.content}</p>

          {/* Inline citations for this section */}
          {section.citations.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-3">
              {section.citations.map(cid => {
                const c = citationMap.get(cid)
                if (!c) return null
                return (
                  <a
                    key={cid}
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-slate-400 transition-all hover:border-violet-500/30 hover:text-violet-300"
                  >
                    <CitationBadge credibility={c.credibility} />
                    <span className="max-w-48 truncate">{c.title}</span>
                    <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-50 group-hover:opacity-100" />
                  </a>
                )
              })}
            </div>
          )}
        </div>
      ))}

      {/* Full Reference List */}
      {doc.citations.length > 0 && (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-5">
          <p className="mb-4 text-[11px] font-bold uppercase tracking-widest text-slate-500">
            Quellen ({doc.citations.length})
          </p>
          <div className="space-y-3">
            {doc.citations.map((c, i) => (
              <div key={c.id} className="flex gap-3">
                <span className="mt-0.5 shrink-0 text-[11px] font-mono text-slate-600 tabular-nums">[{i + 1}]</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-white hover:text-violet-300 transition-colors"
                    >
                      {c.title}
                    </a>
                    <CitationBadge credibility={c.credibility} />
                    <ExternalLink className="h-3 w-3 text-slate-600" />
                  </div>
                  {c.author && (
                    <p className="text-[11px] text-slate-500">
                      {c.author}{c.publishedAt ? ` · ${c.publishedAt}` : ''}
                    </p>
                  )}
                  <p className="mt-1 text-xs italic text-slate-400 leading-relaxed">&ldquo;{c.excerpt}&rdquo;</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {doc.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Tag className="h-3.5 w-3.5 text-slate-600" />
          {doc.tags.map(t => (
            <span key={t} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 text-xs text-slate-400">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Research Card (list view) ────────────────────────────────────────────────

function ResearchCard({ doc, onSelect, selected }: {
  doc: ResearchDocument
  onSelect: (doc: ResearchDocument) => void
  selected: boolean
}) {
  const academicCount = doc.citations.filter(c => c.credibility === 'academic').length
  const govCount = doc.citations.filter(c => c.credibility === 'government').length
  const [grade, setGrade] = useState<ResearchQuality['grade'] | null>(null)

  useEffect(() => {
    if (doc.status !== 'completed') return
    fetch(`/api/knowledge/research/${doc.id}/quality`)
      .then(r => r.ok ? r.json() as Promise<ResearchQuality> : Promise.reject())
      .then(q => setGrade(q.grade))
      .catch(() => { /* non-critical */ })
  }, [doc.id, doc.status])

  return (
    <button
      onClick={() => onSelect(doc)}
      className={cx(
        'w-full text-left rounded-xl border p-4 transition-all',
        selected
          ? 'border-violet-500/40 bg-violet-500/[0.06]'
          : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]',
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-white text-sm">{doc.topic}</p>
          {doc.question && (
            <p className="mt-0.5 truncate text-[11px] text-slate-500 italic">{doc.question}</p>
          )}
        </div>
        <StatusBadge status={doc.status} />
      </div>

      {doc.abstract && (
        <p className="mb-2 line-clamp-2 text-xs text-slate-400 leading-relaxed">{doc.abstract}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {academicCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-400">
            <GraduationCap className="h-3 w-3" />
            {academicCount} akademisch
          </span>
        )}
        {govCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-400">
            <Building2 className="h-3 w-3" />
            {govCount} offiziell
          </span>
        )}
        {doc.citations.length > 0 && academicCount === 0 && govCount === 0 && (
          <span className="text-[10px] text-slate-600">{doc.citations.length} Quellen</span>
        )}
        {grade && (
          <span className={cx(
            'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold',
            GRADE_COLORS[grade],
          )}>
            {grade}
          </span>
        )}
        <span className="ml-auto text-[10px] text-slate-600">
          {new Date(doc.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
        </span>
      </div>
    </button>
  )
}

// ─── Create Dialog ────────────────────────────────────────────────────────────

function CreateResearchForm({ onCreated }: { onCreated: (id: string) => void }) {
  const [topic, setTopic] = useState('')
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!topic.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/knowledge/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), question: question.trim() || undefined }),
      })
      const data = await res.json() as { id?: string; error?: string }
      if (!res.ok || !data.id) {
        setError(data.error ?? 'Fehler beim Starten der Recherche')
        return
      }
      setTopic('')
      setQuestion('')
      onCreated(data.id)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="h-4 w-4 text-violet-400" />
        <h2 className="text-sm font-bold text-white">Neue Recherche starten</h2>
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-slate-500">
          Thema *
        </label>
        <input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder='z.B. "Auswirkungen von KI auf Wissensarbeit" oder "CRISPR-Gentherapie aktueller Stand"'
          className="input-field w-full"
          required
          disabled={loading}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-slate-500">
          Forschungsfrage <span className="normal-case font-normal text-slate-600">(optional)</span>
        </label>
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder='z.B. "Welche messbaren Produktivitaetsgewinne sind belegt?"'
          className="input-field w-full"
          disabled={loading}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-400 mt-0.5" />
          <p className="text-xs text-rose-300">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !topic.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-violet-500 disabled:opacity-40"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            KI recherchiert…
          </>
        ) : (
          <>
            <Search className="h-4 w-4" />
            Recherche starten
          </>
        )}
      </button>

      <p className="text-[10px] text-slate-600 text-center">
        Nutzt Claude Opus · priorisiert akademische & offizielle Quellen
      </p>
    </form>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ResearchPage() {
  const [docs, setDocs] = useState<ResearchDocument[]>([])
  const [selected, setSelected] = useState<ResearchDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creatingBrief, setCreatingBrief] = useState(false)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  const fetchDocs = async () => {
    try {
      const res = await fetch('/api/knowledge/research')
      const data = await res.json() as ResearchDocument[]
      setDocs(data)
      // Update selected doc if it's in the list
      if (selected) {
        const updated = data.find(d => d.id === selected.id)
        if (updated) setSelected(updated)
      }
    } catch { /* non-critical */ }
    setLoading(false)
  }

  useEffect(() => {
    fetchDocs()
    pollRef.current = setInterval(fetchDocs, 3000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreateBrief = async (researchId: string) => {
    setCreatingBrief(true)
    try {
      const res = await fetch('/api/project-briefs/from-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ researchId }),
      })
      const data = await res.json() as { briefId?: string; error?: string }
      if (res.ok && data.briefId) {
        router.push(`/project-briefs/${data.briefId}`)
      }
    } finally {
      setCreatingBrief(false)
    }
  }

  const handleCreated = (id: string) => {
    setShowCreate(false)
    fetchDocs().then(() => {
      const doc = docs.find(d => d.id === id)
      if (doc) setSelected(doc)
    })
  }

  const runningCount = docs.filter(d => d.status === 'running').length
  const completedCount = docs.filter(d => d.status === 'completed').length

  return (
    <main className="min-h-screen p-6 text-white">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="page-eyebrow">Knowledge</p>
            <h1 className="page-title">Research Platform</h1>
          </div>
          <div className="flex items-center gap-3">
            {runningCount > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
                <span className="text-xs font-semibold text-violet-400">{runningCount} läuft</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5">
              <BookOpen className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-xs text-slate-400">{completedCount} Dokumente</span>
            </div>
            <button
              onClick={() => setShowCreate(v => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-sm font-bold text-violet-300 transition-all hover:bg-violet-500/25"
            >
              <Plus className="h-4 w-4" />
              Neue Recherche
            </button>
            <Link href="/knowledge" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-300 transition-colors">
              Knowledge <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="mb-5">
            <CreateResearchForm onCreated={handleCreated} />
          </div>
        )}

        {/* Two-column layout */}
        <div className="grid gap-5 lg:grid-cols-[360px_1fr]">

          {/* Left: document list */}
          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl border border-white/[0.07] bg-white/[0.03]" />
              ))
            ) : docs.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.07] bg-white/[0.02] p-10 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
                  <Search className="h-5 w-5 text-slate-500" />
                </div>
                <p className="font-semibold text-white">Noch keine Recherchen</p>
                <p className="mt-1 text-sm text-slate-500">Starte deine erste KI-gestützte Recherche</p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="mt-4 flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-sm font-medium text-violet-400 hover:bg-violet-500/20 transition-all"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Erste Recherche starten
                </button>
              </div>
            ) : (
              docs.map(doc => (
                <ResearchCard
                  key={doc.id}
                  doc={doc}
                  onSelect={setSelected}
                  selected={selected?.id === doc.id}
                />
              ))
            )}
          </div>

          {/* Right: document viewer */}
          <div>
            {selected ? (
              <div>
                {/* Doc header */}
                <div className="mb-4 rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-white">{selected.topic}</h2>
                      {selected.question && (
                        <p className="mt-1 text-sm italic text-slate-400">{selected.question}</p>
                      )}
                    </div>
                    <StatusBadge status={selected.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(selected.createdAt).toLocaleString('de-DE', {
                        day: '2-digit', month: '2-digit', year: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                    {selected.model && (
                      <span className="flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        {selected.model}
                      </span>
                    )}
                    {selected.tokenUsage && (
                      <span>{(selected.tokenUsage.promptTokens + selected.tokenUsage.completionTokens).toLocaleString('de')} Tokens</span>
                    )}
                    {selected.citations.length > 0 && (
                      <span>{selected.citations.length} Quellen</span>
                    )}
                  </div>
                </div>

                {selected.status === 'completed' && (
                  <div className="mb-4 flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-emerald-400">Recherche abgeschlossen</p>
                      <p className="text-[11px] text-slate-500">Erstelle jetzt einen Projektsteckbrief oder generiere direkt Meilensteine</p>
                    </div>
                    <button
                      onClick={() => handleCreateBrief(selected.id)}
                      disabled={creatingBrief}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-all hover:bg-emerald-500 disabled:opacity-40"
                    >
                      {creatingBrief ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                      {creatingBrief ? 'Erstelle Brief…' : 'Brief erstellen'}
                    </button>
                  </div>
                )}

                {selected.status === 'running' && (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-12 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-500/10">
                      <Search className="h-7 w-7 animate-pulse text-violet-400" />
                    </div>
                    <p className="text-base font-semibold text-white">KI recherchiert gerade…</p>
                    <p className="mt-2 text-sm text-slate-400">
                      Analysiere Quellen, prüfe Glaubwürdigkeit, erstelle Dokument
                    </p>
                    <div className="mt-4 flex items-center gap-2 text-xs text-violet-400/60">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Wird automatisch aktualisiert…
                    </div>
                  </div>
                )}

                {selected.status === 'failed' && (
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-6 text-center">
                    <XCircle className="mx-auto mb-2 h-8 w-8 text-rose-400" />
                    <p className="font-semibold text-white">Recherche fehlgeschlagen</p>
                    {selected.abstract && (
                      <p className="mt-2 text-sm text-rose-300/80">{selected.abstract}</p>
                    )}
                  </div>
                )}

                {selected.status === 'completed' && (
                  <ResearchDocViewer doc={selected} />
                )}
              </div>
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.07] bg-white/[0.02] p-12 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
                  <FileText className="h-5 w-5 text-slate-500" />
                </div>
                <p className="font-semibold text-white">Kein Dokument ausgewählt</p>
                <p className="mt-1 text-sm text-slate-500">
                  Wähle eine Recherche aus der Liste oder starte eine neue
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
