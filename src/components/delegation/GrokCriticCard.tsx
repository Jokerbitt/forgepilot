'use client'

import { useState } from 'react'
import type { GrokCriticResult } from '@/lib/eval/grok-critic'
import type { CriticScore } from '@/lib/models/delegation'

interface GrokCriticCardProps {
  delegationId: string
  /** The agent output text to evaluate — typically from summaryReport.keyPoints joined */
  agentOutput: string
  /** If false, show "not configured" placeholder */
  grokConfigured: boolean
  /** Auto-populated CriticScore from M181 post-execution — shown immediately without API call */
  existingScore?: CriticScore
}

const GRADE_COLORS: Record<string, string> = {
  A: 'text-emerald-400',
  B: 'text-green-400',
  C: 'text-yellow-400',
  D: 'text-orange-400',
  F: 'text-red-400',
}

const VERDICT_STYLES: Record<string, string> = {
  PASS: 'bg-emerald-900/40 text-emerald-300 border-emerald-800',
  NEEDS_REVISION: 'bg-yellow-900/40 text-yellow-300 border-yellow-800',
  FAIL: 'bg-red-900/40 text-red-300 border-red-800',
}

export const CRITIC_SCORE_VERDICT_STYLES: Record<CriticScore['verdict'], string> = {
  approved: 'bg-green-900/40 text-green-300 border-green-800',
  'needs-revision': 'bg-yellow-900/40 text-yellow-300 border-yellow-800',
  rejected: 'bg-red-900/40 text-red-300 border-red-800',
}

export const CRITIC_SCORE_VERDICT_LABELS: Record<CriticScore['verdict'], string> = {
  approved: 'Bestanden',
  'needs-revision': 'Überarbeitung nötig',
  rejected: 'Nicht bestanden',
}

function ScoreBar({ value, label }: { value: number; label: string }) {
  const color =
    value >= 80 ? 'bg-emerald-500'
    : value >= 60 ? 'bg-yellow-500'
    : 'bg-red-500'

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-400">{label}</span>
        <span className={`text-xs font-bold font-mono ${value >= 80 ? 'text-emerald-400' : value >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
          {value}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-800">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  )
}

export function GrokCriticCard({ delegationId, agentOutput, grokConfigured, existingScore }: GrokCriticCardProps) {
  const [result, setResult] = useState<GrokCriticResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Defined here — before any early returns — so it's always in scope
  const handleRunCritic = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/delegations/${delegationId}/critic-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ output: agentOutput, type: 'delegation' }),
      })
      if (res.status === 503) {
        setError('Grok nicht konfiguriert — XAI_API_KEY fehlt')
        return
      }
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setError(data.error ?? 'Critic Review fehlgeschlagen')
        return
      }
      const data = await res.json() as GrokCriticResult
      setResult(data)
    } catch {
      setError('Netzwerkfehler beim Aufrufen von Grok')
    } finally {
      setLoading(false)
    }
  }

  if (!grokConfigured) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-gray-600" />
          Grok Critic Review
        </h2>
        <div className="flex items-center gap-3 py-2">
          <div className="h-8 w-8 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-600 shrink-0">
            X
          </div>
          <div>
            <p className="text-sm text-gray-500">Grok Critic nicht konfiguriert</p>
            <p className="text-xs text-gray-700 mt-0.5">
              <code className="font-mono text-gray-600">XAI_API_KEY</code> in{' '}
              <code className="font-mono text-gray-600">.env.local</code> hinzufügen
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Auto-Review: existing score from M181 (no manual review yet) ─────────
  if (existingScore && !result) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-500" />
            Grok Critic Review
            <span className="ml-1 px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-500 text-[10px] font-normal normal-case tracking-normal">
              Auto-Review
            </span>
          </h2>
          <button
            onClick={handleRunCritic}
            disabled={loading}
            className="text-xs text-violet-500 hover:text-violet-300 transition-colors disabled:opacity-40"
          >
            {loading ? 'Analysiert…' : '↻ Erneut reviewen'}
          </button>
        </div>

        <div className="space-y-4">
          {/* Verdict + Timestamp */}
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-1 text-xs font-bold rounded border ${CRITIC_SCORE_VERDICT_STYLES[existingScore.verdict]}`}>
              {CRITIC_SCORE_VERDICT_LABELS[existingScore.verdict]}
            </span>
            <span className="text-xs text-gray-600 ml-auto">
              Reviewed at {new Date(existingScore.runAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Score bars */}
          <div className="space-y-2">
            <ScoreBar value={existingScore.correctness} label="Korrektheit" />
            <ScoreBar value={existingScore.efficiency} label="Effizienz" />
            <ScoreBar value={100 - existingScore.drift} label="Scope-Fokus" />
          </div>

          {/* Summary */}
          {existingScore.summary && (
            <p className="text-xs text-gray-400 leading-relaxed border-t border-gray-800 pt-3">
              {existingScore.summary}
            </p>
          )}

          {error && (
            <p className="text-xs text-red-400 border border-red-900/40 bg-red-950/20 rounded px-2 py-1.5">
              ⚠ {error}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-violet-800/30 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-violet-400 uppercase tracking-wider flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
          Grok Critic Review
        </h2>
        {result && (
          <button
            onClick={handleRunCritic}
            disabled={loading}
            className="text-xs text-violet-500 hover:text-violet-300 transition-colors disabled:opacity-40"
          >
            {loading ? 'Analysiert…' : '↻ Erneut prüfen'}
          </button>
        )}
      </div>

      {!result && !loading && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-gray-500 leading-relaxed">
            Grok (xAI) bewertet die Delegations-Ausgabe unabhängig von Claude —
            ein zweiter Meinungsgeber für Korrektheit, Effizienz und Scope-Drift.
          </p>
          <button
            onClick={handleRunCritic}
            disabled={loading}
            className="self-start px-3 py-1.5 text-sm bg-violet-900/50 text-violet-300 hover:bg-violet-900 border border-violet-800 rounded-lg transition-colors font-medium disabled:opacity-40"
          >
            Jetzt mit Grok prüfen
          </button>
          {error && (
            <p className="text-xs text-red-400 border border-red-900/40 bg-red-950/20 rounded px-2 py-1.5">
              ⚠ {error}
            </p>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 py-4">
          <div className="h-4 w-4 rounded-full border-2 border-violet-500 border-t-transparent animate-spin shrink-0" />
          <span className="text-sm text-violet-400">Grok analysiert…</span>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-4">
          {/* Verdict + Grade */}
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-1 text-xs font-bold rounded border ${VERDICT_STYLES[result.verdict] ?? 'bg-gray-800 text-gray-400 border-gray-700'}`}>
              {result.verdict === 'PASS' ? 'Bestanden'
                : result.verdict === 'FAIL' ? 'Nicht bestanden'
                : 'Überarbeitung nötig'}
            </span>
            <span className={`text-2xl font-black ${GRADE_COLORS[result.overallGrade] ?? 'text-gray-400'}`}>
              {result.overallGrade}
            </span>
            <span className="text-xs text-gray-600 ml-auto">
              {new Date(result.evaluatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Score bars */}
          <div className="space-y-2">
            <ScoreBar value={result.correctnessScore} label="Korrektheit" />
            <ScoreBar value={result.efficiencyScore} label="Effizienz" />
            <ScoreBar value={result.driftScore} label="Scope-Fokus" />
          </div>

          {/* Reason */}
          <p className="text-xs text-gray-400 leading-relaxed border-t border-gray-800 pt-3">
            {result.reason}
          </p>

          {/* Issues */}
          {result.issues.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-orange-400 mb-1.5">Verbesserungsvorschläge</p>
              <ul className="space-y-1">
                {result.issues.map((issue, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                    <span className="text-orange-600 mt-0.5 shrink-0">→</span>
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Provider */}
          <p className="text-[10px] text-gray-700 text-right">
            via {result.providerId}
          </p>
        </div>
      )}
    </div>
  )
}
