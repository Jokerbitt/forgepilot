'use client'

import { useState } from 'react'
import type { AgentLog } from '@/lib/models/delegation'

interface Props {
  delegationId: string
  logs: AgentLog[]
  onResumed: () => void
}

function extractEscalationContext(logs: AgentLog[]): { reason: string; options: string[]; recommendation?: string } {
  const escalationLog = [...logs].reverse().find(
    l => l.message.includes('ESKALATION:') || l.message.includes('ESCALATION:'),
  )

  if (!escalationLog) return { reason: '', options: [] }

  const text = escalationLog.message
    .replace(/^⚠️\s*ESKALATION:\s*/, '')
    .replace(/^ESCALATION:\s*/, '')

  const optMatch = text.match(/OPTIONS?:\s*(.+?)(?:\s*\|\s*RECOMMEND:.*)?$/)
  const recMatch = text.match(/RECOMMEND:\s*(\w+)/)
  const reason = text.split('|')[0].trim()

  const options = optMatch
    ? optMatch[1].split('|').map(o => o.trim()).filter(Boolean)
    : []

  return { reason, options, recommendation: recMatch?.[1] }
}

export function EscalationResumePanel({ delegationId, logs, onResumed }: Props) {
  const { reason, options, recommendation } = extractEscalationContext(logs)
  const [decision, setDecision] = useState(
    recommendation && options.length > 0
      ? options.find((_, i) => String.fromCharCode(65 + i) === recommendation) ?? ''
      : '',
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleResume = async () => {
    if (!decision.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/delegations/${delegationId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: decision.trim() }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setError(data.error ?? 'Fehler beim Fortsetzen')
        setSubmitting(false)
        return
      }
      onResumed()
    } catch {
      setError('Netzwerkfehler')
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl border border-amber-800/50 bg-amber-950/25 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0">⚠️</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-amber-200 text-sm">Agent wartet auf deine Entscheidung</h3>
          {reason && (
            <p className="text-sm text-amber-300/80 mt-1 leading-relaxed">{reason}</p>
          )}
        </div>
      </div>

      {options.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Optionen</p>
          <div className="flex flex-wrap gap-2">
            {options.map((opt, i) => {
              const letter = String.fromCharCode(65 + i)
              const isRec = recommendation === letter
              return (
                <button
                  key={letter}
                  type="button"
                  onClick={() => setDecision(`${letter}: ${opt}`)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-colors ${
                    decision.startsWith(`${letter}:`) || decision === opt
                      ? 'bg-amber-700/50 border-amber-500 text-amber-100'
                      : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-amber-700 hover:text-amber-200'
                  }`}
                >
                  <span className={`font-bold ${isRec ? 'text-amber-300' : 'text-gray-500'}`}>
                    {letter}{isRec ? ' ★' : ''}
                  </span>
                  <span className="text-xs">{opt}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs font-semibold text-amber-700 uppercase tracking-wide block">
          Deine Entscheidung / Anweisung
        </label>
        <textarea
          value={decision}
          onChange={e => setDecision(e.target.value)}
          placeholder="Beschreibe deine Entscheidung oder wähle eine Option oben…"
          rows={3}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-white resize-none focus:border-amber-600 focus:outline-none placeholder-gray-600"
        />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        type="button"
        onClick={() => void handleResume()}
        disabled={submitting || !decision.trim()}
        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
      >
        {submitting ? 'Starte Agent neu…' : '▶ Agent mit dieser Entscheidung fortsetzen'}
      </button>
    </div>
  )
}
