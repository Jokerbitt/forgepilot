'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'

/**
 * RiskCApprovalPanel — the guarded human-approval affordance for Risk-C
 * delegations (ADR-004). Renders only for a pending Risk-C delegation. Requires
 * an authorized approver name (E1) AND a typed reason (E3) behind a blast-radius
 * warning, then POSTs to the approve route, which re-validates server-side.
 */

export interface RiskCApprovalPanelProps {
  delegationId: string
  delegationTitle: string
  /** Called after a successful approval so the page can reload the delegation. */
  onApproved: () => void | Promise<void>
}

export function RiskCApprovalPanel({ delegationId, delegationTitle, onApproved }: RiskCApprovalPanelProps) {
  const [actor, setActor] = useState('')
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = actor.trim().length > 0 && reason.trim().length > 0 && confirmed && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/delegations/${delegationId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: actor.trim(), note: reason.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setError(data.error ?? `Freigabe fehlgeschlagen (HTTP ${res.status}).`)
        return
      }
      await onApproved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Netzwerkfehler bei der Freigabe.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl border border-rose-800/60 bg-rose-950/30 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-rose-200">Risk-C-Freigabe erforderlich</h3>
          <p className="text-xs text-rose-300/80 leading-relaxed">
            &bdquo;{delegationTitle}&ldquo; ist als <strong>Risk-C</strong> eingestuft (z.B. Auth, Zahlungen, Schema).
            Eine Freigabe startet einen Agenten mit vollen Rechten (<code className="font-mono">--dangerously</code>):
            er kann Dateien schreiben, Befehle ausführen und committen. Nur ein autorisierter Freigeber darf das,
            mit nachvollziehbarer Begründung. Diese Freigabe wird protokolliert.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-300">Freigeber (Name/Kürzel)</span>
          <input
            type="text"
            value={actor}
            onChange={e => setActor(e.target.value)}
            placeholder="z.B. sven"
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-rose-500 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-300">Begründung (Pflicht)</span>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="Warum ist diese Risk-C-Aufgabe sicher freizugeben? (z.B. Migration manuell geprüft)"
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-rose-500 focus:outline-none"
          />
        </label>

        <label className="flex items-start gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={e => setConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-gray-900 text-rose-500 focus:ring-rose-500"
          />
          <span className="text-xs text-gray-300">
            Ich verstehe die Tragweite und gebe diese Risk-C-Ausführung bewusst frei.
          </span>
        </label>
      </div>

      {error && (
        <p className="text-xs text-rose-400 bg-rose-950/50 border border-rose-800/60 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-500"
      >
        {submitting ? 'Wird freigegeben…' : 'Risk-C freigeben'}
      </button>
    </div>
  )
}
