'use client'

import { useEffect, useState, useCallback } from 'react'
import { cx } from '@/components/ui/primitives'
import type { AIProviderConfig, AIModelSelection } from '@/lib/ai/providers/types'

function GroqQuickSetupBanner({ onActivated }: { onActivated: () => void }) {
  const [apiKey, setApiKey]     = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const handleActivate = async () => {
    if (!apiKey.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/settings/env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'GROQ_API_KEY', value: apiKey.trim() }),
      })
      const data = await res.json() as { ok: boolean; error?: string }
      if (!data.ok) {
        setError(data.error ?? 'Fehler beim Speichern')
      } else {
        onActivated()
      }
    } catch {
      setError('Netzwerkfehler — bitte erneut versuchen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative rounded-xl p-px overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #16a34a55 0%, #15803d80 50%, #14532d55 100%)' }}
    >
      <div className="rounded-[11px] bg-[#0a1a0f] px-5 py-4 space-y-3">
        <div className="flex items-start gap-3">
          <span className="text-lg leading-none mt-0.5">&#9889;</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-emerald-300">
              Groq: Kostenlos &amp; 10x schneller als Ollama
            </p>
            <p className="text-xs text-emerald-500/80 mt-0.5">
              Kein Credit Card nötig — einfach unter{' '}
              <a
                href="https://console.groq.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-emerald-300 transition-colors"
              >
                console.groq.com
              </a>{' '}
              registrieren und API Key hier einfügen.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { void handleActivate() } }}
            placeholder="gsk_..."
            className="flex-1 rounded-lg bg-black/40 border border-emerald-700/40 px-3 py-1.5 text-xs text-white placeholder-emerald-900 font-mono focus:outline-none focus:border-emerald-500/60 transition-colors"
          />
          <button
            onClick={() => { void handleActivate() }}
            disabled={saving || !apiKey.trim()}
            className="rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 px-4 py-1.5 text-xs font-semibold text-white transition-colors whitespace-nowrap"
          >
            {saving ? 'Speichern…' : 'Aktivieren'}
          </button>
        </div>
        {error && (
          <p className="text-xs text-rose-400">{error}</p>
        )}
      </div>
    </div>
  )
}

interface ProviderWithStatus extends AIProviderConfig {
  hasApiKey: boolean
}

interface ProvidersData {
  providers: ProviderWithStatus[]
  selection: AIModelSelection
}

const RESIDENCY_BADGE: Record<string, string> = {
  eu:      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  us:      'bg-amber-500/10 text-amber-400 border-amber-500/20',
  local:   'bg-violet-500/10 text-violet-400 border-violet-500/20',
  unknown: 'bg-slate-700/30 text-slate-500 border-slate-700',
}

const RESIDENCY_LABEL: Record<string, string> = {
  eu: '🇪🇺 EU', us: '🇺🇸 US', local: '💻 Lokal', unknown: '?',
}

const KEY_LABELS: Record<string, string> = {
  ANTHROPIC_API_KEY: 'Anthropic API Key',
  OPENAI_API_KEY:    'OpenAI API Key',
  GROQ_API_KEY:      'Groq API Key',
  MISTRAL_API_KEY:   'Mistral API Key',
  GOOGLE_API_KEY:    'Google API Key',
  TOGETHER_API_KEY:  'Together AI Key',
  SUPABASE_URL:      'Supabase URL',
  SUPABASE_ANON_KEY: 'Supabase Anon Key',
}

function ProviderCard({
  provider,
  selection,
  onToggle,
  onTest,
  onSelectModel,
}: {
  provider: ProviderWithStatus
  selection: AIModelSelection
  onToggle: (id: string, enabled: boolean) => void
  onTest: (id: string) => Promise<void>
  onSelectModel: (purpose: 'fast' | 'coding', providerId: string, modelId: string) => void
}) {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; latencyMs: number } | null>(null)

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    await onTest(provider.id)
    const res = await fetch(`/api/ai/providers/${provider.id}/test`, { method: 'POST' })
    const data = await res.json() as { ok: boolean; latencyMs: number }
    setTestResult(data)
    setTesting(false)
  }

  const isFastProvider   = selection.fastProvider   === provider.id
  const isCodingProvider = selection.codingProvider === provider.id

  const fastModels   = provider.models.filter(m => m.purpose === 'fast'   || m.purpose === 'both')
  const codingModels = provider.models.filter(m => m.purpose === 'coding' || m.purpose === 'both')

  return (
    <div className={cx(
      'rounded-xl border p-4 transition-all',
      provider.enabled
        ? 'border-violet-500/20 bg-violet-950/10'
        : 'border-white/[0.06] bg-white/[0.02]'
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cx(
            'h-2 w-2 rounded-full shrink-0',
            provider.enabled && provider.hasApiKey ? 'bg-emerald-400' :
            provider.enabled ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'
          )} />
          <p className="text-sm font-semibold text-white truncate">{provider.name}</p>
          {provider.isBuiltIn && (
            <span className="shrink-0 text-[10px] text-slate-600 border border-slate-700/50 rounded px-1">built-in</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cx('text-[10px] font-medium border rounded px-1.5 py-0.5', RESIDENCY_BADGE[provider.dataResidency])}>
            {RESIDENCY_LABEL[provider.dataResidency]}
          </span>
          <button
            onClick={() => onToggle(provider.id, !provider.enabled)}
            className={cx(
              'relative h-5 w-9 rounded-full transition-colors',
              provider.enabled ? 'bg-violet-600' : 'bg-slate-700'
            )}
          >
            <span className={cx(
              'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform shadow',
              provider.enabled ? 'translate-x-4' : 'translate-x-0.5'
            )} />
          </button>
        </div>
      </div>

      {/* API Key status */}
      {provider.apiKeyRef && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className={cx('text-xs', provider.hasApiKey ? 'text-emerald-400' : 'text-amber-400')}>
            {provider.hasApiKey ? '✓' : '⚠'}
          </span>
          <span className="text-xs text-slate-500">
            {provider.hasApiKey
              ? `${KEY_LABELS[provider.apiKeyRef] ?? provider.apiKeyRef} konfiguriert`
              : `${KEY_LABELS[provider.apiKeyRef] ?? provider.apiKeyRef} fehlt — in Settings → API Keys eintragen`
            }
          </span>
        </div>
      )}

      {provider.baseUrl && (
        <p className="mt-1 text-xs text-slate-600 font-mono truncate">{provider.baseUrl}</p>
      )}

      {/* Model selection (only when enabled) */}
      {provider.enabled && (
        <div className="mt-3 space-y-2">
          {fastModels.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 w-14 shrink-0">FAST</span>
              <select
                value={isFastProvider ? selection.fastModel : ''}
                onChange={e => onSelectModel('fast', provider.id, e.target.value)}
                className="flex-1 rounded bg-white/[0.04] border border-white/[0.08] px-2 py-1 text-xs text-slate-300"
              >
                {!isFastProvider && <option value="">— nicht ausgewählt —</option>}
                {fastModels.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              {!isFastProvider && (
                <button
                  onClick={() => onSelectModel('fast', provider.id, fastModels[0]?.id ?? '')}
                  className="text-xs text-violet-400 hover:underline shrink-0"
                >
                  Wählen
                </button>
              )}
              {isFastProvider && (
                <span className="text-[10px] text-violet-400 shrink-0">✓ aktiv</span>
              )}
            </div>
          )}

          {codingModels.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 w-14 shrink-0">CODING</span>
              <select
                value={isCodingProvider ? selection.codingModel : ''}
                onChange={e => onSelectModel('coding', provider.id, e.target.value)}
                className="flex-1 rounded bg-white/[0.04] border border-white/[0.08] px-2 py-1 text-xs text-slate-300"
              >
                {!isCodingProvider && <option value="">— nicht ausgewählt —</option>}
                {codingModels.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              {!isCodingProvider && (
                <button
                  onClick={() => onSelectModel('coding', provider.id, codingModels[0]?.id ?? '')}
                  className="text-xs text-violet-400 hover:underline shrink-0"
                >
                  Wählen
                </button>
              )}
              {isCodingProvider && (
                <span className="text-[10px] text-violet-400 shrink-0">✓ aktiv</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Test button */}
      {provider.enabled && (
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={handleTest}
            disabled={testing}
            className="text-xs text-slate-400 hover:text-white border border-white/[0.08] rounded px-2 py-1 transition-colors disabled:opacity-40"
          >
            {testing ? 'Testen…' : '⚡ Verbindung testen'}
          </button>
          {testResult && (
            <span className={cx('text-xs', testResult.ok ? 'text-emerald-400' : 'text-rose-400')}>
              {testResult.ok ? `✓ OK (${testResult.latencyMs}ms)` : '✗ Nicht erreichbar'}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function AddCustomProviderForm({ onAdd }: { onAdd: (config: Partial<AIProviderConfig> & { id: string }) => void }) {
  const [name, setName]       = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey]   = useState('')

  const handleSubmit = () => {
    if (!name.trim() || !baseUrl.trim()) return
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-')
    onAdd({
      id,
      type: 'openai-compatible',
      name: name.trim(),
      baseUrl: baseUrl.trim(),
      apiKeyRef: apiKey ? `CUSTOM_${id.toUpperCase().replace(/-/g, '_')}_KEY` : '',
      models: [{ id: 'default', name: 'Default', purpose: 'both' }],
      enabled: true,
      isBuiltIn: false,
      dataResidency: 'unknown',
    })
    setName('')
    setBaseUrl('')
    setApiKey('')
  }

  return (
    <div className="rounded-xl border border-dashed border-white/[0.12] bg-white/[0.01] p-4">
      <p className="text-xs font-semibold text-slate-400 mb-3">+ Eigenen Provider hinzufügen (OpenAI-kompatibel)</p>
      <div className="space-y-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Name (z.B. My LLM Server)"
          className="w-full rounded bg-white/[0.04] border border-white/[0.08] px-3 py-1.5 text-xs text-white placeholder-slate-600"
        />
        <input
          value={baseUrl}
          onChange={e => setBaseUrl(e.target.value)}
          placeholder="Base URL (z.B. http://192.168.1.100:8000/v1)"
          className="w-full rounded bg-white/[0.04] border border-white/[0.08] px-3 py-1.5 text-xs text-white placeholder-slate-600 font-mono"
        />
        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !baseUrl.trim()}
            className="rounded bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-600 disabled:opacity-40 transition-colors"
          >
            Hinzufügen
          </button>
          <p className="text-[10px] text-slate-600 self-center">
            Jeder OpenAI-kompatible Endpunkt funktioniert (vLLM, LocalAI, Jan, etc.)
          </p>
        </div>
      </div>
    </div>
  )
}

export default function ProvidersPage() {
  const [data, setData]       = useState<ProvidersData | null>(null)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  const load = useCallback(() => {
    fetch('/api/ai/providers')
      .then(r => r.json())
      .then((d: ProvidersData) => setData(d))
      .catch(() => null)
  }, [])

  useEffect(() => { load() }, [load])

  const save = async (update: { provider?: Partial<AIProviderConfig> & { id: string }; selection?: AIModelSelection }) => {
    setSaving(true)
    await fetch('/api/ai/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    })
    load()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleToggle = (id: string, enabled: boolean) => {
    save({ provider: { id, enabled } })
  }

  const handleSelectModel = (purpose: 'fast' | 'coding', providerId: string, modelId: string) => {
    if (!data || !modelId) return
    const newSelection = {
      ...data.selection,
      ...(purpose === 'fast'
        ? { fastProvider: providerId, fastModel: modelId }
        : { codingProvider: providerId, codingModel: modelId }
      ),
    }
    save({ selection: newSelection })
  }

  const handleAddCustom = (config: Partial<AIProviderConfig> & { id: string }) => {
    save({ provider: config })
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-[#08080d] flex items-center justify-center">
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <span key={i} className="h-2 w-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
          ))}
        </div>
      </main>
    )
  }

  const localProviders   = data.providers.filter(p => p.dataResidency === 'local')
  const cloudProviders   = data.providers.filter(p => p.dataResidency !== 'local')
  const activeSelection  = data.selection

  const groqProvider     = data.providers.find(p => p.id === 'groq')
  const showGroqBanner   = groqProvider != null && !groqProvider.hasApiKey

  return (
    <main className="min-h-screen bg-[#08080d]">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/settings" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">← Settings</a>
          <span className="text-slate-700">/</span>
          <span className="text-sm text-slate-400">AI Providers</span>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-emerald-400">✓ Gespeichert</span>}
          {saving && <span className="text-xs text-slate-500">Speichern…</span>}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* Groq Quick-Setup Banner — shown when Groq has no API key */}
        {showGroqBanner && (
          <GroqQuickSetupBanner onActivated={() => { window.location.reload() }} />
        )}

        {/* Active selection summary */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Aktive Konfiguration</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-slate-600 mb-1">FAST (Haiku-Klasse)</p>
              <p className="text-sm font-medium text-white">{data.providers.find(p => p.id === activeSelection.fastProvider)?.name ?? activeSelection.fastProvider}</p>
              <p className="text-xs text-violet-400 font-mono">{activeSelection.fastModel}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-600 mb-1">CODING (Sonnet-Klasse)</p>
              <p className="text-sm font-medium text-white">{data.providers.find(p => p.id === activeSelection.codingProvider)?.name ?? activeSelection.codingProvider}</p>
              <p className="text-xs text-violet-400 font-mono">{activeSelection.codingModel}</p>
            </div>
          </div>
        </div>

        {/* Cloud providers */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
            Cloud Provider
          </h2>
          <div className="space-y-3">
            {cloudProviders.map(p => (
              <ProviderCard
                key={p.id}
                provider={p}
                selection={activeSelection}
                onToggle={handleToggle}
                onTest={async () => {}}
                onSelectModel={handleSelectModel}
              />
            ))}
          </div>
        </section>

        {/* Local providers */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Lokal (DSGVO-konform, kein API-Key)
            </h2>
            <span className="text-[10px] border border-emerald-500/20 text-emerald-400 rounded px-1">100% privat</span>
          </div>
          <div className="space-y-3">
            {localProviders.map(p => (
              <ProviderCard
                key={p.id}
                provider={p}
                selection={activeSelection}
                onToggle={handleToggle}
                onTest={async () => {}}
                onSelectModel={handleSelectModel}
              />
            ))}
          </div>
        </section>

        {/* Add custom */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
            Eigener Provider
          </h2>
          <AddCustomProviderForm onAdd={handleAddCustom} />
        </section>

        {/* Info box */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs text-slate-500 space-y-1">
          <p className="font-medium text-slate-400">Wie füge ich einen neuen Provider hinzu?</p>
          <p>Jeder OpenAI-kompatible Endpunkt funktioniert — einfach Name + Base URL eintragen.</p>
          <p>API-Keys werden in Settings → API Keys gespeichert (verschlüsselt, nur lokal).</p>
          <p>Env-Vars: <span className="font-mono text-violet-400">OPENAI_API_KEY</span>, <span className="font-mono text-violet-400">GROQ_API_KEY</span>, <span className="font-mono text-violet-400">MISTRAL_API_KEY</span>, <span className="font-mono text-violet-400">GOOGLE_API_KEY</span>, <span className="font-mono text-violet-400">TOGETHER_API_KEY</span></p>
          <p>Datenresidenz: EU-Provider (Mistral) bevorzugen wenn DSGVO-kritisch.</p>
        </div>
      </div>
    </main>
  )
}
