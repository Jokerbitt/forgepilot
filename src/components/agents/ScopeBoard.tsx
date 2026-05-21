'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Clock, GitBranch, RefreshCw, Users } from 'lucide-react'
import { Badge, Metric, Panel, StatusDot, buttonClassName, cx } from '@/components/ui/primitives'

interface ScopeClaim {
  agentId: string
  agentType: string
  milestone: string
  branch: string
  filePatterns: string[]
  pid?: number
  lastHeartbeatAt?: string
  shareBranch?: boolean
  claimedAt: string
  expiresAt: string
}

interface ScopeResponse {
  claims: ScopeClaim[]
  count: number
}

const REFRESH_MS = 5_000

function minutesUntil(iso: string, now: Date): number {
  return Math.max(0, Math.round((new Date(iso).getTime() - now.getTime()) / 60_000))
}

function minutesSince(iso: string | undefined, now: Date): number | null {
  if (!iso) return null
  return Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000))
}

function ageBadgeTone(minutesLeft: number): 'success' | 'warning' | 'danger' {
  if (minutesLeft <= 5) return 'danger'
  if (minutesLeft <= 15) return 'warning'
  return 'success'
}

function heartbeatTone(minutesAgo: number | null): 'success' | 'warning' | 'danger' | 'neutral' {
  if (minutesAgo === null) return 'neutral'
  if (minutesAgo <= 5) return 'success'
  if (minutesAgo <= 15) return 'warning'
  return 'danger'
}

export function ScopeBoard() {
  const [claims, setClaims] = useState<ScopeClaim[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState<Date>(new Date())
  const [autoRefresh, setAutoRefresh] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/agents/scope')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as ScopeResponse
      setClaims(data.claims ?? [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
      setNow(new Date())
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!autoRefresh) return
    const id = window.setInterval(() => {
      void load()
    }, REFRESH_MS)
    return () => window.clearInterval(id)
  }, [autoRefresh, load])

  // ── Derived metrics ────────────────────────────────────────────────────
  const total = claims.length
  const byBranch = new Map<string, ScopeClaim[]>()
  for (const c of claims) {
    if (!byBranch.has(c.branch)) byBranch.set(c.branch, [])
    byBranch.get(c.branch)!.push(c)
  }
  const sharedBranches = Array.from(byBranch.values()).filter(arr => arr.length > 1).length
  const sharedBranchOk = Array.from(byBranch.values())
    .filter(arr => arr.length > 1)
    .filter(arr => arr.every(c => c.shareBranch))
    .length
  const sharedBranchConflict = sharedBranches - sharedBranchOk

  const staleHeartbeats = claims.filter(c => {
    const m = minutesSince(c.lastHeartbeatAt, now)
    return m !== null && m > 15
  }).length

  return (
    <div className="space-y-5">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="page-header">
        <div>
          <p className="page-eyebrow">Multi-Agent Coordination</p>
          <h1 className="page-title flex items-center gap-2">
            <Users className="h-6 w-6 text-violet-300" />
            Active Scope Claims
          </h1>
          <p className="page-description">
            Live-Snapshot von <code className="rounded bg-white/5 px-1 text-[11px]">config/agent-scope.json</code>.
            Aktualisiert alle {REFRESH_MS / 1000} s wenn Auto-Refresh an ist.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setAutoRefresh(v => !v)}
            className={cx(
              buttonClassName('secondary', 'min-h-8 px-3 py-1.5 text-xs'),
              autoRefresh && 'border-emerald-500/40 text-emerald-200',
            )}
          >
            <StatusDot tone={autoRefresh ? 'success' : 'neutral'} pulse={autoRefresh} />
            Auto-Refresh
          </button>
          <button
            onClick={() => void load()}
            className={buttonClassName('primary', 'min-h-8 px-3 py-1.5 text-xs')}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Jetzt
          </button>
        </div>
      </header>

      {/* ── Metrics ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Aktive Agenten" value={total} detail="claims" tone={total > 0 ? 'info' : 'neutral'} />
        <Metric
          label="Branch-Konflikte"
          value={sharedBranchConflict}
          detail={sharedBranchConflict > 0 ? 'mehrere Agenten ohne shareBranch' : 'alle isoliert'}
          tone={sharedBranchConflict > 0 ? 'danger' : 'success'}
        />
        <Metric
          label="Stale Heartbeats"
          value={staleHeartbeats}
          detail="ohne Lebenszeichen seit >15 min"
          tone={staleHeartbeats > 0 ? 'warning' : 'success'}
        />
        <Metric
          label="Geteilte Branches"
          value={sharedBranchOk}
          detail="beide Seiten shareBranch=true"
          tone={sharedBranchOk > 0 ? 'info' : 'neutral'}
        />
      </div>

      {/* ── Error banner ───────────────────────────────────────────── */}
      {error && (
        <Panel className="border-rose-500/30 bg-rose-500/[0.06] p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
            <div>
              <p className="text-sm font-semibold text-rose-200">Konnte Scope-Registry nicht laden</p>
              <p className="mt-1 font-mono text-xs text-rose-300/80">{error}</p>
            </div>
          </div>
        </Panel>
      )}

      {/* ── Empty state ──────────────────────────────────────────────── */}
      {!loading && claims.length === 0 && !error && (
        <Panel className="p-10 text-center">
          <Users className="mx-auto h-8 w-8 text-slate-600" />
          <h2 className="mt-3 text-base font-semibold text-white">Niemand arbeitet gerade</h2>
          <p className="mt-2 text-sm text-slate-400">
            Wenn ein Agent <code className="rounded bg-white/5 px-1">npm run agent -- claim</code> ausführt,
            erscheint er hier in Sekunden.
          </p>
        </Panel>
      )}

      {/* ── Loading shimmer ─────────────────────────────────────────── */}
      {loading && (
        <div className="space-y-3">
          {[0, 1].map(i => (
            <div key={i} className="h-32 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03]" />
          ))}
        </div>
      )}

      {/* ── Grouped by branch ───────────────────────────────────────── */}
      {!loading && claims.length > 0 && (
        <div className="space-y-4">
          {Array.from(byBranch.entries()).map(([branch, branchClaims]) => {
            const isShared = branchClaims.length > 1
            const sharedOk = isShared && branchClaims.every(c => c.shareBranch)
            const sharedConflict = isShared && !sharedOk

            return (
              <Panel key={branch} className={cx('overflow-hidden', sharedConflict && 'border-rose-500/40')}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <GitBranch className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                    <span className="truncate font-mono text-sm font-semibold text-slate-100">{branch}</span>
                    {isShared && (
                      <Badge tone={sharedOk ? 'info' : 'danger'}>
                        {branchClaims.length} Agenten {sharedConflict ? '— Konflikt!' : '(beide opt-in)'}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="divide-y divide-white/[0.05]">
                  {branchClaims.map(claim => {
                    const minutesLeft = minutesUntil(claim.expiresAt, now)
                    const heartbeatAgo = minutesSince(claim.lastHeartbeatAt, now)
                    return (
                      <div key={claim.agentId} className="grid gap-3 px-4 py-3 sm:grid-cols-[1.4fr_1fr_1fr]">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm font-semibold text-white">{claim.agentId}</span>
                            <Badge tone="neutral">{claim.agentType}</Badge>
                            {claim.shareBranch && <Badge tone="info">shareBranch</Badge>}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            <span className="text-slate-400">{claim.milestone}</span>
                            {claim.pid && <span className="ml-2 font-mono">pid={claim.pid}</span>}
                          </p>
                          <p className="mt-1.5 font-mono text-[11px] leading-5 text-slate-500">
                            {claim.filePatterns.join(' · ')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <Clock className="h-3.5 w-3.5 text-slate-500" />
                          <Badge tone={ageBadgeTone(minutesLeft)}>
                            läuft in {minutesLeft}m ab
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <StatusDot tone={heartbeatTone(heartbeatAgo)} />
                          <span className="text-slate-400">
                            {heartbeatAgo === null
                              ? 'kein Heartbeat'
                              : heartbeatAgo === 0
                                ? 'gerade eben'
                                : `vor ${heartbeatAgo}m`}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Panel>
            )
          })}
        </div>
      )}
    </div>
  )
}
