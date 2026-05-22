'use client'

import { useState } from 'react'
import type { ChainConfig } from '@/lib/models/delegation'

interface ChainConfigFormProps {
  value: ChainConfig | undefined
  onChange: (config: ChainConfig | undefined) => void
}

const DEFAULT_CONFIG: ChainConfig = {
  nextTitle: '',
  nextPrompt: '',
  autoStart: false,
  passOutputAs: 'none',
}

/**
 * M230: Collapsible form for configuring delegation chaining.
 * Shown when creating or editing a delegation.
 */
export function ChainConfigForm({ value, onChange }: ChainConfigFormProps) {
  const [expanded, setExpanded] = useState(!!value)
  const enabled = !!value

  function handleToggleEnabled() {
    if (enabled) {
      onChange(undefined)
      setExpanded(false)
    } else {
      onChange({ ...DEFAULT_CONFIG })
      setExpanded(true)
    }
  }

  function update(patch: Partial<ChainConfig>) {
    if (!value) return
    onChange({ ...value, ...patch })
  }

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => {
          if (!enabled) {
            handleToggleEnabled()
          } else {
            setExpanded(prev => !prev)
          }
        }}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-900 hover:bg-gray-800 transition-colors text-sm text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-gray-400">⛓</span>
          <span className="text-gray-300 font-medium">Kette mit nächster Delegation</span>
          {enabled && (
            <span className="px-1.5 py-0.5 text-xs rounded bg-violet-900/50 text-violet-300 border border-violet-700">
              aktiv
            </span>
          )}
        </div>
        <span className="text-gray-600 text-xs">{expanded && enabled ? '▲' : '▼'}</span>
      </button>

      {/* Toggle row — always visible when panel is open */}
      {(expanded || enabled) && (
        <div className="px-4 pt-3 pb-1 bg-gray-950">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              role="switch"
              aria-checked={enabled}
              onClick={handleToggleEnabled}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                enabled ? 'bg-violet-600' : 'bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                  enabled ? 'translate-x-4' : 'translate-x-1'
                }`}
              />
            </div>
            <span className="text-sm text-gray-300">Nach Abschluss automatisch fortsetzen</span>
          </label>
        </div>
      )}

      {/* Fields — only when enabled + expanded */}
      {enabled && expanded && value && (
        <div className="px-4 pb-4 pt-2 bg-gray-950 space-y-4">
          {/* Next title */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Titel der nächsten Delegation
            </label>
            <input
              type="text"
              value={value.nextTitle}
              onChange={e => update({ nextTitle: e.target.value })}
              placeholder="z.B. Tests für das neue Feature schreiben"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-600 transition-colors"
            />
          </div>

          {/* Next prompt */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Aufgabe</label>
            <textarea
              rows={3}
              value={value.nextPrompt}
              onChange={e => update({ nextPrompt: e.target.value })}
              placeholder="Was soll die nächste Delegation tun?"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-600 transition-colors resize-none"
            />
          </div>

          {/* Pass output as context */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={value.passOutputAs === 'context'}
              onChange={e => update({ passOutputAs: e.target.checked ? 'context' : 'none' })}
              className="rounded border-gray-600 bg-gray-800 text-violet-500 focus:ring-violet-500"
            />
            <span className="text-sm text-gray-300">
              Ergebnis weitergeben{' '}
              <span className="text-gray-500 text-xs">(letzten 500 Zeichen als Kontext)</span>
            </span>
          </label>

          {/* Auto-start toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              role="switch"
              aria-checked={value.autoStart}
              onClick={() => update({ autoStart: !value.autoStart })}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                value.autoStart ? 'bg-violet-600' : 'bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                  value.autoStart ? 'translate-x-4' : 'translate-x-1'
                }`}
              />
            </div>
            <div>
              <span className="text-sm text-gray-300">Automatisch starten</span>
              <p className="text-xs text-gray-500">
                {value.autoStart
                  ? 'Nächste Delegation wird sofort ausgeführt'
                  : 'Nächste Delegation wird als Pending erstellt'}
              </p>
            </div>
          </label>
        </div>
      )}
    </div>
  )
}
