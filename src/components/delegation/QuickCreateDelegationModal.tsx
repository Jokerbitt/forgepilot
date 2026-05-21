'use client'

import { useState } from 'react'
import type { Delegation } from '@/lib/models/delegation'

interface Props {
  onClose: () => void
  onCreate: (delegation: Delegation) => void
}

type RiskClass = 'A' | 'B' | 'C'

const RISK_CLASS_OPTIONS: { value: RiskClass; label: string }[] = [
  { value: 'A', label: 'A — Gering' },
  { value: 'B', label: 'B — Moderat' },
  { value: 'C', label: 'C — Kritisch' },
]

export function QuickCreateDelegationModal({ onClose, onCreate }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [riskClass, setRiskClass] = useState<RiskClass>('A')
  const [saving, setSaving] = useState(false)
  const [titleError, setTitleError] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      setTitleError(true)
      return
    }

    setTitleError(false)
    setErrorMessage(null)
    setSaving(true)

    const now = new Date().toISOString()
    const id = `del-${Date.now()}`

    const newDelegation: Delegation = {
      id,
      title: title.trim().slice(0, 80),
      status: 'pending',
      executionRoute: 'local-agent',
      costEstimateUsd: 0.5,
      contract: {
        id: `con-${Date.now()}`,
        workItemId: 'MANUAL',
        goal: title.trim(),
        context: description.trim(),
        definitionOfDone: ['Task erfolgreich abgeschlossen'],
        riskClass,
        maxBudgetUsd: 1.0,
        allowedTools: ['read_file', 'write_file'],
        branchStrategy: 'feature',
        requiresApproval: riskClass === 'C',
        privacyMode: 'local',
        llmModel: 'claude-sonnet',
        outputMode: 'text',
        createdAt: now,
      },
      createdAt: now,
      updatedAt: now,
    }

    try {
      const res = await fetch('/api/delegations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDelegation),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => 'Unbekannter Fehler')
        setErrorMessage(`Fehler beim Erstellen: ${text}`)
        setSaving(false)
        return
      }

      const created = (await res.json()) as Delegation
      setSaving(false)
      onCreate(created)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Netzwerkfehler'
      setErrorMessage(`Fehler: ${message}`)
      setSaving(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-create-title"
      >
        <div className="bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-md">

          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-800 flex items-center justify-between">
            <h2
              id="quick-create-title"
              className="text-lg font-bold text-white flex items-center gap-2"
            >
              <span>⚡</span>
              Neue Delegation
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-white transition-colors text-xl leading-none"
              aria-label="Schließen"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-4">

              {/* Title */}
              <div>
                <label
                  htmlFor="quick-title"
                  className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5"
                >
                  Titel <span className="text-red-400">*</span>
                </label>
                <input
                  id="quick-title"
                  type="text"
                  value={title}
                  onChange={e => {
                    setTitle(e.target.value)
                    if (e.target.value.trim()) setTitleError(false)
                  }}
                  placeholder="Kurzer, präziser Titel..."
                  maxLength={200}
                  autoFocus
                  className={`w-full bg-gray-900 border rounded-lg p-3 text-white text-sm focus:outline-none placeholder-gray-600 ${
                    titleError
                      ? 'border-red-500 focus:border-red-400'
                      : 'border-gray-800 focus:border-blue-500'
                  }`}
                />
                {titleError && (
                  <p className="text-xs text-red-400 mt-1">Titel ist Pflichtfeld.</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="quick-description"
                  className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5"
                >
                  Beschreibung <span className="text-gray-600">(optional)</span>
                </label>
                <textarea
                  id="quick-description"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Zusätzlicher Kontext, Ziel oder Hinweise..."
                  rows={3}
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg p-3 text-white text-sm resize-none focus:border-blue-500 focus:outline-none placeholder-gray-600"
                />
              </div>

              {/* Risk Class */}
              <div>
                <label
                  htmlFor="quick-risk-class"
                  className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5"
                >
                  Risk Class
                </label>
                <select
                  id="quick-risk-class"
                  value={riskClass}
                  onChange={e => setRiskClass(e.target.value as RiskClass)}
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2.5 text-white text-sm focus:border-blue-500 focus:outline-none"
                >
                  {RISK_CLASS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {riskClass === 'C' && (
                  <p className="text-xs text-yellow-400 mt-1">
                    Risk Class C erfordert manuelle Freigabe.
                  </p>
                )}
              </div>

              {/* Error message */}
              {errorMessage && (
                <div className="bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">
                  <p className="text-xs text-red-400">{errorMessage}</p>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="px-6 pb-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-colors min-h-[44px]"
              >
                {saving ? (
                  <>
                    <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Erstellt...
                  </>
                ) : (
                  'Erstellen'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
