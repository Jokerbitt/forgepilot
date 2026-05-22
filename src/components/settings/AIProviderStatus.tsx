'use client'

import { useEffect, useState } from 'react'
import type { AIStatus } from '@/app/api/ai/status/route'
import { cx } from '@/components/ui/primitives'

const panelClassName = 'rounded-lg border border-white/[0.07] bg-white/[0.035] p-4 shadow-sm shadow-black/10'

interface ProviderRowProps {
  id: string
  label: string
  status: 'ok' | 'warn' | 'off'
  detail: string
  meta?: string
  testState?: 'idle' | 'testing' | 'ok' | 'error'
  testDetail?: string
  onTest?: (id: string) => void
}

function ProviderRow({ id, label, status, detail, meta, testState = 'idle', testDetail, onTest }: ProviderRowProps) {
  const icon =
    status === 'ok'
      ? <span className="text-emerald-400 text-sm font-bold">✓</span>
      : status === 'warn'
      ? <span className="text-amber-400 text-sm font-bold">!</span>
      : <span className="text-slate-600 text-sm font-bold">○</span>

  const labelColor =
    status === 'ok'
      ? 'text-slate-200'
      : status === 'warn'
      ? 'text-amber-200'
      : 'text-slate-500'

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-5 text-center shrink-0">{icon}</span>
        <div className="min-w-0">
          <span className={cx('block truncate text-sm font-medium', labelColor)}>{label}</span>
          {(testDetail || meta) && (
            <span className="block truncate text-[10px] text-slate-500">{testDetail ?? meta}</span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-right text-xs text-slate-400">{detail}</span>
        {onTest && (
          <button
            type="button"
            onClick={() => onTest(id)}
            disabled={testState === 'testing'}
            className={cx(
              'rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors disabled:cursor-wait disabled:opacity-50',
              testState === 'ok'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : testState === 'error'
                  ? 'border-red-500/30 bg-red-500/10 text-red-300'
                  : 'border-white/[0.08] bg-white/[0.04] text-slate-300 hover:bg-white/[0.07]'
            )}
          >
            {testState === 'testing' ? 'Teste...' : testState === 'ok' ? 'OK' : testState === 'error' ? 'Fehler' : 'Test'}
          </button>
        )}
      </div>
    </div>
  )
}

export function AIProviderStatus() {
  const [status, setStatus] = useState<AIStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [testResults, setTestResults] = useState<Record<string, { state: 'idle' | 'testing' | 'ok' | 'error'; detail?: string }>>({})

  useEffect(() => {
    fetch('/api/ai/status')
      .then(r => r.json())
      .then((data: AIStatus) => {
        setStatus(data)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className={cx(panelClassName, 'text-sm text-slate-500 animate-pulse')}>
        KI-Status wird geprüft...
      </div>
    )
  }

  if (error || !status) {
    return (
      <div className={cx(panelClassName, 'text-sm text-red-400')}>
        KI-Status konnte nicht geladen werden.
      </div>
    )
  }

  const visibleProviders = status.providerAvailability
    .filter(provider => provider.available || provider.isLocal || ['anthropic', 'xai', 'openai', 'groq', 'google-gemini', 'openrouter'].includes(provider.id))
    .slice(0, 10)

  const activeLabel = status.activeProvider === 'none'
    ? '—'
    : `${status.activeProvider}${status.activeModel ? ` (${status.activeModel})` : ''}`

  const activeTone =
    status.activeProvider === 'none'
      ? 'text-red-400'
      : status.activeProvider === 'ollama'
      ? 'text-emerald-300'
      : 'text-violet-300'

  const handleTestProvider = async (providerId: string) => {
    setTestResults(prev => ({
      ...prev,
      [providerId]: { state: 'testing', detail: 'Verbindung wird geprueft...' },
    }))
    try {
      const res = await fetch(`/api/ai/providers/${encodeURIComponent(providerId)}/test`, { method: 'POST' })
      const data = await res.json() as { ok?: boolean; latencyMs?: number; error?: string }
      setTestResults(prev => ({
        ...prev,
        [providerId]: {
          state: res.ok && data.ok ? 'ok' : 'error',
          detail: res.ok && data.ok
            ? `Erreichbar in ${data.latencyMs ?? 0} ms`
            : data.error ?? 'Provider antwortet nicht',
        },
      }))
    } catch {
      setTestResults(prev => ({
        ...prev,
        [providerId]: { state: 'error', detail: 'Test fehlgeschlagen' },
      }))
    }
  }

  return (
    <div className={cx(panelClassName, 'space-y-3')}>
      {visibleProviders.map(provider => {
        const rowStatus: ProviderRowProps['status'] = provider.available
          ? 'ok'
          : provider.status === 'local-offline'
            ? 'warn'
            : 'off'
        const detail = provider.available
          ? 'verbunden'
          : provider.isLocal
            ? 'nicht aktiv'
            : 'Key fehlt'
        return (
          <ProviderRow
            key={provider.id}
            id={provider.id}
            label={provider.name}
            status={rowStatus}
            detail={detail}
            meta={provider.available ? provider.model : provider.reason}
            testState={testResults[provider.id]?.state ?? 'idle'}
            testDetail={testResults[provider.id]?.detail}
            onTest={handleTestProvider}
          />
        )
      })}

      <div className="border-t border-white/[0.06] pt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500">Auto-Router:</span>
        <span className={cx('text-xs font-semibold', activeTone)}>{activeLabel}</span>
      </div>

      {status.activeProvider === 'none' && (
        <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-300">
          {status.recommendation}
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-slate-500">
        Geheimwerte werden nie angezeigt. Auto bevorzugt den besten konfigurierten Provider und nutzt lokale Modelle, wenn sie verfuegbar sind.
      </p>
    </div>
  )
}
