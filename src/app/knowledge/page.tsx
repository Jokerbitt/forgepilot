'use client'

import { useEffect, useState, useCallback } from 'react'
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
    decision: 'bg-sky-900/40 text-sky-300 border-sky-800/50',
    learning: 'bg-emerald-900/40 text-emerald-300 border-emerald-800/50',
    pattern:  'bg-violet-900/40 text-violet-300 border-violet-800/50',
    risk:     'bg-red-900/40 text-red-300 border-red-800/50',
    requirement: 'bg-amber-900/40 text-amber-300 border-amber-800/50',
    context:  'bg-slate-800 text-slate-400 border-slate-700',
  }
  return map[t] ?? 'bg-slate-800 text-slate-400 border-slate-700'
}

function sourceTypeLabel(t: SourceType): string {
  const map: Record<SourceType, string> = {
    nas: 'NAS', markdown: 'Markdown', linear: 'Linear', github: 'GitHub',
    'agent-run': 'Agent Run', obsidian: 'Obsidian', manual: 'Manual',
  }
  return map[t] ?? t
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// ─── tabs ────────────────────────────────────────────────────────

type Tab = 'cards' | 'sources'

// ─── page ────────────────────────────────────────────────────────

export default function KnowledgeCenterPage() {
  const [tab, setTab] = useState<Tab>('cards')
  const [cards, setCards] = useState<MemoryCard[]>([])
  const [sources, setSources] = useState<KnowledgeSource[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<MemoryCardType | ''>('')
  const [search, setSearch] = useState('')
  const [selectedCard, setSelectedCard] = useState<MemoryCard | null>(null)
  const [indexing, setIndexing] = useState(false)
  const [indexResult, setIndexResult] = useState<IndexResult | null>(null)

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

  const searchLower = search.toLowerCase().trim()
  const filteredCards = cards
    .filter(c => !filter || c.type === filter)
    .filter(c => !searchLower || (
      c.title.toLowerCase().includes(searchLower) ||
      c.body.toLowerCase().includes(searchLower) ||
      c.tags.some(t => t.toLowerCase().includes(searchLower))
    ))
  const staleCount = sources.filter(s => s.isStale).length

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
                <span>·</span>
                <span>{sources.length} Quellen</span>
                {staleCount > 0 && (
                  <>
                    <span>·</span>
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
            filter={filter}
            setFilter={setFilter}
            search={search}
            setSearch={setSearch}
            selectedCard={selectedCard}
            setSelectedCard={setSelectedCard}
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
  cards, allCards, filter, setFilter, search, setSearch, selectedCard, setSelectedCard,
}: {
  cards: MemoryCard[]
  allCards: MemoryCard[]
  filter: MemoryCardType | ''
  setFilter: (v: MemoryCardType | '') => void
  search: string
  setSearch: (v: string) => void
  selectedCard: MemoryCard | null
  setSelectedCard: (c: MemoryCard | null) => void
}) {
  if (allCards.length === 0) {
    return (
      <EmptyState
        title="Noch keine Memory Cards"
        description='Klicke "NAS indizieren" um alle NAS-Dokumente als Memory Cards zu importieren, oder erstelle Cards manuell über die API.'
      />
    )
  }

  return (
    <div className="flex gap-4">
      {/* List */}
      <div className={cx('flex-1 min-w-0', selectedCard ? 'hidden sm:block sm:w-1/2 sm:flex-none' : '')}>
        {/* Search */}
        <div className="mb-3">
          <input
            type="text"
            placeholder="Suchen…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-sky-600"
          />
        </div>
        {/* Type filter */}
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('')}
            className={cx('rounded-full px-3 py-1 text-xs font-medium transition-colors', filter === '' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300')}
          >
            Alle ({allCards.length})
          </button>
          {CARD_TYPES.map(t => {
            const count = allCards.filter(c => c.type === t).length
            if (count === 0) return null
            return (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={cx('rounded-full border px-3 py-1 text-xs font-medium transition-colors', filter === t ? cardTypeBadgeColor(t) : 'border-transparent text-slate-500 hover:text-slate-300')}
              >
                {t} ({count})
              </button>
            )
          })}
        </div>

        {cards.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">Keine Cards für diese Suche.</p>
        )}
        <div className="space-y-2">
          {cards.map(card => (
            <button
              key={card.id}
              onClick={() => setSelectedCard(selectedCard?.id === card.id ? null : card)}
              className={cx(
                'w-full rounded-xl border p-4 text-left transition-all',
                selectedCard?.id === card.id
                  ? 'border-sky-700/60 bg-sky-900/10'
                  : 'border-slate-800 bg-slate-900 hover:border-slate-700'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className={cx('rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide', cardTypeBadgeColor(card.type))}>
                      {card.type}
                    </span>
                    <span className={cx('text-xs font-medium', confidenceColor(card.confidence))}>
                      {card.confidence}
                    </span>
                  </div>
                  <p className="truncate text-sm font-medium text-white">{card.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{card.body}</p>
                </div>
                <div className="shrink-0">
                  <StatusDot tone={privacyTone(card.privacyClass)} />
                </div>
              </div>
              {card.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {card.tags.slice(0, 4).map(tag => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      {selectedCard && (
        <div className="w-full sm:w-80 sm:flex-none">
          <div className="sticky top-20 rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <span className={cx('rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide', cardTypeBadgeColor(selectedCard.type))}>
                {selectedCard.type}
              </span>
              <button onClick={() => setSelectedCard(null)} className="text-slate-600 hover:text-slate-300">✕</button>
            </div>
            <h3 className="mb-2 text-sm font-semibold leading-snug text-white">{selectedCard.title}</h3>
            <p className="mb-4 text-xs leading-relaxed text-slate-400">{selectedCard.body}</p>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between">
                <dt className="text-slate-500">Confidence</dt>
                <dd className={confidenceColor(selectedCard.confidence)}>{selectedCard.confidence}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Privacy</dt>
                <dd className="text-slate-300">{selectedCard.privacyClass}</dd>
              </div>
              {selectedCard.projectId && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Projekt</dt>
                  <dd className="truncate font-mono text-slate-300">{selectedCard.projectId}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-slate-500">Erstellt</dt>
                <dd className="text-slate-400">{formatDate(selectedCard.createdAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Quellen</dt>
                <dd className="text-slate-400">{selectedCard.sourceIds.length}</dd>
              </div>
            </dl>
            {selectedCard.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {selectedCard.tags.map(tag => <Badge key={tag}>{tag}</Badge>)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
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
