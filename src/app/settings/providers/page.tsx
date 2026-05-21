'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import { cx } from '@/components/ui/primitives'
import type { AIProviderConfig, AIModelSelection, AIModelDef } from '@/lib/ai/providers/types'

// ─── Provider Health Types ────────────────────────────────────────────────────

type ProviderHealthStatus = 'healthy' | 'degraded' | 'unavailable' | 'unconfigured'

interface ProviderHealthEntry {
  providerId: string
  status: ProviderHealthStatus
  latencyMs?: number
  checkedAt: string
  error?: string
  failStreak: number
}

interface HealthReport {
  checkedAt: string | null
  providers: ProviderHealthEntry[]
  summary: { total: number; healthy: number; degraded: number; unavailable: number; unconfigured: number }
}

const HEALTH_DOT: Record<ProviderHealthStatus, string> = {
  healthy:      'bg-emerald-400',
  degraded:     'bg-amber-400 animate-pulse',
  unavailable:  'bg-red-400 animate-pulse',
  unconfigured: 'bg-slate-600',
}

const HEALTH_LABEL: Record<ProviderHealthStatus, string> = {
  healthy:      'erreichbar',
  degraded:     'langsam',
  unavailable:  'nicht erreichbar',
  unconfigured: 'kein API-Key',
}

// ─── Quick-Setup Banner (generic, reusable) ───────────────────────────────────

interface QuickSetupBannerProps {
  title: string
  subtitle: string
  icon: string
  bg: string             // tailwind bg hex e.g. '#0a1a0f'
  gradient: string       // inline gradient string
  placeholder: string
  envKey: string
  signupUrl: string
  onActivated: () => void
}

function QuickSetupBanner({
  title, subtitle, icon, bg, gradient, placeholder, envKey, signupUrl, onActivated,
}: QuickSetupBannerProps) {
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const handleActivate = async () => {
    if (!apiKey.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res  = await fetch('/api/settings/env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: envKey, value: apiKey.trim() }),
      })
      const data = await res.json() as { ok: boolean; error?: string }
      if (!data.ok) setError(data.error ?? 'Fehler beim Speichern')
      else onActivated()
    } catch {
      setError('Netzwerkfehler — bitte erneut versuchen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative rounded-xl p-px overflow-hidden" style={{ background: gradient }}>
      <div className="rounded-[11px] px-5 py-4 space-y-3" style={{ backgroundColor: bg }}>
        <div className="flex items-start gap-3">
          <span className="text-lg leading-none mt-0.5">{icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="text-xs text-white/50 mt-0.5">
              {subtitle}{' '}·{' '}
              <Link href={signupUrl} target="_blank" rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-white/80 transition-colors">
                {new URL(signupUrl).hostname}
              </Link>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { void handleActivate() } }}
            placeholder={placeholder}
            className="flex-1 rounded-lg bg-black/40 border border-white/10 px-3 py-1.5 text-xs text-white placeholder-white/20 font-mono focus:outline-none focus:border-white/30 transition-colors"
          />
          <button
            onClick={() => { void handleActivate() }}
            disabled={saving || !apiKey.trim()}
            className="rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 px-4 py-1.5 text-xs font-semibold text-white transition-colors whitespace-nowrap border border-white/10"
          >
            {saving ? 'Speichern…' : 'Aktivieren'}
          </button>
        </div>
        {error && <p className="text-xs text-rose-400">{error}</p>}
      </div>
    </div>
  )
}

// ─── Ollama URL Editor ────────────────────────────────────────────────────────

function OllamaUrlEditor({ currentUrl, onSaved }: { currentUrl: string; onSaved: (url: string) => void }) {
  const [editing, setEditing]     = useState(false)
  const [url, setUrl]             = useState(currentUrl)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)

  const handleSave = async () => {
    if (!url.trim()) return
    setSaving(true)
    try {
      await fetch('/api/ai/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: { id: 'ollama', baseUrl: url.trim() } }),
      })
      onSaved(url.trim())
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-slate-500 uppercase tracking-wide">Ollama URL</span>
        {!editing ? (
          <>
            <span className="text-xs font-mono text-violet-300">{currentUrl}</span>
            <button
              onClick={() => { setUrl(currentUrl); setEditing(true) }}
              className="text-[10px] text-slate-500 hover:text-slate-300 border border-white/[0.06] rounded px-1.5 py-0.5 transition-colors"
            >
              Bearbeiten
            </button>
            {saved && <span className="text-[10px] text-emerald-400">✓ Gespeichert</span>}
          </>
        ) : (
          <div className="flex items-center gap-2 w-full">
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { void handleSave() } if (e.key === 'Escape') { setEditing(false) } }}
              className="flex-1 rounded bg-black/40 border border-violet-500/30 px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-violet-400 transition-colors"
              placeholder="http://localhost:11434"
              autoFocus
            />
            <button
              onClick={() => { void handleSave() }}
              disabled={saving || !url.trim()}
              className="text-xs bg-violet-700 hover:bg-violet-600 disabled:opacity-40 rounded px-2 py-1 text-white transition-colors"
            >
              {saving ? '…' : 'OK'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-xs text-slate-500 hover:text-white transition-colors"
            >
              Abbrechen
            </button>
          </div>
        )}
      </div>
      <p className="text-[10px] text-slate-600 mt-1">
        Ändere die URL wenn Ollama auf einem anderen Host läuft (z.B. NAS oder Server).
      </p>
    </div>
  )
}

// ─── Ollama Auto-Detect ───────────────────────────────────────────────────────

interface OllamaDetectedModel {
  id: string
  name: string
  size: number
  modifiedAt: string
}

interface OllamaModelsApiResponse {
  models: OllamaDetectedModel[]
  error?: string
}

function OllamaAutoDetect({ baseUrl }: { baseUrl: string }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<OllamaModelsApiResponse | null>(null)

  const handleDetect = async () => {
    setLoading(true)
    setResult(null)
    try {
      const res  = await fetch(`/api/ai/providers/ollama-models?baseUrl=${encodeURIComponent(baseUrl)}`)
      const data = await res.json() as OllamaModelsApiResponse
      setResult(data)
    } catch {
      setResult({ models: [], error: 'Ollama not running' })
    } finally {
      setLoading(false)
    }
  }

  const formatSize = (bytes: number): string => `${(bytes / 1_073_741_824).toFixed(1)} GB`

  return (
    <div className="mt-3">
      <button
        onClick={() => { void handleDetect() }}
        disabled={loading}
        className="text-xs text-slate-400 hover:text-white border border-white/[0.08] rounded px-2 py-1 transition-colors disabled:opacity-40"
      >
        {loading ? 'Erkenne…' : '🔍 Modelle erkennen'}
      </button>

      {result && (
        <div className="mt-2">
          {result.error ? (
            <div className="rounded-lg border border-rose-500/20 bg-rose-950/20 px-3 py-2">
              <p className="text-xs text-rose-400">⚠ Ollama nicht erreichbar unter <span className="font-mono">{baseUrl}</span></p>
            </div>
          ) : result.models.length === 0 ? (
            <div className="rounded-lg border border-slate-700/40 bg-slate-900/40 px-3 py-2">
              <p className="text-xs text-slate-500">Keine Modelle gefunden — führe <span className="font-mono text-violet-400">ollama pull llama3</span> aus.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-700/40 bg-slate-900/40 px-3 py-2 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
                {result.models.length} Modell{result.models.length !== 1 ? 'e' : ''} gefunden
              </p>
              {result.models.map((model) => (
                <div key={model.id} className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-slate-300 truncate">{model.name}</span>
                  <span className="text-[10px] text-slate-500 shrink-0">{formatSize(model.size)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Provider Card ────────────────────────────────────────────────────────────

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
  ANTHROPIC_API_KEY:  'Anthropic API Key',
  OPENAI_API_KEY:     'OpenAI API Key',
  GROQ_API_KEY:       'Groq API Key',
  MISTRAL_API_KEY:    'Mistral API Key',
  GOOGLE_API_KEY:     'Google API Key',
  TOGETHER_API_KEY:   'Together AI Key',
  OPENROUTER_API_KEY: 'OpenRouter API Key',
  DEEPSEEK_API_KEY:   'DeepSeek API Key',
  XAI_API_KEY:        'xAI API Key',
  CEREBRAS_API_KEY:   'Cerebras API Key',
  SAMBANOVA_API_KEY:  'SambaNova API Key',
  PERPLEXITY_API_KEY: 'Perplexity API Key',
  FIREWORKS_API_KEY:  'Fireworks API Key',
  DEEPINFRA_API_KEY:  'Deepinfra API Key',
  COHERE_API_KEY:     'Cohere API Key',
  NVIDIA_API_KEY:     'Nvidia NIM API Key',
  SUPABASE_URL:       'Supabase URL',
  SUPABASE_ANON_KEY:  'Supabase Anon Key',
}

function FreeTierBadge({ limit, unverified }: { limit: string; unverified?: boolean }) {
  return (
    <span
      className="text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 rounded px-1.5 py-0.5 shrink-0"
      title={unverified ? 'Free-Tier-Angabe ist ein Richtwert und muss beim Anbieter geprüft werden.' : undefined}
    >
      {limit}{unverified ? ' · Richtwert' : ''}
    </span>
  )
}

function FreeModelLabel() {
  return <span className="text-[9px] text-emerald-400 font-medium ml-1">FREE</span>
}

// ─── Inline API Key Entry (shown inside ProviderCard when key is missing) ─────

function InlineKeyEntry({
  envKey,
  providerName,
  signupUrl,
  onSaved,
}: {
  envKey: string
  providerName: string
  signupUrl?: string
  onSaved: () => void
}) {
  const [open, setOpen]     = useState(false)
  const [value, setValue]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const handleSave = async () => {
    if (!value.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res  = await fetch('/api/settings/env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: envKey, value: value.trim() }),
      })
      const data = await res.json() as { ok: boolean; error?: string }
      if (!data.ok) setError(data.error ?? 'Fehler beim Speichern')
      else { setValue(''); setOpen(false); onSaved() }
    } catch {
      setError('Netzwerkfehler')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-violet-400 hover:text-violet-300 border border-violet-500/20 hover:border-violet-500/40 rounded px-2 py-0.5 transition-colors"
      >
        + API Key eingeben
      </button>
    )
  }

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-2">
        <input
          type="password"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { void handleSave() } if (e.key === 'Escape') { setOpen(false) } }}
          placeholder={`${providerName} API Key…`}
          className="flex-1 rounded bg-black/40 border border-violet-500/30 px-2 py-1 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-violet-400 transition-colors"
          autoFocus
        />
        <button
          onClick={() => { void handleSave() }}
          disabled={saving || !value.trim()}
          className="rounded bg-violet-700 hover:bg-violet-600 disabled:opacity-40 px-2.5 py-1 text-xs font-semibold text-white transition-colors whitespace-nowrap"
        >
          {saving ? '…' : 'Speichern'}
        </button>
        <button onClick={() => setOpen(false)} className="text-slate-600 hover:text-slate-400 text-xs">✕</button>
      </div>
      {error && <p className="text-[10px] text-rose-400">{error}</p>}
      {signupUrl && (
        <p className="text-[10px] text-slate-600">
          Noch kein Key?{' '}
          <Link href={signupUrl} target="_blank" rel="noopener noreferrer"
            className="text-violet-400 hover:text-violet-300 underline underline-offset-2">
            Kostenlos holen →
          </Link>
        </p>
      )}
    </div>
  )
}

// ─── Custom BaseUrl Editor (for any provider, not just Ollama) ────────────────

function BaseUrlEditor({
  providerId,
  currentUrl,
  onSaved,
}: {
  providerId: string
  currentUrl: string
  onSaved: (url: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [url, setUrl]         = useState(currentUrl)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  const handleSave = async () => {
    if (!url.trim()) return
    setSaving(true)
    try {
      await fetch('/api/ai/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: { id: providerId, baseUrl: url.trim() } }),
      })
      onSaved(url.trim())
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-1">
      {!editing ? (
        <>
          <span className="text-xs font-mono text-slate-600 truncate max-w-[200px]">{url}</span>
          <button
            onClick={() => { setUrl(currentUrl); setEditing(true) }}
            className="text-[10px] text-slate-600 hover:text-slate-400 border border-white/[0.06] rounded px-1 py-0.5 transition-colors shrink-0"
          >
            ✏
          </button>
          {saved && <span className="text-[10px] text-emerald-400">✓</span>}
        </>
      ) : (
        <div className="flex items-center gap-1.5 w-full">
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { void handleSave() } if (e.key === 'Escape') { setEditing(false) } }}
            className="flex-1 rounded bg-black/40 border border-violet-500/30 px-2 py-0.5 text-xs font-mono text-white focus:outline-none focus:border-violet-400 transition-colors min-w-0"
            autoFocus
          />
          <button onClick={() => { void handleSave() }} disabled={saving || !url.trim()}
            className="text-[10px] bg-violet-700 hover:bg-violet-600 disabled:opacity-40 rounded px-2 py-0.5 text-white transition-colors shrink-0">
            {saving ? '…' : 'OK'}
          </button>
          <button onClick={() => setEditing(false)} className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors shrink-0">✕</button>
        </div>
      )}
    </div>
  )
}

function ProviderCard({
  provider,
  selection,
  healthEntry,
  onToggle,
  onTest,
  onSelectModel,
  onProviderUpdate,
  onKeyAdded,
}: {
  provider: ProviderWithStatus
  selection: AIModelSelection
  healthEntry?: ProviderHealthEntry
  onToggle: (id: string, enabled: boolean) => void
  onTest: (id: string) => Promise<void>
  onSelectModel: (purpose: 'fast' | 'coding', providerId: string, modelId: string) => void
  onProviderUpdate: (patch: Partial<AIProviderConfig> & { id: string }) => void
  onKeyAdded: () => void
}) {
  const [testing, setTesting]       = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; latencyMs: number } | null>(null)
  const [baseUrl, setBaseUrl]       = useState(provider.baseUrl ?? '')

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    await onTest(provider.id)
    const res  = await fetch(`/api/ai/providers/${provider.id}/test`, { method: 'POST' })
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
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <div className={cx(
            'h-2 w-2 rounded-full shrink-0',
            provider.enabled && provider.hasApiKey ? 'bg-emerald-400' :
            provider.enabled ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'
          )} />
          <p className="text-sm font-semibold text-white truncate">{provider.name}</p>
          {provider.isBuiltIn && (
            <span className="shrink-0 text-[10px] text-slate-600 border border-slate-700/50 rounded px-1">built-in</span>
          )}
          {provider.freeTier && (
            <FreeTierBadge
              limit={provider.freeTier.limit}
              unverified={provider.freeTier.verification?.status === 'unverified'}
            />
          )}
          {/* Health status badge */}
          {healthEntry && (
            <span
              title={`${HEALTH_LABEL[healthEntry.status]}${healthEntry.latencyMs != null ? ` · ${healthEntry.latencyMs}ms` : ''}${healthEntry.failStreak > 0 ? ` · ${healthEntry.failStreak}× Fehler` : ''}`}
              className="flex items-center gap-1 shrink-0"
            >
              <span className={cx('h-1.5 w-1.5 rounded-full', HEALTH_DOT[healthEntry.status])} />
              {healthEntry.latencyMs != null && healthEntry.status !== 'unconfigured' && (
                <span className="text-[10px] text-slate-500 font-mono">{healthEntry.latencyMs}ms</span>
              )}
              {healthEntry.failStreak >= 2 && (
                <span className="text-[10px] text-red-400">↯{healthEntry.failStreak}</span>
              )}
            </span>
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

      {/* API Key status + inline entry */}
      {provider.apiKeyRef && (
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cx('text-xs', provider.hasApiKey ? 'text-emerald-400' : 'text-amber-400')}>
              {provider.hasApiKey ? '✓' : '⚠'}
            </span>
            <span className="text-xs text-slate-500">
              {provider.hasApiKey
                ? `${KEY_LABELS[provider.apiKeyRef] ?? provider.apiKeyRef} konfiguriert`
                : `${KEY_LABELS[provider.apiKeyRef] ?? provider.apiKeyRef} fehlt`
              }
            </span>
          </div>
          {/* Inline key entry — shown when key is missing */}
          {!provider.hasApiKey && (
            <InlineKeyEntry
              envKey={provider.apiKeyRef}
              providerName={provider.name}
              signupUrl={provider.freeTier?.signupUrl}
              onSaved={onKeyAdded}
            />
          )}
        </div>
      )}

      {/* BaseUrl editor — shown for all providers with a baseUrl */}
      {provider.baseUrl && provider.type !== 'ollama' && (
        <div className="mt-2">
          <span className="text-[10px] text-slate-600 uppercase tracking-wide">Base URL</span>
          <BaseUrlEditor
            providerId={provider.id}
            currentUrl={baseUrl}
            onSaved={(newUrl) => {
              setBaseUrl(newUrl)
              onProviderUpdate({ id: provider.id, baseUrl: newUrl })
            }}
          />
        </div>
      )}

      {/* Ollama URL editor (more prominent, with helper text) */}
      {provider.type === 'ollama' && (
        <OllamaUrlEditor
          currentUrl={baseUrl || 'http://localhost:11434'}
          onSaved={(newUrl) => {
            setBaseUrl(newUrl)
            onProviderUpdate({ id: 'ollama', baseUrl: newUrl })
          }}
        />
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
                  <option key={m.id} value={m.id}>
                    {m.name}{m.isFree ? ' ✦FREE' : ''}
                    {m.costPer1kInput !== undefined && m.costPer1kInput > 0
                      ? ` ($${m.costPer1kInput}/1k)` : ''}
                  </option>
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
                  <option key={m.id} value={m.id}>
                    {m.name}{m.isFree ? ' ✦FREE' : ''}
                    {m.costPer1kInput !== undefined && m.costPer1kInput > 0
                      ? ` ($${m.costPer1kInput}/1k)` : ''}
                  </option>
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

      {/* Free-model quick labels when not enabled */}
      {!provider.enabled && provider.models.some(m => m.isFree) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {provider.models.filter(m => m.isFree).slice(0, 3).map(m => (
            <span key={m.id} className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 rounded px-1.5 py-0.5 font-mono">
              {m.name} <FreeModelLabel />
            </span>
          ))}
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

      {/* Ollama auto-detect */}
      {provider.type === 'ollama' && (
        <OllamaAutoDetect baseUrl={provider.baseUrl ?? 'http://localhost:11434'} />
      )}
    </div>
  )
}

// ─── Add Custom Provider Form ─────────────────────────────────────────────────

function AddCustomProviderForm({ onAdd }: { onAdd: (config: Partial<AIProviderConfig> & { id: string }) => void }) {
  const [name, setName]       = useState('')
  const [baseUrl, setBaseUrl] = useState('')

  const handleSubmit = () => {
    if (!name.trim() || !baseUrl.trim()) return
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-')
    onAdd({
      id,
      type: 'openai-compatible',
      name: name.trim(),
      baseUrl: baseUrl.trim(),
      apiKeyRef: `CUSTOM_${id.toUpperCase().replace(/-/g, '_')}_KEY`,
      models: [{ id: 'default', name: 'Default', purpose: 'both' }],
      enabled: true,
      isBuiltIn: false,
      dataResidency: 'unknown',
    })
    setName('')
    setBaseUrl('')
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
        <div className="flex gap-2 items-center">
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !baseUrl.trim()}
            className="rounded bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-600 disabled:opacity-40 transition-colors"
          >
            Hinzufügen
          </button>
          <p className="text-[10px] text-slate-600">
            Jeder OpenAI-kompatible Endpunkt funktioniert (vLLM, LocalAI, Jan, etc.)
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Model Picker ─────────────────────────────────────────────────────────────

interface ModelPickerRowProps {
  label: string
  subtitle: string
  purpose: 'fast' | 'coding'
  providers: ProviderWithStatus[]
  selectedProvider: string
  selectedModel: string
  onSave: (providerId: string, modelId: string) => Promise<void>
}

function ModelPickerRow({
  label, subtitle, purpose, providers, selectedProvider, selectedModel, onSave,
}: ModelPickerRowProps) {
  const [localProvider, setLocalProvider] = useState(selectedProvider)
  const [localModel,    setLocalModel]    = useState(selectedModel)
  const [saving,        setSaving]        = useState(false)
  const [saved,         setSaved]         = useState(false)

  useEffect(() => { setLocalProvider(selectedProvider) }, [selectedProvider])
  useEffect(() => { setLocalModel(selectedModel)       }, [selectedModel])

  const eligibleProviders = providers.filter(p =>
    p.models.some((m: AIModelDef) => m.purpose === purpose || m.purpose === 'both')
  )

  const modelsForProvider: AIModelDef[] = (() => {
    const p = providers.find(pr => pr.id === localProvider)
    if (!p) return []
    return p.models.filter((m: AIModelDef) => m.purpose === purpose || m.purpose === 'both')
  })()

  const handleProviderChange = (newProviderId: string) => {
    setLocalProvider(newProviderId)
    const p = providers.find(pr => pr.id === newProviderId)
    const firstModel = p?.models.find((m: AIModelDef) => m.purpose === purpose || m.purpose === 'both')
    setLocalModel(firstModel?.id ?? '')
  }

  const handleSave = async () => {
    if (!localProvider || !localModel) return
    setSaving(true)
    await onSave(localProvider, localModel)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const isDirty = localProvider !== selectedProvider || localModel !== selectedModel

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 ring-1 ring-slate-600/30">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saved && <span className="text-xs text-emerald-400">✓ Gespeichert</span>}
          <button
            onClick={() => { void handleSave() }}
            disabled={saving || !isDirty || !localProvider || !localModel}
            className={cx(
              'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
              isDirty && localProvider && localModel
                ? 'bg-violet-700 hover:bg-violet-600 text-white'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50'
            )}
          >
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Provider</label>
          <select
            value={localProvider}
            onChange={e => handleProviderChange(e.target.value)}
            className="w-full rounded-lg bg-slate-700 border border-slate-600 ring-1 ring-slate-600 hover:ring-slate-400 focus:ring-violet-500 focus:outline-none px-3 py-2 text-sm text-white transition-all"
          >
            {eligibleProviders.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}{!p.hasApiKey && p.apiKeyRef ? ' (kein Key)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Modell</label>
          <select
            value={localModel}
            onChange={e => setLocalModel(e.target.value)}
            disabled={modelsForProvider.length === 0}
            className="w-full rounded-lg bg-slate-700 border border-slate-600 ring-1 ring-slate-600 hover:ring-slate-400 focus:ring-violet-500 focus:outline-none px-3 py-2 text-sm text-white transition-all disabled:opacity-40"
          >
            {modelsForProvider.length === 0 && <option value="">— keine Modelle —</option>}
            {modelsForProvider.map(m => (
              <option key={m.id} value={m.id}>{m.name}{m.isFree ? ' ✦FREE' : ''}</option>
            ))}
          </select>
        </div>
      </div>
      {!isDirty && (
        <p className="mt-2 text-[10px] text-slate-600 font-mono">
          Aktiv: {selectedProvider} / {selectedModel}
        </p>
      )}
    </div>
  )
}

function ModelPickerSection({
  providers, selection, onSelectionChange,
}: {
  providers: ProviderWithStatus[]
  selection: AIModelSelection
  onSelectionChange: (selection: AIModelSelection) => void
}) {
  const handleFastSave = async (providerId: string, modelId: string) => {
    const updated: AIModelSelection = { ...selection, fastProvider: providerId, fastModel: modelId }
    await fetch('/api/ai/model-selection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fastProvider: providerId, fastModel: modelId }),
    })
    onSelectionChange(updated)
  }

  const handleCodingSave = async (providerId: string, modelId: string) => {
    const updated: AIModelSelection = { ...selection, codingProvider: providerId, codingModel: modelId }
    await fetch('/api/ai/model-selection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codingProvider: providerId, codingModel: modelId }),
    })
    onSelectionChange(updated)
  }

  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Modell-Auswahl</h2>
      <div className="space-y-3">
        <ModelPickerRow
          label="Schnelle Antworten (Fast)"
          subtitle="Für kurze Tasks, Chat — Haiku-Klasse"
          purpose="fast"
          providers={providers}
          selectedProvider={selection.fastProvider}
          selectedModel={selection.fastModel}
          onSave={handleFastSave}
        />
        <ModelPickerRow
          label="Komplexe Aufgaben (Coding)"
          subtitle="Für Code-Generierung, Research — Sonnet-Klasse"
          purpose="coding"
          providers={providers}
          selectedProvider={selection.codingProvider}
          selectedModel={selection.codingModel}
          onSave={handleCodingSave}
        />
      </div>
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// Providers that should show quick-setup banners (ordered by value)
const QUICK_SETUP_CONFIGS: Record<string, {
  title: string; subtitle: string; icon: string; bg: string
  gradient: string; placeholder: string; envKey: string; signupUrl: string
}> = {
  'google-gemini': {
    title: 'Google Gemini — Kostenlos, kein Kreditkarte',
    subtitle: '1.500 Requests/Tag gratis · Google-Account reicht',
    icon: '✨',
    bg: '#080f1a',
    gradient: 'linear-gradient(135deg, #3b82f655 0%, #2563eb80 50%, #1d4ed855 100%)',
    placeholder: 'AIza...',
    envKey: 'GOOGLE_API_KEY',
    signupUrl: 'https://aistudio.google.com',
  },
  groq: {
    title: 'Groq — Kostenlos & Blitzschnell',
    subtitle: '14.400 Requests/Tag · kein Kreditkarte nötig',
    icon: '⚡',
    bg: '#0a1a0f',
    gradient: 'linear-gradient(135deg, #16a34a55 0%, #15803d80 50%, #14532d55 100%)',
    placeholder: 'gsk_...',
    envKey: 'GROQ_API_KEY',
    signupUrl: 'https://console.groq.com',
  },
  cerebras: {
    title: 'Cerebras — 2.000+ Tokens/Sekunde, kostenlos',
    subtitle: 'Llama 3.1 8B gratis · schnellste Inferenz weltweit',
    icon: '🧠',
    bg: '#0f0a1a',
    gradient: 'linear-gradient(135deg, #7c3aed55 0%, #6d28d980 50%, #4c1d9555 100%)',
    placeholder: 'csk_...',
    envKey: 'CEREBRAS_API_KEY',
    signupUrl: 'https://cloud.cerebras.ai',
  },
  sambanova: {
    title: 'SambaNova — Llama 3.3 70B kostenlos',
    subtitle: 'DeepSeek R1 & Llama 3.3 70B dauerhaft gratis',
    icon: '🚀',
    bg: '#0a0f1a',
    gradient: 'linear-gradient(135deg, #0891b255 0%, #0e749080 50%, #155e7555 100%)',
    placeholder: 'sna_...',
    envKey: 'SAMBANOVA_API_KEY',
    signupUrl: 'https://cloud.sambanova.ai',
  },
  openrouter: {
    title: 'OpenRouter — Kostenlose Modelle',
    subtitle: 'Llama, Mistral, Gemma & DeepSeek R1 dauerhaft gratis',
    icon: '🌐',
    bg: '#1a0f00',
    gradient: 'linear-gradient(135deg, #d9770655 0%, #b4550080 50%, #92400e55 100%)',
    placeholder: 'sk-or-...',
    envKey: 'OPENROUTER_API_KEY',
    signupUrl: 'https://openrouter.ai',
  },
  together: {
    title: 'Together.ai — $25 Gratis-Credits',
    subtitle: 'Llama 3, Mistral & mehr · GMX-E-Mail reicht',
    icon: '🎁',
    bg: '#0d0a1f',
    gradient: 'linear-gradient(135deg, #4f46e555 0%, #7c3aed80 50%, #2563eb55 100%)',
    placeholder: 'together_...',
    envKey: 'TOGETHER_API_KEY',
    signupUrl: 'https://api.together.ai',
  },
}

export default function ProvidersPage() {
  const [data, setData]                                       = useState<ProvidersData | null>(null)
  const [saving, setSaving]                                   = useState(false)
  const [saved, setSaved]                                     = useState(false)
  const [health, setHealth]                                   = useState<Record<string, ProviderHealthEntry>>({})
  const [healthLoading, setHealthLoading]                     = useState(false)
  const [healthCheckedAt, setHealthCheckedAt]                 = useState<string | null>(null)

  const load = useCallback(() => {
    fetch('/api/ai/providers')
      .then(r => r.json())
      .then((d: ProvidersData) => setData(d))
      .catch(() => null)
  }, [])

  const loadHealth = useCallback(() => {
    fetch('/api/ai/providers/health')
      .then(r => r.json())
      .then((d: HealthReport) => {
        const map: Record<string, ProviderHealthEntry> = {}
        for (const e of d.providers ?? []) map[e.providerId] = e
        setHealth(map)
        setHealthCheckedAt(d.checkedAt)
      })
      .catch(() => null)
  }, [])

  const handleRunHealthCheck = async () => {
    setHealthLoading(true)
    try {
      await fetch('/api/ai/providers/health', { method: 'POST' })
      loadHealth()
    } finally {
      setHealthLoading(false)
    }
  }

  useEffect(() => { load(); loadHealth() }, [load, loadHealth])

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

  const handleToggle   = (id: string, enabled: boolean) => { void save({ provider: { id, enabled } }) }
  const handleAddCustom = (config: Partial<AIProviderConfig> & { id: string }) => { void save({ provider: config }) }
  const handleProviderUpdate = (patch: Partial<AIProviderConfig> & { id: string }) => { void save({ provider: patch }) }

  const handleSelectModel = (purpose: 'fast' | 'coding', providerId: string, modelId: string) => {
    if (!data || !modelId) return
    const newSelection = {
      ...data.selection,
      ...(purpose === 'fast'
        ? { fastProvider: providerId, fastModel: modelId }
        : { codingProvider: providerId, codingModel: modelId }
      ),
    }
    void save({ selection: newSelection })
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

  const localProviders  = data.providers.filter(p => p.dataResidency === 'local')
  const cloudProviders  = data.providers.filter(p => p.dataResidency !== 'local')
  const activeSelection = data.selection

  // Quick-setup banners: free-tier providers without an API key yet
  const bannersToShow = Object.entries(QUICK_SETUP_CONFIGS).filter(([id]) => {
    const p = data.providers.find(pr => pr.id === id)
    return p != null && !p.hasApiKey
  })

  // Provider stats
  const freeTierProviders = data.providers.filter(p => p.freeTier)
  const freeModelCount    = data.providers.reduce((n, p) => n + p.models.filter(m => m.isFree).length, 0)

  return (
    <main className="min-h-screen bg-[#08080d]">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/settings" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">← Settings</Link>
          <span className="text-slate-700">/</span>
          <span className="text-sm text-slate-400">AI Providers</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-600">{data.providers.length} Provider · {freeTierProviders.length} mit Free Tier · {freeModelCount} kostenlose Modelle</span>
          {healthCheckedAt && (
            <span className="text-[10px] text-slate-600">
              Health {new Date(healthCheckedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => { void handleRunHealthCheck() }}
            disabled={healthLoading}
            className="text-[10px] px-2 py-0.5 rounded border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors disabled:opacity-40"
          >
            {healthLoading ? '⏳' : '⚡ Health Check'}
          </button>
          {saved && <span className="text-xs text-emerald-400">✓ Gespeichert</span>}
          {saving && <span className="text-xs text-slate-500">Speichern…</span>}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">

        {/* Quick-Setup Banners */}
        {bannersToShow.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              🆓 Schnellstart — Kostenlose Provider
            </p>
            {bannersToShow.map(([id, cfg]) => (
              <QuickSetupBanner
                key={id}
                {...cfg}
                onActivated={() => { window.location.reload() }}
              />
            ))}
          </div>
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
            Cloud Provider ({cloudProviders.length})
          </h2>
          <div className="space-y-3">
            {cloudProviders.map(p => (
              <ProviderCard
                key={p.id}
                provider={p}
                selection={activeSelection}
                healthEntry={health[p.id]}
                onToggle={handleToggle}
                onTest={async () => {}}
                onSelectModel={handleSelectModel}
                onProviderUpdate={handleProviderUpdate}
                onKeyAdded={load}
              />
            ))}
          </div>
        </section>

        {/* Local providers */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Lokal — DSGVO-konform, kein API-Key
            </h2>
            <span className="text-[10px] border border-emerald-500/20 text-emerald-400 rounded px-1">100% privat</span>
          </div>
          <div className="space-y-3">
            {localProviders.map(p => (
              <ProviderCard
                key={p.id}
                provider={p}
                selection={activeSelection}
                healthEntry={health[p.id]}
                onToggle={handleToggle}
                onTest={async () => {}}
                onSelectModel={handleSelectModel}
                onProviderUpdate={handleProviderUpdate}
                onKeyAdded={load}
              />
            ))}
          </div>
        </section>

        {/* Model Picker */}
        <ModelPickerSection
          providers={data.providers}
          selection={activeSelection}
          onSelectionChange={newSel => setData(prev => prev ? { ...prev, selection: newSel } : prev)}
        />

        {/* Add custom */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Eigener Provider</h2>
          <AddCustomProviderForm onAdd={handleAddCustom} />
        </section>

        {/* Info box */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs text-slate-500 space-y-2">
          <p className="font-medium text-slate-400">Wie füge ich einen neuen Provider hinzu?</p>
          <p>Jeder OpenAI-kompatible Endpunkt funktioniert — einfach Name + Base URL eintragen.</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
            <p><span className="font-mono text-violet-400">GROQ_API_KEY</span> — Groq</p>
            <p><span className="font-mono text-violet-400">GOOGLE_API_KEY</span> — Gemini</p>
            <p><span className="font-mono text-violet-400">CEREBRAS_API_KEY</span> — Cerebras</p>
            <p><span className="font-mono text-violet-400">SAMBANOVA_API_KEY</span> — SambaNova</p>
            <p><span className="font-mono text-violet-400">DEEPSEEK_API_KEY</span> — DeepSeek</p>
            <p><span className="font-mono text-violet-400">XAI_API_KEY</span> — xAI/Grok</p>
            <p><span className="font-mono text-violet-400">OPENROUTER_API_KEY</span> — OpenRouter</p>
            <p><span className="font-mono text-violet-400">PERPLEXITY_API_KEY</span> — Perplexity</p>
            <p><span className="font-mono text-violet-400">FIREWORKS_API_KEY</span> — Fireworks</p>
            <p><span className="font-mono text-violet-400">DEEPINFRA_API_KEY</span> — Deepinfra</p>
            <p><span className="font-mono text-violet-400">COHERE_API_KEY</span> — Cohere</p>
            <p><span className="font-mono text-violet-400">NVIDIA_API_KEY</span> — Nvidia NIM</p>
          </div>
          <p className="pt-1 text-slate-600">🇪🇺 DSGVO-kritisch? Mistral AI (EU) oder Ollama/LM Studio (lokal) bevorzugen.</p>
        </div>
      </div>
    </main>
  )
}
