'use client'

import { useEffect, useState } from 'react'

interface CriticalPathIssue {
  id: string
  title: string
  status: string
}

interface SprintStatus {
  sprintName: string
  done: number
  total: number
  inProgress: CriticalPathIssue[]
  percent: number
}

type LoadState = 'loading' | 'loaded' | 'error'

export function SprintWidget() {
  const [data, setData] = useState<SprintStatus | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/sprint-status')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as SprintStatus
        if (!cancelled) {
          setData(json)
          setLoadState('loaded')
        }
      } catch {
        if (!cancelled) setLoadState('error')
      }
    }

    void load()
    return () => { cancelled = true }
  }, [])

  if (loadState === 'loading') {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/3 mb-3" />
        <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded w-full mb-2" />
        <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/2" />
      </div>
    )
  }

  if (loadState === 'error' || !data) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
        <p className="text-sm text-red-600 dark:text-red-400">
          Sprint-Daten konnten nicht geladen werden.
        </p>
      </div>
    )
  }

  const progressPercent = Math.min(100, Math.max(0, data.percent))

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
          {data.sprintName}
        </h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {data.done}/{data.total} Tickets
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
        <div
          className="bg-green-500 h-2 rounded-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
          aria-label={`${progressPercent}% abgeschlossen`}
        />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {progressPercent}% abgeschlossen
      </p>

      {/* In-progress tickets */}
      {data.inProgress.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            In Bearbeitung
          </p>
          <ul className="space-y-1">
            {data.inProgress.slice(0, 5).map(issue => (
              <li
                key={issue.id}
                className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400"
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                <span className="font-mono text-blue-600 dark:text-blue-400">{issue.id}</span>
                <span className="truncate">{issue.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.inProgress.length === 0 && data.total > 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">
          Kein Ticket in Bearbeitung.
        </p>
      )}
    </div>
  )
}
