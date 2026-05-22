'use client'

import { useEffect, useState } from 'react'
import type { AIStatus } from '@/app/api/ai/status/route'
import { cx } from '@/components/ui/primitives'

const panelClassName = 'rounded-lg border border-white/[0.07] bg-white/[0.035] p-4 shadow-sm shadow-black/10'

interface ProviderRowProps {
  label: string
  status: 'ok' | 'warn' | 'off'
  detail: string
  meta?: string
}

function ProviderRow({ label, status, detail, meta }: ProviderRowProps) {
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
          {meta && <span className="block truncate text-[10px] text-slate-500">{meta}</span>}
        </div>
      </div>
      <span className="shrink-0 text-xs text-slate-400 text-right">{detail}</span>
    </div>
  )
}

export function AIProviderStatus() {
  const [status, setStatus] = useState<AIStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

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
            label={provider.name}
            status={rowStatus}
            detail={detail}
            meta={provider.available ? provider.model : provider.reason}
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
