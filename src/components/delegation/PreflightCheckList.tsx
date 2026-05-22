'use client'

import { CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react'
import type { PreflightCheck, PreflightResult } from '@/lib/preflight'

interface Props {
  result: PreflightResult | null
  loading: boolean
}

export function PreflightCheckList({ result, loading }: Props) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 px-3 py-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Preflight-Checks laufen…
      </div>
    )
  }

  if (!result) return null

  const allPassed = result.checks.every(c => c.passed)

  return (
    <div className={`rounded border text-xs ${
      !result.canStart
        ? 'border-red-800 bg-red-950/30'
        : result.warnings.length > 0
          ? 'border-yellow-800 bg-yellow-950/20'
          : 'border-emerald-800 bg-emerald-950/20'
    }`}>
      <div className={`px-3 py-2 font-semibold text-[11px] uppercase tracking-wider border-b ${
        !result.canStart ? 'border-red-800/50 text-red-400' :
        result.warnings.length > 0 ? 'border-yellow-800/50 text-yellow-400' :
        'border-emerald-800/50 text-emerald-400'
      }`}>
        {!result.canStart
          ? `${result.blockers.length} Blocker gefunden`
          : allPassed
            ? 'Alle Checks bestanden'
            : `${result.warnings.length} Warnung${result.warnings.length !== 1 ? 'en' : ''}`
        }
      </div>
      <ul className="divide-y divide-gray-800/50">
        {result.checks.map(check => (
          <CheckRow key={check.id} check={check} />
        ))}
      </ul>
    </div>
  )
}

function CheckRow({ check }: { check: PreflightCheck }) {
  return (
    <li className="px-3 py-1.5">
      <div className="flex items-start gap-2">
        {check.passed ? (
          <CheckCircle className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
        ) : check.severity === 'blocking' ? (
          <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
        ) : (
          <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 mt-0.5 shrink-0" />
        )}
        <div className="min-w-0">
          <span className={check.passed ? 'text-gray-300' : check.severity === 'blocking' ? 'text-red-300' : 'text-yellow-300'}>
            {check.label}
          </span>
          {check.detail && !check.passed && (
            <p className="text-gray-500 mt-0.5 leading-relaxed">{check.detail}</p>
          )}
          {check.fix && !check.passed && (
            <p className="text-gray-600 mt-0.5 font-mono">{check.fix}</p>
          )}
        </div>
      </div>
    </li>
  )
}
