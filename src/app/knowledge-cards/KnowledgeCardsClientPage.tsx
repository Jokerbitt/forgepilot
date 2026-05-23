'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import type { KnowledgeCard } from '@/lib/knowledge/knowledge-card'
import { Badge, EmptyState, Metric, Panel, buttonClassName } from '@/components/ui/primitives'

interface Props {
  cards: KnowledgeCard[]
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

function excerpt(content: string, max = 200): string {
  const stripped = content.replace(/\*\*/g, '').replace(/^#+\s/gm, '')
  return stripped.length <= max ? stripped : stripped.slice(0, max).trimEnd() + '…'
}

/** Group cards by sourceId, preserving newest-first insertion order. */
function groupBySource(cards: KnowledgeCard[]): Map<string, KnowledgeCard[]> {
  const map = new Map<string, KnowledgeCard[]>()
  for (const card of cards) {
    const group = map.get(card.sourceId) ?? []
    group.push(card)
    map.set(card.sourceId, group)
  }
  return map
}

/** Collect all unique tags across given cards. */
function collectTags(cards: KnowledgeCard[]): string[] {
  const set = new Set<string>()
  for (const card of cards) {
    for (const tag of card.tags) set.add(tag)
  }
  return Array.from(set).sort()
}

/** Client-side full-text filter matching title, content, and tags. */
function clientSearch(cards: KnowledgeCard[], q: string): KnowledgeCard[] {
  if (!q.trim()) return cards
  const ql = q.toLowerCase()
  return cards.filter(c =>
    c.title.toLowerCase().includes(ql) ||
    c.content.toLowerCase().includes(ql) ||
    c.tags.some(t => t.toLowerCase().includes(ql)),
  )
}

export function KnowledgeCardsClientPage({ cards: initialCards }: Props) {
  const [cards, setCards]       = useState<KnowledgeCard[]>(initialCards)
  const [filterTag, setFilterTag] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // ── Delete handler ──────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (id: string): Promise<boolean> => {
    setErrorMessage(null)
    try {
      const res = await fetch(`/api/knowledge-cards/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!res.ok) {
        setErrorMessage(`Lektion konnte nicht gelöscht werden (HTTP ${res.status}).`)
        return false
      }
      setCards(prev => prev.filter(c => c.id !== id))
      return true
    } catch {
      setErrorMessage('Lektion konnte nicht gelöscht werden.')
      return false
    }
  }, [])

  // ── Patch handler ────────────────────────────────────────────────────────────
  const handlePatch = useCallback(async (
    id: string,
    patch: Partial<Pick<KnowledgeCard, 'title' | 'content' | 'tags'>>,
  ): Promise<boolean> => {
    setErrorMessage(null)
    try {
      const res = await fetch(`/api/knowledge-cards/${encodeURIComponent(id)}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(patch),
      })
      if (!res.ok) {
        setErrorMessage(`Lektion konnte nicht gespeichert werden (HTTP ${res.status}).`)
        return false
      }
      const updated = await res.json() as KnowledgeCard
      setCards(prev => prev.map(c => c.id === id ? updated : c))
      return true
    } catch {
      setErrorMessage('Lektion konnte nicht gespeichert werden.')
      return false
    }
  }, [])

  // ── Filtering + search ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = cards
    if (filterTag) result = result.filter(c => c.tags.includes(filterTag))
    if (searchQuery) result = clientSearch(result, searchQuery)
    return result
  }, [cards, filterTag, searchQuery])

  const grouped  = useMemo(() => groupBySource(filtered), [filtered])
  const allTags  = useMemo(() => collectTags(cards),       [cards])
  const oldest   = cards.length > 0 ? cards[cards.length - 1] : null
  const newest   = cards.length > 0 ? cards[0] : null

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">

        {/* Header */}
        <header className="mb-6 border-b border-slate-800 pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Knowledge Base
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                Delegation Lessons
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Lektionen aus Delegation-Runs — automatisch nach jeder erfolgreichen Ausführung geschrieben.
              </p>
            </div>
            <Link href="/knowledge" className={buttonClassName('secondary', 'shrink-0')}>
              Knowledge Center
            </Link>
          </div>
        </header>

        {/* Stats Row */}
        <section className="mb-8 grid gap-3 sm:grid-cols-3">
          <Metric
            label="Lektionen"
            value={cards.length}
            detail="aus Delegation-Runs"
            tone="info"
          />
          <Metric
            label="Älteste"
            value={oldest ? formatDateShort(oldest.createdAt) : '—'}
            detail="erste Lektion"
            tone="neutral"
          />
          <Metric
            label="Neueste"
            value={newest ? formatDateShort(newest.createdAt) : '—'}
            detail="letzte Lektion"
            tone="neutral"
          />
        </section>

        {/* Search input */}
        <div className="mb-4">
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Lektionen durchsuchen…"
            className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
          />
        </div>

        {errorMessage && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {errorMessage}
          </div>
        )}

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Filter:</span>
            <button
              onClick={() => setFilterTag('')}
              className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${
                filterTag === ''
                  ? 'border-violet-500/60 bg-violet-500/15 text-violet-300'
                  : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:border-slate-600'
              }`}
            >
              Alle
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setFilterTag(tag === filterTag ? '' : tag)}
                className={`px-2 py-0.5 rounded-full text-xs border font-mono transition-colors ${
                  filterTag === tag
                    ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
                    : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Cards grouped by delegation or empty state */}
        {filtered.length === 0 ? (
          <EmptyState
            title="Keine Wissenskarten gefunden"
            description={
              searchQuery || filterTag
                ? 'Keine Karten für diese Suche. Suchbegriff oder Filter anpassen.'
                : 'Noch keine Wissenskarten. Delegationen ausführen um Wissen zu generieren.'
            }
            action={
              (searchQuery || filterTag) ? (
                <button
                  onClick={() => { setFilterTag(''); setSearchQuery('') }}
                  className={buttonClassName('secondary')}
                >
                  Filter zurücksetzen
                </button>
              ) : (
                <Link href="/delegations" className={buttonClassName('primary')}>
                  Zu den Delegations
                </Link>
              )
            }
          />
        ) : (
          <div className="space-y-6">
            {Array.from(grouped.entries()).map(([sourceId, groupCards]) => (
              <DelegationGroup
                key={sourceId}
                sourceId={sourceId}
                cards={groupCards}
                formatDate={formatDate}
                onDelete={handleDelete}
                onPatch={handlePatch}
              />
            ))}
          </div>
        )}

        {/* Back link */}
        <div className="mt-8">
          <Link href="/" className="text-sm text-slate-500 transition-colors hover:text-slate-300">
            ← Zurück zum Command Center
          </Link>
        </div>
      </main>
    </div>
  )
}

function DelegationGroup({
  sourceId,
  cards,
  formatDate,
  onDelete,
  onPatch,
}: {
  sourceId: string
  cards: KnowledgeCard[]
  formatDate: (iso: string) => string
  onDelete: (id: string) => Promise<boolean>
  onPatch: (id: string, patch: Partial<Pick<KnowledgeCard, 'title' | 'content' | 'tags'>>) => Promise<boolean>
}) {
  const newest = cards[0]

  return (
    <section>
      {/* Group header — links to delegation detail */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
          <Link
            href={`/delegations/${sourceId}`}
            className="text-sm font-semibold text-slate-300 hover:text-white transition-colors"
            title={`Delegation ${sourceId} öffnen`}
          >
            {newest.title || `Delegation ${sourceId.slice(-8)}`}
          </Link>
          <span className="text-xs text-slate-600 font-mono">{sourceId.slice(-8)}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-600">{cards.length} Lektion{cards.length !== 1 ? 'en' : ''}</span>
          <Link
            href={`/delegations/${sourceId}`}
            className="text-xs text-emerald-600 hover:text-emerald-400 transition-colors"
          >
            Delegation öffnen →
          </Link>
        </div>
      </div>

      <Panel>
        <div className="divide-y divide-slate-800">
          {cards.map(card => (
            <KnowledgeCardRow
              key={card.id}
              card={card}
              formatDate={formatDate}
              onDelete={onDelete}
              onPatch={onPatch}
            />
          ))}
        </div>
      </Panel>
    </section>
  )
}

function KnowledgeCardRow({
  card,
  formatDate,
  onDelete,
  onPatch,
}: {
  card: KnowledgeCard
  formatDate: (iso: string) => string
  onDelete: (id: string) => Promise<boolean>
  onPatch: (id: string, patch: Partial<Pick<KnowledgeCard, 'title' | 'content' | 'tags'>>) => Promise<boolean>
}) {
  const [editing, setEditing]     = useState(false)
  const [editTitle, setEditTitle] = useState(card.title)
  const [editBody, setEditBody]   = useState(card.content)
  const [editTags, setEditTags]   = useState(card.tags.join(', '))
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const tags = editTags.split(',').map(t => t.trim()).filter(Boolean)
    const ok = await onPatch(card.id, { title: editTitle.trim(), content: editBody.trim(), tags })
    setSaving(false)
    if (ok) setEditing(false)
  }

  const handleDelete = async () => {
    setDeleting(true)
    const ok = await onDelete(card.id)
    if (!ok) setDeleting(false)
  }

  if (editing) {
    return (
      <article className="px-5 py-5 space-y-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500">Titel</label>
          <input
            type="text"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            maxLength={200}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white focus:border-violet-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500">Inhalt (Markdown)</label>
          <textarea
            value={editBody}
            onChange={e => setEditBody(e.target.value)}
            rows={6}
            maxLength={10_000}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs font-mono text-slate-200 focus:border-violet-500 focus:outline-none resize-y"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500">Tags (kommagetrennt)</label>
          <input
            type="text"
            value={editTags}
            onChange={e => setEditTags(e.target.value)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-white focus:border-violet-500 focus:outline-none"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => void handleSave()}
            disabled={saving || !editTitle.trim() || !editBody.trim()}
            className="rounded bg-violet-600 px-3 py-1 text-xs text-white hover:bg-violet-500 disabled:opacity-40 transition-colors"
          >
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
          <button
            onClick={() => {
              setEditing(false)
              setEditTitle(card.title)
              setEditBody(card.content)
              setEditTags(card.tags.join(', '))
            }}
            className="rounded border border-slate-700 px-3 py-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            Abbrechen
          </button>
        </div>
      </article>
    )
  }

  return (
    <article className="group px-5 py-5">
      {/* Title + date + actions row */}
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-sm font-semibold leading-snug text-white">
          {card.title}
        </h2>
        <div className="flex shrink-0 items-center gap-3">
          <time
            dateTime={card.createdAt}
            className="text-xs text-slate-500"
            title={formatDate(card.createdAt)}
          >
            {formatDate(card.createdAt)}
          </time>
          {/* Action buttons — visible on hover */}
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={() => setEditing(true)}
              aria-label="Lektion bearbeiten"
              className="rounded px-1.5 py-0.5 text-[10px] text-slate-500 hover:bg-slate-800 hover:text-violet-400 transition-colors"
            >
              Bearbeiten
            </button>
            <button
              onClick={() => void handleDelete()}
              disabled={deleting}
              aria-label="Lektion löschen"
              className="rounded px-1.5 py-0.5 text-[10px] text-slate-500 hover:bg-slate-800 hover:text-red-400 disabled:opacity-40 transition-colors"
            >
              {deleting ? '…' : 'Löschen'}
            </button>
          </div>
        </div>
      </div>

      {/* Tag chips */}
      {card.tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {card.tags.map(tag => (
            <Badge key={tag} tone="neutral">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Content excerpt */}
      <p className="text-xs leading-relaxed text-slate-300 whitespace-pre-line">
        {excerpt(card.content)}
      </p>

      {/* PR link + brief meta */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        {card.briefId && (
          <span>
            Brief{' '}
            <Link
              href={`/project-briefs/${card.briefId}`}
              className="font-mono text-violet-400 transition-colors hover:text-violet-300"
            >
              {card.briefId.slice(-8)}
            </Link>
          </span>
        )}
        {card.prUrl && (
          <a
            href={card.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-400 transition-colors hover:text-sky-300"
          >
            PR öffnen →
          </a>
        )}
      </div>
    </article>
  )
}
