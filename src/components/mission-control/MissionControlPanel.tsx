'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { MissionControlData } from '@/app/api/mission-control/route'

const REFRESH_INTERVAL_MS = 30_000

function StatusIcon({ status }: { status: 'ok' | 'warn' | 'error' }) {
  if (status === 'ok') return <span className="text-green-400">✅</span>
  if (status === 'warn') return <span className="text-yellow-400">⚠️</span>
  return <span className="text-red-400">🔴</span>
}

function RiskBadge({ riskClass }: { riskClass: string }) {
  const colour =
    riskClass === 'C'
      ? 'bg-red-900 text-red-200'
      : riskClass === 'B'
        ? 'bg-yellow-900 text-yellow-200'
        : 'bg-gray-700 text-gray-300'
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${colour}`}>
      {riskClass}
    </span>
  )
}

interface PulseBoxProps {
  icon: string
  label: string
  value: number
}

function PulseBox({ icon, label, value }: PulseBoxProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg bg-gray-800 px-4 py-3 text-center">
      <span className="text-lg">{icon}</span>
      <span className="mt-1 text-2xl font-bold text-white">{value}</span>
      <span className="mt-0.5 text-xs text-gray-400">{label}</span>
    </div>
  )
}

export function MissionControlPanel() {
  const [data, setData] = useState<MissionControlData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/mission-control', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as MissionControlData
      setData(json)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
    const interval = setInterval(() => void fetchData(), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchData])

  if (loading) {
    return (
      <div className="mb-6 animate-pulse rounded-xl border border-gray-700 bg-gray-900 p-4 text-gray-500">
        Mission Control wird geladen…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mb-6 rounded-xl border border-red-800 bg-gray-900 p-4 text-red-400 text-sm">
        Mission Control nicht verfügbar: {error ?? 'Keine Daten'}
      </div>
    )
  }

  const { focus, pulse, health } = data

  return (
    <section aria-label="Mission Control" className="mb-6 rounded-xl border border-gray-700 bg-gray-900 overflow-hidden">
      {/* ── Nächste Aktion ── */}
      {focus.nextBestAction ? (
        <div className="flex flex-col gap-3 border-l-4 border-blue-500 bg-gray-900 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">🎯 Nächste Aktion</p>
            <p className="mt-0.5 text-base font-semibold text-white">{focus.nextBestAction.title}</p>
            <p className="mt-0.5 text-sm text-gray-400">{focus.nextBestAction.reason}</p>
          </div>
          <Link
            href={focus.nextBestAction.href}
            className="self-start rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors sm:self-auto sm:shrink-0"
          >
            → Öffnen
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-3 border-l-4 border-gray-600 bg-gray-900 px-5 py-4">
          <span className="text-gray-500">🎯 Nächste Aktion</span>
          <span className="text-sm text-gray-500">Keine offenen Aufgaben — alles erledigt! 🎉</span>
        </div>
      )}

      <div className="border-t border-gray-700" />

      {/* ── Pulse: Delegation Stats ── */}
      <div className="grid grid-cols-3 gap-px bg-gray-700">
        <div className="bg-gray-900 px-4 py-3">
          <PulseBox icon="⚡" label="Läuft" value={pulse.delegationsRunning} />
        </div>
        <div className="bg-gray-900 px-4 py-3">
          <PulseBox icon="⏳" label="Wartet auf Freigabe" value={pulse.delegationsPendingApproval} />
        </div>
        <div className="bg-gray-900 px-4 py-3">
          <PulseBox icon="✅" label="Heute fertig" value={pulse.delegationsCompletedToday} />
        </div>
      </div>

      {/* ── Pulse: PR Lifecycle (shown only when there are delegation-linked PRs) ── */}
      {pulse.prCreated > 0 && (
        <>
          <div className="border-t border-gray-700/50" />
          <div className="grid grid-cols-3 gap-px bg-gray-700/50">
            <div className="bg-gray-900/80 px-4 py-3">
              <PulseBox icon="⎇" label="PRs erstellt" value={pulse.prCreated} />
            </div>
            <div className="bg-gray-900/80 px-4 py-3">
              <PulseBox icon="🟣" label="Gemergt" value={pulse.prMerged} />
            </div>
            <div className="bg-gray-900/80 px-4 py-3">
              <PulseBox icon="🟢" label="Offen" value={pulse.prOpen} />
            </div>
          </div>
        </>
      )}

      <div className="border-t border-gray-700" />

      {/* ── Blocker + Freigaben ── */}
      <div className="grid grid-cols-1 divide-y divide-gray-700 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        {/* Blocker */}
        <div className="px-5 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">🚧 Blocker</p>
          {focus.blockers.length === 0 ? (
            <p className="text-sm text-gray-500">Keine Blocker 🎉</p>
          ) : (
            <ul className="space-y-1.5">
              {focus.blockers.map(b => (
                <li key={b.id}>
                  <Link
                    href={b.href}
                    className="flex items-center justify-between gap-2 rounded px-2 py-1 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                  >
                    <span className="truncate">• {b.title}</span>
                    {b.blockedCount > 1 && (
                      <span className="shrink-0 rounded bg-gray-700 px-1.5 py-0.5 text-xs text-gray-400">
                        ×{b.blockedCount}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Freigaben */}
        <div className="px-5 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">🔴 Freigaben</p>
          {focus.urgentApprovals.length === 0 ? (
            <p className="text-sm text-gray-500">Keine dringenden Freigaben 👍</p>
          ) : (
            <ul className="space-y-1.5">
              {focus.urgentApprovals.map(a => (
                <li key={a.id}>
                  <Link
                    href={a.href}
                    className="flex items-center justify-between gap-2 rounded px-2 py-1 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                  >
                    <span className="truncate">• {a.title}</span>
                    <RiskBadge riskClass={a.riskClass} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="border-t border-gray-700" />

      {/* ── Health-Footer ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 bg-gray-950">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <StatusIcon status={health.status} />
          <span className="text-gray-400">System:</span>
          <span className={health.status === 'ok' ? 'text-green-400' : health.status === 'warn' ? 'text-yellow-400' : 'text-red-400'}>
            {health.topIssue ?? 'Alles ok'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <span>PRs:</span>
          <span className="font-semibold text-gray-300">{pulse.openPRs}</span>
        </div>
      </div>
    </section>
  )
}
