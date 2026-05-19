'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { KnowledgeSource, MemoryCard, MemoryCardType, SourceType } from '@/lib/knowledge/types'
import { Badge, EmptyState, StatusDot, cx } from '@/components/ui/primitives'

interface IndexResult {
  sourcesIndexed: number
  itemsIndexed: number
  cardsCreated: number
  skipped: number
  sensitiveSkipped: number
  errors: string[]
}

// ─── helpers ────────────────────────────────────────────────────

function privacyTone(p: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (p === 'public') return 'success'
  if (p === 'internal') return 'neutral'
  if (p === 'sensitive') return 'warning'
  if (p === 'local-only') return 'danger'
  return 'neutral'
}

function confidenceColor(c: string): string {
  if (c === 'high') return 'text-emerald-400'
  if (c === 'medium') return 'text-amber-300'
  return 'text-slate-500'
}

function cardTypeBadgeColor(t: MemoryCardType): string {
  const map: Record<MemoryCardType, string> = {
    decision:    'bg-sky-900/40 text-sky-300 border-sky-800/50',
    learning:    'bg-emerald-900/40 text-emerald-300 border-emerald-800/50',
    pattern:     'bg-violet-900/40 text-violet-300 border-violet-800/50',
    risk:        'bg-red-900/40 text-red-300 border-red-800/50',
    requirement: 'bg-amber-900/40 text-amber-300 border-amber-800/50',
    context:     'bg-slate-800 text-slate-400 border-slate-700',
  }
  return map[t] ?? 'bg-slate-800 text-slate-400 border-slate-700'
}

function sourceTypeLabel(t: SourceType): string {
  const map: Record<SourceType, string> = {
    nas:         'NAS',
    markdown:    'Markdown',
    linear:      'Linear',
    github:      'GitHub',
    'agent-run': 'Agent Run',
    obsidian:    'Obsidian',
    manual:      'Manual',
  }
  return map[t] ?? t
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function formatRelativeDate(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60_000)
  const diffH = Math.floor(diffMs / 3_600_000)
  const diffD = Math.floor(diffMs / 86_400_000)
  if (diffMin < 2) return 'gerade eben'
  if (diffMin < 60) return `vor ${diffMin} Min.`
  if (diffH < 24) return `vor ${diffH} Std.`
  if (diffD === 1) return 'gestern'
  if (diffD < 30) return `vor ${diffD} Tagen`
  return formatDate(iso)
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}

/** Derive a short source label from a MemoryCard's projectId / sourceIds count */
function sourceBadgeLabel(card: MemoryCard): string {
  if (card.projectId) return `#${card.projectId.slice(-8)}`
  if (card.sourceIds.length > 0) return `${card.sourceIds.length} Quelle${card.sourceIds.length > 1 ? 'n' : ''}`
  return 'manual'
}

// ─── debounce hook ───────────────────────────────────────────────

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

// ─── tabs ────────────────────────────────────────────────────────

type Tab = 'cards' | 'sources'

// ─── page ────────────────────────────────────────────────────────

export default function KnowledgeCenterPage() {
  const [tab, setTab] = useState<Tab>('cards')
  const [cards, setCards] = useState<MemoryCard[]>([])
  const [sources, setSources] = useState<KnowledgeSource[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<MemoryCardType | ''>('')
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)
  const [indexing, setIndexing] = useState(false)
  const [indexResult, setIndexResult] = useState<IndexResult | null>(null)

  const debouncedSearch = useDebounced(search, 300)

  const loadData = useCallback(() => {
    return Promise.all([
      fetch('/api/knowledge/cards').then(r => r.json()) as Promise<MemoryCard[]>,
      fetch('/api/knowledge/sources').then(r => r.json()) as Promise<KnowledgeSource[]>,
    ])
      .then(([c, s]) => {
        setCards(Array.isArray(c) ? c : [])
        setSources(Array.isArray(s) ? s : [])
      })
      .catch(() => { setCards([]); setSources([]) })
  }, [])

  useEffect(() => {
    loadData().finally(() => setLoading(false))
  }, [loadData])

  const handleIndexNas = async () => {
    setIndexing(true)
    setIndexResult(null)
    try {
      const res = await fetch('/api/knowledge/index-nas', { method: 'POST' })
      const data = await res.json() as IndexResult
      setIndexResult(data)
      await loadData()
    } catch {
      setIndexResult({ sourcesIndexed: 0, itemsIndexed: 0, cardsCreated: 0, skipped: 0, sensitiveSkipped: 0, errors: ['Verbindungsfehler'] })
    } finally {
      setIndexing(false)
    }
  }

  // All unique tags across all cards, sorted
  const allTags = Array.from(new Set(cards.flatMap(c => c.tags))).sort()

  const searchLower = debouncedSearch.toLowerCase().trim()
  const filteredCards = cards
    .filter(c => !typeFilter || c.type === typeFilter)
    .filter(c => activeTags.length === 0 || activeTags.every(tag => c.tags.includes(tag)))
    .filter(c => !searchLower || (
      c.title.toLowerCase().includes(searchLower) ||
      c.body.toLowerCase().includes(searchLower) ||
      c.tags.some(t => t.toLowerCase().includes(searchLower))
    ))

  const staleCount = sources.filter(s => s.isStale).length

  const toggleTag = (tag: string) => {
    setActiveTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const clearTags = () => setActiveTags([])

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl p-6">
        <header className="mb-8 mt-2 border-b border-slate-800 pb-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Knowledge</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Knowledge Center</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Kuratierte Memory Cards, Quellen und Kontext-Signale fuer Agenten. NAS-Importe laufen mit Privacy Guardrails.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                onClick={handleIndexNas}
                disabled={indexing}
                className={cx(
                  'rounded-lg px-4 py-2 text-xs font-semibold transition-colors',
                  indexing ? 'bg-slate-700 text-slate-400' : 'bg-sky-600 text-white hover:bg-sky-500'
                )}
              >
                {indexing ? 'Indiziere NAS…' : 'NAS indizieren'}
              </button>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>{cards.length} Cards</span>
                <span>&middot;</span>
                <span>{sources.length} Quellen</span>
                {staleCount > 0 && (
                  <>
                    <span>&middot;</span>
                    <span className="text-amber-400">{staleCount} veraltet</span>
                  </>
                )}
              </div>
            </div>
          </div>
          {indexResult && (
            <div className={cx(
              'mt-3 rounded-lg border px-4 py-2 text-xs',
              indexResult.errors.length > 0
                ? 'border-red-800/50 bg-red-900/10 text-red-400'
                : 'border-emerald-800/50 bg-emerald-900/10 text-emerald-400'
            )}>
              {indexResult.errors.length > 0
                ? indexResult.errors[0]
                : `${indexResult.sourcesIndexed} Quellen · ${indexResult.itemsIndexed} Items · ${indexResult.cardsCreated} Cards erstellt · ${indexResult.skipped} unverändert · ${indexResult.sensitiveSkipped} sensitive übersprungen`
              }
            </div>
          )}
        </header>

        <section className="mb-6 grid gap-3 md:grid-cols-4">
          <KnowledgeMetric label="Memory Cards" value={cards.length} detail="kuratierte Agenten-Erinnerungen" />
          <KnowledgeMetric label="Quellen" value={sources.length} detail="registrierte Wissensquellen" />
          <KnowledgeMetric label="Veraltet" value={staleCount} detail="brauchen Refresh" tone={staleCount > 0 ? 'warn' : 'neutral'} />
          <KnowledgeMetric label="Privacy Guard" value={indexResult?.sensitiveSkipped ?? 0} detail="sensitive Dateien übersprungen" tone="good" />
        </section>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 border-b border-slate-800">
          {(['cards', 'sources'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cx(
                'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                tab === t ? 'border-sky-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'
              )}
            >
              {t === 'cards' ? `Memory Cards (${cards.length})` : `Quellen (${sources.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Lade Knowledge Center…</p>
        ) : tab === 'cards' ? (
          <CardsTab
            cards={filteredCards}
            allCards={cards}
            allTags={allTags}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            activeTags={activeTags}
            toggleTag={toggleTag}
            clearTags={clearTags}
            search={search}
            setSearch={setSearch}
            expandedCardId={expandedCardId}
            setExpandedCardId={setExpandedCardId}
          />
        ) : (
          <SourcesTab sources={sources} />
        )}
      </div>
    </main>
  )
}

function KnowledgeMetric({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string
  value: number
  detail: string
  tone?: 'neutral' | 'good' | 'warn'
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cx(
        'mt-2 text-2xl font-semibold',
        tone === 'good' ? 'text-emerald-300' : tone === 'warn' ? 'text-amber-300' : 'text-white'
      )}>
        {value}
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  )
}

// ─── cards tab ───────────────────────────────────────────────────

const CARD_TYPES: MemoryCardType[] = ['decision', 'learning', 'pattern', 'risk', 'requirement', 'context']

function CardsTab({
  cards,
  allCards,
  allTags,
  typeFilter,
  setTypeFilter,
  activeTags,
  toggleTag,
  clearTags,
  search,
  setSearch,
  expandedCardId,
  setExpandedCardId,
}: {
  cards: MemoryCard[]
  allCards: MemoryCard[]
  allTags: string[]
  typeFilter: MemoryCardType | ''
  setTypeFilter: (v: MemoryCardType | '') => void
  activeTags: string[]
  toggleTag: (tag: string) => void
  clearTags: () => void
  search: string
  setSearch: (v: string) => void
  expandedCardId: string | null
  setExpandedCardId: (id: string | null) => void
}) {
  if (allCards.length === 0) {
    return (
      <EmptyState
        title="Noch keine Knowledge Cards"
        description="Knowledge Cards werden automatisch nach jedem Orchestration-Run erstellt."
        icon={<span className="text-2xl" aria-hidden="true">&#x1F4DA;</span>}
        action={
          <Link
            href="/delegations"
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-700/50 bg-sky-900/20 px-4 py-2 text-sm font-semibold text-sky-300 transition-colors hover:bg-sky-900/40 hover:text-sky-200"
          >
            Erste Orchestration starten &rarr;
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Knowledge durchsuchen…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600/30"
        />
      </div>

      {/* Type filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Typ:</span>
        <button
          onClick={() => setTypeFilter('')}
          className={cx(
            'rounded-full px-3 py-1 text-xs font-medium transition-colors',
            typeFilter === '' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
          )}
        >
          Alle ({allCards.length})
        </button>
        {CARD_TYPES.map(t => {
          const count = allCards.filter(c => c.type === t).length
          if (count === 0) return null
          return (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cx(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                typeFilter === t ? cardTypeBadgeColor(t) : 'border-transparent text-slate-500 hover:text-slate-300'
              )}
            >
              {t} ({count})
            </button>
          )
        })}
      </div>

      {/* Tag filter chips */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Tags:</span>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={cx(
                'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
                activeTags.includes(tag)
                  ? 'border-sky-600/60 bg-sky-900/30 text-sky-300'
                  : 'border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300'
              )}
            >
              {tag}
            </button>
          ))}
          {activeTags.length > 0 && (
            <button
              onClick={clearTags}
              className="ml-1 text-xs text-slate-600 underline hover:text-slate-400"
            >
              zur&uuml;cksetzen
            </button>
          )}
        </div>
      )}

      {cards.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-500">Keine Cards f&uuml;r diese Suche.</p>
      )}

      {/* Card grid */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(card => (
          <KnowledgeCard
            key={card.id}
            card={card}
            expanded={expandedCardId === card.id}
            onToggle={() => setExpandedCardId(expandedCardId === card.id ? null : card.id)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── individual card ─────────────────────────────────────────────

function KnowledgeCard({
  card,
  expanded,
  onToggle,
}: {
  card: MemoryCard
  expanded: boolean
  onToggle: () => void
}) {
  const bodyPreview = truncate(card.body, 120)

  return (
    <button
      onClick={onToggle}
      className={cx(
        'group w-full rounded-xl border p-4 text-left transition-all duration-200',
        expanded
          ? 'border-sky-700/60 bg-sky-900/10 shadow-lg shadow-sky-900/10'
          : 'border-slate-800 bg-slate-900 hover:border-slate-600 hover:bg-slate-800/60 hover:shadow-md hover:shadow-black/20',
        'cursor-pointer'
      )}
    >
      {/* Row 1: type badge + source badge + privacy dot */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cx('rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide', cardTypeBadgeColor(card.type))}>
            {card.type}
          </span>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400">
            {sourceBadgeLabel(card)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cx('text-[10px] font-medium', confidenceColor(card.confidence))}>
            {card.confidence}
          </span>
          <StatusDot tone={privacyTone(card.privacyClass)} />
        </div>
      </div>

      {/* Row 2: title */}
      <p className="text-sm font-semibold leading-snug text-white">{card.title}</p>

      {/* Row 3: body preview or full body when expanded */}
      <p className={cx(
        'mt-1.5 text-xs leading-relaxed text-slate-400',
        expanded ? '' : 'line-clamp-3'
      )}>
        {expanded ? card.body : bodyPreview}
      </p>

      {/* Row 4 (expanded only): metadata */}
      {expanded && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-slate-800 pt-3 text-xs">
          <div>
            <dt className="text-slate-600">Privacy</dt>
            <dd className="text-slate-300">{card.privacyClass}</dd>
          </div>
          <div>
            <dt className="text-slate-600">Quellen</dt>
            <dd className="text-slate-300">{card.sourceIds.length}</dd>
          </div>
          {card.projectId && (
            <div className="col-span-2">
              <dt className="text-slate-600">Projekt</dt>
              <dd className="truncate font-mono text-slate-300">{card.projectId}</dd>
            </div>
          )}
        </dl>
      )}

      {/* Row 5: tags + date */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {card.tags.slice(0, expanded ? undefined : 4).map(tag => (
            <Badge key={tag}>{tag}</Badge>
          ))}
          {!expanded && card.tags.length > 4 && (
            <span className="text-[10px] text-slate-600">+{card.tags.length - 4}</span>
          )}
        </div>
        <time
          dateTime={card.createdAt}
          className="shrink-0 text-[10px] text-slate-600"
          title={formatDate(card.createdAt)}
        >
          {formatRelativeDate(card.createdAt)}
        </time>
      </div>
    </button>
  )
}

// ─── sources tab ─────────────────────────────────────────────────

function SourcesTab({ sources }: { sources: KnowledgeSource[] }) {
  if (sources.length === 0) {
    return (
      <EmptyState
        title="Noch keine Quellen registriert"
        description="Quellen werden beim ersten Indexierungs-Lauf automatisch angelegt (NAS, GitHub, Linear, Markdown-Files)."
      />
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Typ</th>
            <th className="hidden px-4 py-3 sm:table-cell">Privacy</th>
            <th className="hidden px-4 py-3 md:table-cell">Zuletzt geholt</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {sources.map(src => (
            <tr key={src.id} className="hover:bg-slate-800/30">
              <td className="px-4 py-3">
                <p className="font-medium text-white">{src.name}</p>
                <p className="mt-0.5 truncate font-mono text-xs text-slate-600">{src.path}</p>
              </td>
              <td className="px-4 py-3">
                <Badge>{sourceTypeLabel(src.type)}</Badge>
              </td>
              <td className="hidden px-4 py-3 text-xs text-slate-400 sm:table-cell">{src.privacyClass}</td>
              <td className="hidden px-4 py-3 text-xs text-slate-400 md:table-cell">{formatDate(src.lastFetched)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <StatusDot tone={src.isStale ? 'warning' : 'success'} />
                  <span className={cx('text-xs', src.isStale ? 'text-amber-400' : 'text-slate-500')}>
                    {src.isStale ? 'Veraltet' : 'Aktuell'}
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
