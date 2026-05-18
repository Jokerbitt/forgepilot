'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ContextPackage } from '@/lib/context-packages/types'
import { cx } from '@/components/ui/primitives'

interface Props {
  workItemId: string
  title: string
  objective: string
  privacyMode: 'local-only' | 'hybrid' | 'cloud-approved'
}

export function ContextPackageBuilder({ workItemId, title, objective, privacyMode }: Props) {
  const [building, setBuilding] = useState(false)
  const [pkg, setPkg] = useState<ContextPackage | null>(null)
  const [error, setError] = useState('')

  const handleBuild = async () => {
    setBuilding(true)
    setError('')
    try {
      const res = await fetch('/api/context-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workItemId, title, objective, privacyMode, tokenBudget: 4000 }),
      })
      const data = await res.json() as { package?: ContextPackage; error?: string }
      if (data.package) {
        setPkg(data.package)
      } else {
        setError(data.error ?? 'Unbekannter Fehler')
      }
    } catch {
      setError('Verbindungsfehler')
    } finally {
      setBuilding(false)
    }
  }

  if (pkg) {
    const scoreColor = pkg.readinessScore >= 70 ? 'text-emerald-400' : pkg.readinessScore >= 40 ? 'text-amber-300' : 'text-red-400'
    return (
      <div className="col-span-2 rounded-lg border border-emerald-800/40 bg-emerald-900/10 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Kontext-Paket</p>
          <Link
            href="/context-packages"
            className="text-xs text-sky-400 hover:underline"
          >
            Alle ansehen →
          </Link>
        </div>
        <div className="mt-2 flex items-center gap-4 text-xs">
          <span className={cx('font-bold', scoreColor)}>{pkg.readinessScore}% Readiness</span>
          <span className="text-slate-500">{pkg.tokenCount.toLocaleString()} / {pkg.tokenBudget.toLocaleString()} Tokens</span>
          <span className="text-slate-500">{pkg.sources.length} Quellen</span>
        </div>
        {pkg.blockers.length > 0 && (
          <p className="mt-1 text-xs text-amber-400">⚠ {pkg.blockers[0]}</p>
        )}
        <div className="mt-2 h-1 w-full rounded-full bg-slate-800">
          <div
            className={cx('h-1 rounded-full', pkg.readinessScore >= 70 ? 'bg-emerald-500' : pkg.readinessScore >= 40 ? 'bg-amber-400' : 'bg-red-500')}
            style={{ width: `${pkg.readinessScore}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="col-span-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">Kontext-Paket für diesen Task bauen</p>
        <button
          onClick={handleBuild}
          disabled={building}
          className={cx(
            'shrink-0 rounded px-3 py-1.5 text-xs font-semibold transition-colors',
            building ? 'bg-slate-700 text-slate-400' : 'bg-slate-700 text-white hover:bg-slate-600'
          )}
        >
          {building ? 'Baue…' : 'Kontext bauen'}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}
