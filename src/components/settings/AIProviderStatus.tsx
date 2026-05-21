'use client'

import { useEffect, useState } from 'react'
import type { AIStatus } from '@/app/api/ai/status/route'
import { cx } from '@/components/ui/primitives'

const panelClassName = 'rounded-lg border border-white/[0.07] bg-white/[0.035] p-4 shadow-sm shadow-black/10'

interface ProviderRowProps {
  label: string
  status: 'ok' | 'warn' | 'off'
  detail: string
}

function ProviderRow({ label, status, detail }: ProviderRowProps) {
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
        <span className={cx('text-sm font-medium', labelColor)}>{label}</span>
      </div>
      <span className="text-xs text-slate-400 text-right">{detail}</span>
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

  const anthropicDetail = status.anthropicConfigured ? 'API Key konfiguriert' : 'Kein Key'
  const anthropicStatus: ProviderRowProps['status'] = status.anthropicConfigured ? 'ok' : 'off'

  let ollamaDetail: string
  let ollamaStatus: ProviderRowProps['status']
  if (!status.ollamaRunning) {
    ollamaDetail = 'Nicht erreichbar'
    ollamaStatus = 'off'
  } else if (status.ollamaModels.length === 0) {
    ollamaDetail = 'Läuft, aber keine Modelle'
    ollamaStatus = 'warn'
  } else {
    ollamaDetail = `${status.ollamaModels.length} Modell${status.ollamaModels.length !== 1 ? 'e' : ''} installiert`
    ollamaStatus = 'ok'
  }

  const activeLabel =
    status.activeProvider === 'anthropic'
      ? 'Anthropic API'
      : status.activeProvider === 'ollama'
      ? `Ollama${status.activeModel ? ` (${status.activeModel})` : ''}`
      : '—'

  const activeTone =
    status.activeProvider === 'none'
      ? 'text-red-400'
      : status.activeProvider === 'ollama'
      ? 'text-emerald-300'
      : 'text-violet-300'

  return (
    <div className={cx(panelClassName, 'space-y-3')}>
      <ProviderRow
        label="Anthropic API"
        status={anthropicStatus}
        detail={anthropicDetail}
      />
      <ProviderRow
        label="Ollama lokal"
        status={ollamaStatus}
        detail={ollamaDetail}
      />

      <div className="border-t border-white/[0.06] pt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500">Aktiv:</span>
        <span className={cx('text-xs font-semibold', activeTone)}>{activeLabel}</span>
      </div>

      {status.activeProvider === 'none' && (
        <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-300">
          {status.recommendation}
        </div>
      )}

      {!status.ollamaRunning && (
        <a
          href="https://ollama.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
        >
          Ollama installieren →
        </a>
      )}

      {status.ollamaRunning && status.ollamaModels.length === 0 && (
        <p className="text-xs text-slate-500">
          Kein Modell installiert — Terminal:{' '}
          <code className="bg-slate-800 px-1 rounded text-slate-300">ollama pull llama3.2</code>
        </p>
      )}
    </div>
  )
}
