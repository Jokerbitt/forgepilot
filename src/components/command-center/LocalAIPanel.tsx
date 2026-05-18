'use client'

import { useEffect, useState } from 'react'
import type { LocalAIStatusResult, ProviderStatus } from '@/app/api/local-ai/status/route'

const PRIVACY_LABELS: Record<LocalAIStatusResult['defaultPrivacyMode'], string> = {
  'local-only': 'Local Only',
  hybrid: 'Hybrid',
  'cloud-approved': 'Cloud Approved',
}

const PRIVACY_STYLES: Record<LocalAIStatusResult['defaultPrivacyMode'], string> = {
  'local-only': 'border-emerald-700/50 bg-emerald-950/20 text-emerald-200',
  hybrid: 'border-amber-700/50 bg-amber-950/20 text-amber-200',
  'cloud-approved': 'border-sky-700/50 bg-sky-950/20 text-sky-200',
}

const STATUS_DOT: Record<ProviderStatus['status'], string> = {
  healthy: 'bg-emerald-400',
  degraded: 'bg-amber-400',
  offline: 'bg-slate-600',
}

const STATUS_LABEL: Record<ProviderStatus['status'], string> = {
  healthy: 'aktiv',
  degraded: 'eingeschränkt',
  offline: 'offline',
}

export function LocalAIPanel() {
  const [data, setData] = useState<LocalAIStatusResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/local-ai/status')
      .then(r => r.json() as Promise<LocalAIStatusResult>)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <section className="border border-slate-800 bg-slate-900/50 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Local AI</p>
        <div className="mt-3 flex gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 flex-1 animate-pulse rounded border border-slate-800 bg-slate-800/50" />
          ))}
        </div>
      </section>
    )
  }

  if (!data) return null

  const providers = [data.ollama, data.anthropic, data.claudeCode]
  const activeCount = providers.filter(p => p.status === 'healthy').length

  return (
    <section className="border border-slate-800 bg-slate-900/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Local AI &amp; Modelle</p>
          <p className="mt-0.5 text-xs text-slate-500">{activeCount}/{providers.length} Provider aktiv</p>
        </div>
        <span className={`rounded border px-2 py-0.5 text-xs font-medium ${PRIVACY_STYLES[data.defaultPrivacyMode]}`}>
          {PRIVACY_LABELS[data.defaultPrivacyMode]}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {providers.map(provider => (
          <ProviderCard key={provider.name} provider={provider} />
        ))}
      </div>

      {data.ollama.status === 'healthy' && data.ollama.models && data.ollama.models.length > 0 && (
        <div className="mt-3 border-t border-slate-800 pt-3">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">Verfügbare Modelle</p>
          <div className="flex flex-wrap gap-1.5">
            {data.ollama.models.map(model => (
              <span key={model} className="rounded border border-slate-700 bg-slate-950 px-2 py-0.5 text-xs text-slate-300">
                {model}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function ProviderCard({ provider }: { provider: ProviderStatus }) {
  return (
    <div className="border border-slate-800 bg-slate-950 p-2.5">
      <div className="mb-2 flex items-center justify-between gap-1">
        <p className="truncate text-xs font-medium text-slate-300">{provider.name}</p>
        <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[provider.status]}`} />
      </div>
      <p className="text-xs text-slate-500">{STATUS_LABEL[provider.status]}</p>
      <p className="mt-1 truncate text-[11px] text-slate-600">{provider.detail}</p>
    </div>
  )
}
