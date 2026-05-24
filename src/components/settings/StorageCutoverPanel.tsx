'use client'

import { useEffect, useState } from 'react'
import { cx } from '@/components/ui/primitives'
import type { StoreInventory, StoreEntry, StoreMode, StoreRisk } from '@/lib/storage/store-inventory'
import type { StorageStatus } from '@/lib/storage/cutover-config'

interface StorageStatusResponse extends StorageStatus {
  inventory: StoreInventory
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function ModeBadge({ mode }: { mode: StoreMode }) {
  const styles: Record<StoreMode, string> = {
    postgres:          'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    dual:              'bg-sky-500/10 text-sky-400 border-sky-500/20',
    json:              'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'json-intentional': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  }
  const labels: Record<StoreMode, string> = {
    postgres:          'Postgres',
    dual:              'Dual',
    json:              'JSON',
    'json-intentional': 'JSON (ok)',
  }
  return (
    <span className={cx('rounded border px-1.5 py-0.5 font-mono text-[10px]', styles[mode])}>
      {labels[mode]}
    </span>
  )
}

function RiskDot({ risk }: { risk: StoreRisk }) {
  if (risk === 'none') return <span className="h-1.5 w-1.5 rounded-full bg-slate-600 inline-block" />
  if (risk === 'low')  return <span className="h-1.5 w-1.5 rounded-full bg-amber-500/60 inline-block" />
  if (risk === 'medium') return <span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block" />
  return <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse inline-block" />
}

function ScoreMeter({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-white/10">
        <div
          className={cx('h-1.5 rounded-full transition-all', color)}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={cx('shrink-0 font-mono text-xs tabular-nums', score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-red-400')}>
        {score}%
      </span>
    </div>
  )
}

// ─── Store row ────────────────────────────────────────────────────────────────

function StoreRow({ store }: { store: StoreEntry }) {
  const isRisky = store.mode === 'json' && store.productionRisk !== 'none'
  return (
    <tr className={cx('border-b border-white/[0.04] last:border-0', isRisky && 'bg-amber-500/[0.02]')}>
      <td className="py-2 pr-4">
        <div className="flex items-center gap-2">
          <RiskDot risk={store.productionRisk} />
          <span className="text-xs text-slate-200">{store.label}</span>
        </div>
      </td>
      <td className="py-2 pr-4">
        <ModeBadge mode={store.mode} />
      </td>
      <td className="py-2 text-[11px] text-slate-500 max-w-xs hidden md:table-cell">
        {store.note}
      </td>
    </tr>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function StorageCutoverPanel() {
  const [data, setData] = useState<StorageStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/storage-status')
      .then(r => r.json() as Promise<StorageStatusResponse>)
      .then(setData)
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
        <div className="h-4 w-48 animate-pulse rounded bg-white/10" />
      </div>
    )
  }

  if (!data) return null

  const { mode, postgresConfigured, risks, recommendation, inventory } = data
  const { summary } = inventory

  const modeLabel: Record<string, string> = {
    json:     'JSON (Entwicklung)',
    dual:     'Dual-Write (Migration)',
    postgres: 'PostgreSQL (Produktion)',
  }

  const panelBorder = summary.highRiskJsonStores > 0
    ? 'border-amber-500/20'
    : mode === 'postgres'
      ? 'border-emerald-500/20'
      : 'border-white/[0.07]'

  return (
    <div className={cx('rounded-xl border p-4 space-y-4', panelBorder)}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Storage Cutover</p>
          <p className="mt-0.5 text-sm font-medium text-white">
            {modeLabel[mode] ?? mode}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] text-slate-500">Postgres konfiguriert</p>
            <p className={cx('text-xs font-medium', postgresConfigured ? 'text-emerald-400' : 'text-amber-400')}>
              {postgresConfigured ? 'Ja' : 'Nein'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-500">Readiness</p>
            <div className="w-24 mt-0.5">
              <ScoreMeter score={summary.cutoverReadinessScore} />
            </div>
          </div>
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400">
          {summary.postgresActive} Postgres
        </span>
        {summary.dualWrite > 0 && (
          <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-400">
            {summary.dualWrite} Dual-Write
          </span>
        )}
        <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-400">
          {summary.jsonOnly} JSON-only
        </span>
        {summary.highRiskJsonStores > 0 && (
          <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[11px] text-red-400">
            {summary.highRiskJsonStores} hohes Risiko
          </span>
        )}
      </div>

      {/* Recommendation */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
        <p className="text-xs text-slate-300">{recommendation}</p>
      </div>

      {/* Risks */}
      {risks.length > 0 && (
        <ul className="space-y-1">
          {risks.map((risk, i) => (
            <li key={i} className="flex items-start gap-2 text-[11px] text-amber-400/80">
              <span className="mt-0.5 shrink-0">⚠</span>
              <span>{risk}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Store table */}
      <details>
        <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors select-none">
          Alle {inventory.stores.length} Stores anzeigen
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="pb-2 pr-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Store</th>
                <th className="pb-2 pr-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Modus</th>
                <th className="pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hidden md:table-cell">Hinweis</th>
              </tr>
            </thead>
            <tbody>
              {inventory.stores.map(store => (
                <StoreRow key={store.key} store={store} />
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {/* Cutover guide */}
      <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2.5 text-[11px] text-slate-500 space-y-1">
        <p className="font-medium text-slate-400">Postgres aktivieren:</p>
        <p>1. <code className="text-violet-400">DATABASE_URL=postgresql://...</code> in <code className="text-slate-400">.env.local</code> setzen</p>
        <p>2. <code className="text-violet-400">STORAGE_MODE=dual</code> → Migration testen → <code className="text-violet-400">STORAGE_MODE=postgres</code></p>
        <p>3. JSON-Backups unter <code className="text-slate-400">config/*.json</code> bleiben als Read-Only-Referenz erhalten</p>
      </div>
    </div>
  )
}
