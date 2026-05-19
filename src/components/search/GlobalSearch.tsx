'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, FileText, ListChecks, CheckSquare, BookOpen, Loader2, X } from 'lucide-react'
import type { SearchResult } from '@/app/api/search/route'

type ResultType = SearchResult['type']

const TYPE_ICON: Record<ResultType, React.ElementType> = {
  brief: FileText,
  delegation: ListChecks,
  workitem: CheckSquare,
  knowledge: BookOpen,
}

const TYPE_COLOR: Record<ResultType, string> = {
  brief: 'text-sky-400',
  delegation: 'text-emerald-400',
  workitem: 'text-amber-400',
  knowledge: 'text-violet-400',
}

const TYPE_LABEL: Record<ResultType, string> = {
  brief: 'Brief',
  delegation: 'Delegation',
  workitem: 'Work Item',
  knowledge: 'Knowledge',
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

export function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const debouncedQuery = useDebounced(query, 300)

  // Cmd+K / Ctrl+K listener
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSelectedIdx(0)
      // Small delay to ensure the modal is rendered
      setTimeout(() => { inputRef.current?.focus() }, 50)
    }
  }, [open])

  // Fetch results when debounced query changes
  const fetchResults = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
      if (res.ok) {
        const data = await res.json() as { results: SearchResult[] }
        setResults(data.results.slice(0, 10))
        setSelectedIdx(0)
      } else {
        setResults([])
      }
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchResults(debouncedQuery)
  }, [debouncedQuery, fetchResults])

  const navigate = useCallback((url: string) => {
    setOpen(false)
    router.push(url)
  }, [router])

  // Navigate to full search page
  const openFullSearch = useCallback(() => {
    setOpen(false)
    if (query.trim().length >= 2) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`)
    } else {
      router.push('/search')
    }
  }, [router, query])

  // Keyboard navigation within modal
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results.length > 0 && results[selectedIdx]) {
        navigate(results[selectedIdx].url)
      } else if (query.trim().length >= 2) {
        openFullSearch()
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed left-1/2 top-[20%] z-50 w-full max-w-xl -translate-x-1/2"
        role="dialog"
        aria-modal="true"
        aria-label="Globale Suche"
      >
        <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/60">
          {/* Input */}
          <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
            {loading
              ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-500" />
              : <Search className="h-4 w-4 shrink-0 text-slate-500" />
            }
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Suche in Briefs, Delegationen, Work Items, Knowledge…"
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <button
                onClick={() => { setQuery(''); setResults([]) }}
                className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
                tabIndex={-1}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <kbd
              className="shrink-0 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-500"
            >
              Esc
            </kbd>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((result, idx) => {
                const Icon = TYPE_ICON[result.type]
                const color = TYPE_COLOR[result.type]
                const label = TYPE_LABEL[result.type]
                return (
                  <li key={result.id}>
                    <button
                      className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors ${
                        idx === selectedIdx
                          ? 'bg-slate-800/80 text-white'
                          : 'text-slate-300 hover:bg-slate-800/40 hover:text-white'
                      }`}
                      onClick={() => navigate(result.url)}
                      onMouseEnter={() => setSelectedIdx(idx)}
                    >
                      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${color}`} strokeWidth={1.75} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{result.title}</p>
                        {result.excerpt && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{result.excerpt}</p>
                        )}
                      </div>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${color} opacity-70`}>
                        {label}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {/* Empty / hint state */}
          {query.trim().length < 2 && (
            <div className="px-4 py-3 text-xs text-slate-600">
              Mindestens 2 Zeichen eingeben…
            </div>
          )}

          {query.trim().length >= 2 && !loading && results.length === 0 && (
            <div className="px-4 py-3 text-xs text-slate-500">
              Keine Ergebnisse für &ldquo;{query}&rdquo;
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-slate-800 px-4 py-2">
            <div className="flex items-center gap-3 text-[10px] text-slate-600">
              <span><kbd className="font-mono">↑↓</kbd> navigieren</span>
              <span><kbd className="font-mono">↵</kbd> öffnen</span>
            </div>
            <button
              onClick={openFullSearch}
              className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
            >
              Alle Ergebnisse →
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
