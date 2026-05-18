'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Delegation } from '@/lib/models/delegation'
import { StatusDot, cx } from '@/components/ui/primitives'

// ─── helpers ─────────────────────────────────────────────────────────────────

const RISK_COLOR: Record<string, string> = {
  A: 'bg-emerald-900/30 text-emerald-400 border-emerald-800/40',
  B: 'bg-amber-900/30 text-amber-400 border-amber-800/40',
  C: 'bg-red-900/30 text-red-400 border-red-800/40',
}

const STATUS_COLOR: Record<string, string> = {
  pending:   'text-amber-400',
  approved:  'text-sky-400',
  running:   'text-emerald-400',
  completed: 'text-slate-400',
  failed:    'text-red-400',
  cancelled: 'text-slate-600',
}

const STATUS_LABEL: Record<string, string> = {
  pending:   'Pending',
  approved:  'Genehmigt',
  running:   'Läuft',
  completed: 'Fertig',
  failed:    'Fehler',
  cancelled: 'Abgebrochen',
}

const PRIVACY_COLOR: Record<string, string> = {
  local:         'text-emerald-400',
  'private-cloud': 'text-amber-400',
  public:        'text-red-400',
}

const PRIVACY_LABEL: Record<string, string> = {
  local:         'Lokal',
  'private-cloud': 'Private Cloud',
  public:        'Öffentlich',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function GovernancePage() {
  const [delegations, setDelegations] = useState<Delegation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/delegations')
      .then(r => r.json())
      .then((data: unknown) => {
        setDelegations(Array.isArray(data) ? (data as Delegation[]) : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Derived views
  const approvalQueue = delegations.filter(d => d.status === 'pending' || (d.status === 'approved' && d.contract.requiresApproval))
  const cloudDelegations = delegations.filter(d => d.contract.privacyMode !== 'local')
  const riskC = delegations.filter(d => d.contract.riskClass === 'C')
  const riskB = delegations.filter(d => d.contract.riskClass === 'B')
  const riskA = delegations.filter(d => d.contract.riskClass === 'A')
  const failed = delegations.filter(d => d.status === 'failed')
  const running = delegations.filter(d => d.status === 'running')

  const totalBudget = delegations.reduce((sum, d) => sum + (d.contract.maxBudgetUsd ?? 0), 0)
  const activeBudget = running.reduce((sum, d) => sum + (d.contract.maxBudgetUsd ?? 0), 0)

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl p-6">

        {/* Header */}
        <header className="mb-8 mt-2 border-b border-slate-800 pb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">System</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Governance Hub</h1>
          <p className="mt-2 text-sm text-slate-400">Approval-Queue, Risikoprofil, Privacy-Monitor und Audit-Übersicht.</p>
        </header>

        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">Lade Daten…</p>
        ) : (
          <div className="space-y-8">

            {/* KPI strip */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiCard label="Approval Queue" value={approvalQueue.length} tone={approvalQueue.length > 0 ? 'warning' : 'neutral'} />
              <KpiCard label="Aktiv" value={running.length} tone={running.length > 0 ? 'success' : 'neutral'} />
              <KpiCard label="Fehlgeschlagen" value={failed.length} tone={failed.length > 0 ? 'danger' : 'neutral'} />
              <KpiCard label="Cloud-Delegationen" value={cloudDelegations.length} tone={cloudDelegations.length > 0 ? 'warning' : 'neutral'} />
            </div>

            {/* Two-column: Approval queue + Risk profile */}
            <div className="grid gap-6 lg:grid-cols-2">

              {/* Approval Queue */}
              <section>
                <SectionHeader title="Approval Queue" count={approvalQueue.length} />
                {approvalQueue.length === 0 ? (
                  <EmptySection text="Keine offenen Freigaben." />
                ) : (
                  <div className="space-y-2">
                    {approvalQueue.map(d => (
                      <DelegationRow key={d.id} d={d} />
                    ))}
                  </div>
                )}
              </section>

              {/* Risk profile */}
              <section>
                <SectionHeader title="Risikoprofil" />
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <div className="space-y-3">
                    <RiskBar label="Risk A — Niedrig" count={riskA.length} total={delegations.length} colorClass="bg-emerald-500" />
                    <RiskBar label="Risk B — Balanced" count={riskB.length} total={delegations.length} colorClass="bg-amber-400" />
                    <RiskBar label="Risk C — Kritisch" count={riskC.length} total={delegations.length} colorClass="bg-red-500" />
                  </div>
                  <div className="mt-4 border-t border-slate-800 pt-3 text-xs text-slate-500">
                    {delegations.length} Delegationen gesamt
                  </div>
                </div>
              </section>
            </div>

            {/* Budget overview */}
            <section>
              <SectionHeader title="Budget Monitor" />
              <div className="grid gap-3 sm:grid-cols-3">
                <MetricPanel label="Gesamtbudget (kumuliert)" value={`$${totalBudget.toFixed(2)}`} sub="alle Delegationen" />
                <MetricPanel label="Aktives Budget" value={`$${activeBudget.toFixed(2)}`} sub="laufende Runs" tone="warning" />
                <MetricPanel
                  label="Ø Budget / Delegation"
                  value={delegations.length > 0 ? `$${(totalBudget / delegations.length).toFixed(2)}` : '—'}
                  sub="Durchschnitt"
                />
              </div>
            </section>

            {/* Privacy monitor */}
            {cloudDelegations.length > 0 && (
              <section>
                <SectionHeader title="Privacy Monitor" count={cloudDelegations.length} countTone="warning" />
                <div className="space-y-2">
                  {cloudDelegations.map(d => (
                    <DelegationRow key={d.id} d={d} showPrivacy />
                  ))}
                </div>
              </section>
            )}

            {/* Risk C delegations */}
            {riskC.length > 0 && (
              <section>
                <SectionHeader title="Risk Class C — Kritisch" count={riskC.length} countTone="danger" />
                <div className="space-y-2">
                  {riskC.map(d => (
                    <DelegationRow key={d.id} d={d} />
                  ))}
                </div>
              </section>
            )}

            {/* Failed delegations */}
            {failed.length > 0 && (
              <section>
                <SectionHeader title="Fehlgeschlagen" count={failed.length} countTone="danger" />
                <div className="space-y-2">
                  {failed.map(d => (
                    <DelegationRow key={d.id} d={d} />
                  ))}
                </div>
              </section>
            )}

            {/* All delegations mini-table */}
            <section>
              <SectionHeader title="Alle Delegationen" count={delegations.length} />
              <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Titel</th>
                      <th className="hidden px-4 py-3 sm:table-cell">Risk</th>
                      <th className="hidden px-4 py-3 md:table-cell">Privacy</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="hidden px-4 py-3 lg:table-cell">Aktualisiert</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {delegations.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(d => (
                      <tr key={d.id} className="hover:bg-slate-800/30">
                        <td className="px-4 py-3">
                          <Link href={`/delegations/${d.id}`} className="block truncate max-w-xs font-medium text-white hover:text-sky-400">
                            {d.contract.goal.slice(0, 80)}
                          </Link>
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <span className={cx('rounded border px-1.5 py-0.5 text-xs font-bold', RISK_COLOR[d.contract.riskClass])}>
                            {d.contract.riskClass}
                          </span>
                        </td>
                        <td className={cx('hidden px-4 py-3 text-xs font-medium md:table-cell', PRIVACY_COLOR[d.contract.privacyMode])}>
                          {PRIVACY_LABEL[d.contract.privacyMode]}
                        </td>
                        <td className={cx('px-4 py-3 text-xs font-semibold', STATUS_COLOR[d.status])}>
                          {STATUS_LABEL[d.status] ?? d.status}
                        </td>
                        <td className="hidden px-4 py-3 text-xs text-slate-500 lg:table-cell">
                          {formatDate(d.updatedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

          </div>
        )}
      </div>
    </main>
  )
}

// ─── sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, tone }: { label: string; value: number; tone: 'success' | 'warning' | 'danger' | 'neutral' }) {
  const valueColor = tone === 'success' ? 'text-emerald-400' : tone === 'warning' ? 'text-amber-400' : tone === 'danger' ? 'text-red-400' : 'text-white'
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={cx('mt-1 text-2xl font-bold', valueColor)}>{value}</p>
    </div>
  )
}

function MetricPanel({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'warning' }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={cx('mt-1 text-xl font-bold', tone === 'warning' ? 'text-amber-400' : 'text-white')}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-600">{sub}</p>}
    </div>
  )
}

function RiskBar({ label, count, total, colorClass }: { label: string; count: number; total: number; colorClass: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-500">{count} ({pct}%)</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
        <div className={cx('h-full rounded-full transition-all', colorClass)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function SectionHeader({ title, count, countTone }: { title: string; count?: number; countTone?: 'warning' | 'danger' }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 className="text-sm font-semibold text-slate-300">{title}</h2>
      {count !== undefined && (
        <span className={cx(
          'rounded-full px-2 py-0.5 text-xs font-bold',
          countTone === 'danger' ? 'bg-red-900/40 text-red-400' :
          countTone === 'warning' ? 'bg-amber-900/40 text-amber-400' :
          'bg-slate-800 text-slate-400'
        )}>
          {count}
        </span>
      )}
    </div>
  )
}

function EmptySection({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-xs text-slate-600">
      {text}
    </div>
  )
}

function DelegationRow({ d, showPrivacy }: { d: Delegation; showPrivacy?: boolean }) {
  return (
    <Link
      href={`/delegations/${d.id}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2.5 hover:border-slate-700 hover:bg-slate-800/60"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{d.contract.goal.slice(0, 80)}</p>
        <p className="mt-0.5 font-mono text-xs text-slate-600">{d.id.slice(0, 8)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {showPrivacy && (
          <span className={cx('text-xs font-medium', PRIVACY_COLOR[d.contract.privacyMode])}>
            {PRIVACY_LABEL[d.contract.privacyMode]}
          </span>
        )}
        <span className={cx('rounded border px-1.5 py-0.5 text-xs font-bold', RISK_COLOR[d.contract.riskClass])}>
          {d.contract.riskClass}
        </span>
        <StatusDot tone={
          d.status === 'running' ? 'success' :
          d.status === 'failed' ? 'danger' :
          d.status === 'pending' ? 'warning' : 'neutral'
        } />
        <span className={cx('text-xs font-semibold', STATUS_COLOR[d.status])}>
          {STATUS_LABEL[d.status] ?? d.status}
        </span>
      </div>
    </Link>
  )
}
