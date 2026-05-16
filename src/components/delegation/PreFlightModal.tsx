'use client'

import { useState } from 'react'
import type { Delegation } from '@/lib/models/delegation'

const RISK_INFO: Record<string, { color: string; label: string; desc: string }> = {
  A: { color: 'text-green-400',  label: 'Klasse A — Sicher',   desc: 'Nur additive Änderungen, keine Breaking Changes. Kann direkt gestartet werden.' },
  B: { color: 'text-yellow-400', label: 'Klasse B — Moderat',  desc: 'Ändert bestehenden Code. Review empfohlen.' },
  C: { color: 'text-red-400',    label: 'Klasse C — Kritisch', desc: 'Kritische Änderungen. Manuelle Freigabe erforderlich.' },
}

const ROUTE_INFO: Record<string, string> = {
  'local-agent': '🤖 Lokaler Agent (Claude CLI)',
  'runner':      '🚀 Runner (autonomer Multi-Step)',
  'direct-chat': '💬 Direkt-Chat',
  'n8n':         '⚙️ n8n Automatisierung',
  'manual':      '👤 Manuell',
}

interface Props {
  delegation: Delegation
  onConfirm: () => void
  onCancel: () => void
  isStarting: boolean
}

const isBudgetExceeded = (delegation: Delegation) =>
  delegation.costEstimateUsd > delegation.contract.maxBudgetUsd

export function PreFlightModal({ delegation, onConfirm, onCancel, isStarting }: Props) {
  const [budgetOverrunAcknowledged, setBudgetOverrunAcknowledged] = useState(false)
  const c = delegation.contract
  const risk = RISK_INFO[c.riskClass] ?? RISK_INFO['A']
  const route = ROUTE_INFO[delegation.executionRoute] ?? delegation.executionRoute
  const dod = (c.definitionOfDone ?? []).filter(Boolean)
  const tools = (c.allowedTools ?? [])
  const budgetExceeded = isBudgetExceeded(delegation)
  const canConfirm = !budgetExceeded || budgetOverrunAcknowledged

  const estimatedMinutes =
    c.maxBudgetUsd <= 0.5 ? '~2–5 Min.' :
    c.maxBudgetUsd <= 1.0 ? '~5–15 Min.' :
    '~15–30 Min.'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onCancel}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 bg-gray-900 flex items-center gap-3">
          <span className="text-2xl">🚀</span>
          <div>
            <h2 className="text-white font-bold text-lg leading-tight">Pre-Flight Check</h2>
            <p className="text-gray-400 text-xs mt-0.5">Überprüfe die Konfiguration bevor der Agent startet</p>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">

          {/* Goal */}
          <section>
            <h3 className="text-xs text-gray-500 uppercase tracking-wide mb-2">Ziel</h3>
            <p className="text-white text-sm font-medium leading-relaxed">{c.goal}</p>
          </section>

          {/* Definition of Done */}
          {dod.length > 0 && (
            <section>
              <h3 className="text-xs text-gray-500 uppercase tracking-wide mb-2">Definition of Done</h3>
              <ul className="space-y-1">
                {dod.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-green-500 mt-0.5 flex-shrink-0">◻</span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Risk + Route */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-950 rounded-lg p-3 border border-gray-800">
              <p className="text-xs text-gray-500 mb-1">Risiko-Klasse</p>
              <p className={`text-sm font-bold ${risk.color}`}>{risk.label}</p>
              <p className="text-xs text-gray-500 mt-1 leading-tight">{risk.desc}</p>
            </div>
            <div className="bg-gray-950 rounded-lg p-3 border border-gray-800">
              <p className="text-xs text-gray-500 mb-1">Ausführung via</p>
              <p className="text-sm font-medium text-white">{route}</p>
              <p className="text-xs text-gray-500 mt-1">Est. Dauer: {estimatedMinutes}</p>
            </div>
          </div>

          {/* Budget — warning if estimate exceeds max */}
          {budgetExceeded && (
            <div className="flex items-start gap-3 p-3 bg-yellow-950/40 border border-yellow-900/50 rounded-lg">
              <span className="text-yellow-400 text-lg mt-0.5">💰</span>
              <p className="text-yellow-300 text-sm">
                <strong>Budget-Warnung:</strong> Die Kostenschätzung (${delegation.costEstimateUsd.toFixed(2)}) überschreitet das Max-Budget (${c.maxBudgetUsd.toFixed(2)}).
              </p>
            </div>
          )}

          {budgetExceeded && (
            <label className="flex items-start gap-2 rounded-lg border border-yellow-900/50 bg-yellow-950/20 p-3 text-xs text-yellow-100 cursor-pointer">
              <input
                type="checkbox"
                checked={budgetOverrunAcknowledged}
                onChange={event => setBudgetOverrunAcknowledged(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-yellow-700 bg-gray-950 text-yellow-500 focus:ring-yellow-500"
              />
              <span>
                Ich bestaetige bewusst, dass diese Delegation die geplante Budgetgrenze ueberschreitet.
              </span>
            </label>
          )}

          <div className={`bg-gray-950 rounded-lg p-3 flex items-center justify-between ${budgetExceeded ? 'border border-yellow-900/40' : 'border border-gray-800'}`}>
            <div>
              <p className="text-xs text-gray-500">Max. Budget</p>
              <p className={`font-mono font-bold ${budgetExceeded ? 'text-yellow-400' : 'text-white'}`}>${c.maxBudgetUsd.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Task-Typ</p>
              <p className="text-white text-sm font-medium capitalize">{c.taskType || 'feature'}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Branch</p>
              <p className="text-blue-400 text-xs font-mono">{c.branchStrategy}/...</p>
            </div>
          </div>

          {/* Allowed Tools */}
          {tools.length > 0 && (
            <section>
              <h3 className="text-xs text-gray-500 uppercase tracking-wide mb-2">Erlaubte Tools ({tools.length})</h3>
              <div className="flex flex-wrap gap-1.5">
                {tools.map(t => (
                  <span key={t} className="px-2 py-0.5 bg-gray-800 text-gray-300 text-xs rounded border border-gray-700">
                    {t}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Risk C warning */}
          {c.riskClass === 'C' && (
            <div className="flex items-start gap-3 p-3 bg-red-950/40 border border-red-900/50 rounded-lg">
              <span className="text-red-400 text-lg mt-0.5">⚠️</span>
              <p className="text-red-300 text-sm">
                <strong>Kritische Delegation.</strong> Stelle sicher, dass du die Änderungen vollständig überprüft hast, bevor der Agent startet.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 bg-gray-900/80 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={onConfirm}
            disabled={isStarting || !canConfirm}
            title={!canConfirm ? 'Bitte Budget-Ueberschreitung bewusst bestaetigen.' : undefined}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-colors shadow-lg shadow-blue-900/30 flex items-center gap-2"
          >
            {isStarting ? (
              <>
                <span className="animate-spin text-base">⏳</span>
                Startet...
              </>
            ) : (
              <>
                <span>▶</span>
                Agent starten
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
