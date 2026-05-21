'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { FileText, ListChecks, CheckSquare, BookOpen, Search, Loader2 } from 'lucide-react'
import type { SearchResult } from '@/app/api/search/route'

// ── Type config ──────────────────────────────────────────────────

type ResultType = SearchResult['type']

const TYPE_CONFIG: Record<ResultType, {
  label: string
  icon: React.ElementType
  colorClass: string
  badgeClass: string
}> = {
  brief: {
    label: 'Project Brief',
    icon: FileText,
    colorClass: 'text-sky-400',
    badgeClass: 'bg-sky-900/40 text-sky-300 border-sky-800/50',
  },
  delegation: {
    label: 'Delegation',
    icon: ListChecks,
    colorClass: 'text-emerald-400',
    badgeClass: 'bg-emerald-900/40 text-emerald-300 border-emerald-800/50',
  },
  workitem: {
    label: 'Work Item',
    icon: CheckSquare,
    colorClass: 'text-amber-400',
    badgeClass: 'bg-amber-900/40 text-amber-300 border-amber-800/50',
  },
  knowledge: {
    label: 'Knowledge Card',
    icon: BookOpen,
    colorClass: 'text-violet-400',
    badgeClass: 'bg-violet-900/40 text-violet-300 border-violet-800/50',
  },
}

const TYPE_ORDER: ResultType[] = ['brief', 'delegation', 'workitem', 'knowledge']

// ── Search Content ───────────────────────────────────────────────

function SearchContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialQuery = searchParams.get('q') ?? ''

  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([])
      setHasSearched(false)
      return
    }

    setLoading(true)
    setError(null)
    setHasSearched(true)

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        setError(body.error ?? 'Suchfehler')
        setResults([])
      } else {
        const data = await res.json() as { results: SearchResult[] }
        setResults(data.results)
      }
    } catch {
      setError('Verbindungsfehler')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Sync URL when query changes
  useEffect(() => {
    const q = query.trim()
    if (q.length >= 2) {
      router.replace(q ? `/search?q=${encodeURIComponent(q)}` : '/search', { scroll: false })
    } else {
      router.replace('/search', { scroll: false })
    }
  }, [query, router])

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => { void doSearch(query) }, 300)
    return () => clearTimeout(id)
  }, [query, doSearch])

  // Trigger initial search if query in URL
  useEffect(() => {
    if (initialQuery.length >= 2) {
      void doSearch(initialQuery)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Group results by type, in defined order
  const grouped = TYPE_ORDER
    .map(type => ({
      type,
      items: results.filter(r => r.type === type),
    }))
    .filter(g => g.items.length > 0)

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-4xl p-6">
        {/* Header */}
        <header className="mb-8 mt-2 border-b border-slate-800 pb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Global Search</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Suche</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Durchsuche Briefs, Delegationen, Work Items und Knowledge Cards.
          </p>
        </header>

        {/* Search input */}
        <div className="relative mb-8">
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
              : <Search className="h-4 w-4 text-slate-500" />
            }
          </div>
          <input
            type="text"
            autoFocus
            placeholder="Suchbegriff eingeben…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-800/60 py-3 pl-10 pr-4 text-base text-white placeholder-slate-500 outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600/30 transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute inset-y-0 right-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        {/* States */}
        {error && (
          <div className="rounded-lg border border-red-800/50 bg-red-900/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {!hasSearched && !loading && (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <Search className="h-12 w-12 text-slate-700" strokeWidth={1} />
            <p className="text-base text-slate-500">Gib einen Suchbegriff ein</p>
            <p className="text-sm text-slate-600">Mindestens 2 Zeichen, sucht in Briefs, Delegationen, Work Items und Knowledge Cards.</p>
          </div>
        )}

        {hasSearched && !loading && results.length === 0 && !error && (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <Search className="h-12 w-12 text-slate-700" strokeWidth={1} />
            <p className="text-base text-slate-500">Keine Ergebnisse für &ldquo;{query}&rdquo;</p>
          </div>
        )}

        {/* Results — grouped by type */}
        {grouped.length > 0 && (
          <div className="space-y-8">
            {/* Summary count */}
            <p className="text-xs text-slate-500">
              <span className="font-semibold text-white">{results.length}</span> Ergebnis{results.length !== 1 ? 'se' : ''} für &ldquo;{query}&rdquo;
            </p>

            {grouped.map(({ type, items }) => {
              const config = TYPE_CONFIG[type]
              const Icon = config.icon
              return (
                <section key={type}>
                  {/* Section header */}
                  <div className="mb-3 flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${config.colorClass}`} strokeWidth={1.75} />
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                      {config.label}s
                    </h2>
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                      {items.length}
                    </span>
                  </div>

                  {/* Result cards */}
                  <div className="space-y-2">
                    {items.map(result => (
                      <Link
                        key={result.id}
                        href={result.href}
                        className="group block rounded-xl border border-slate-800 bg-slate-900 p-4 transition-all duration-150 hover:border-slate-600 hover:bg-slate-800/60 hover:shadow-md hover:shadow-black/20"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${config.badgeClass}`}>
                                {config.label}
                              </span>
                            </div>
                            <p className="text-sm font-semibold leading-snug text-white group-hover:text-sky-100 transition-colors">
                              {result.title}
                            </p>
                            {result.excerpt && (
                              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">
                                {result.excerpt}
                              </p>
                            )}
                          </div>
                          <span className="shrink-0 text-slate-600 group-hover:text-slate-400 transition-colors text-sm">→</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}

// ── Page with Suspense (required for useSearchParams) ────────────

export default function SearchPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-slate-950 text-white p-6">
        <div className="mx-auto max-w-4xl space-y-4 mt-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-xl border border-slate-800 bg-slate-900 animate-pulse" />
          ))}
        </div>
      </main>
    }>
      <SearchContent />
    </Suspense>
  )
}
