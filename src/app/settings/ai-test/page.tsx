'use client'

import { useEffect, useState, useRef } from 'react'
import { cx } from '@/components/ui/primitives'
import type { AIProviderConfig, AIModelDef } from '@/lib/ai/providers/types'

interface ProviderWithStatus extends AIProviderConfig {
  hasApiKey: boolean
}

interface ProvidersData {
  providers: ProviderWithStatus[]
}

interface TestResult {
  ok: true
  text: string
  providerId: string
  providerName: string
  modelId: string
  latencyMs: number
  inputTokens?: number
  outputTokens?: number
}

interface TestError {
  ok: false
  error: string
}

type TestResponse = TestResult | TestError

const SYSTEM_PRESETS = [
  { label: 'Hilfsbereit', value: 'You are a helpful assistant. Answer concisely.' },
  { label: 'Code-Reviewer', value: 'You are an expert code reviewer. Be critical and precise.' },
  { label: 'Deutsch', value: 'Du bist ein hilfreicher Assistent. Antworte immer auf Deutsch.' },
  { label: 'Kreativ', value: 'You are a creative writing assistant with vivid imagination.' },
]

const PROMPT_PRESETS = [
  'Hallo! Antworte kurz auf Deutsch.',
  'What is 2+2? Answer in one word.',
  'Write a haiku about software engineering.',
  'List 3 best practices for TypeScript.',
  'Explain the difference between TCP and UDP in one sentence.',
]

export default function AITestPage() {
  const [providers, setProviders]     = useState<ProviderWithStatus[]>([])
  const [providerId, setProviderId]   = useState('')
  const [modelId, setModelId]         = useState('')
  const [systemPrompt, setSystem]     = useState(SYSTEM_PRESETS[0]?.value ?? '')
  const [prompt, setPrompt]           = useState('')
  const [maxTokens, setMaxTokens]     = useState(256)
  const [loading, setLoading]         = useState(false)
  const [result, setResult]           = useState<TestResponse | null>(null)
  const [history, setHistory]         = useState<Array<{ prompt: string; result: TestResponse; ts: number }>>([])
  const textareaRef                   = useRef<HTMLTextAreaElement>(null)

  // Load providers
  useEffect(() => {
    fetch('/api/ai/providers')
      .then(r => r.json())
      .then((d: ProvidersData) => {
        setProviders(d.providers)
        // Pre-select first enabled provider
        const first = d.providers.find(p => p.enabled)
        if (first) {
          setProviderId(first.id)
          const firstModel = first.models[0]
          if (firstModel) setModelId(firstModel.id)
        }
      })
      .catch(() => null)
  }, [])

  // Update model when provider changes
  const handleProviderChange = (id: string) => {
    setProviderId(id)
    const p = providers.find(pr => pr.id === id)
    const firstModel = p?.models[0]
    setModelId(firstModel?.id ?? '')
    setResult(null)
  }

  const availableModels: AIModelDef[] = providers.find(p => p.id === providerId)?.models ?? []
  const selectedProvider = providers.find(p => p.id === providerId)

  const handleSubmit = async () => {
    if (!providerId || !modelId || !prompt.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const res  = await fetch('/api/ai/chat-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, modelId, prompt: prompt.trim(), systemPrompt, maxTokens }),
      })
      const data = await res.json() as TestResponse
      setResult(data)
      if (data.ok) {
        setHistory(prev => [{ prompt: prompt.trim(), result: data, ts: Date.now() }, ...prev.slice(0, 9)])
      }
    } catch {
      setResult({ ok: false, error: 'Netzwerkfehler' })
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      void handleSubmit()
    }
  }

  const costEstimate = (result && result.ok && result.inputTokens)
    ? (() => {
      const p = providers.find(pr => pr.id === result.providerId)
      const m = p?.models.find(mo => mo.id === result.modelId)
      if (!m?.costPer1kInput) return null
      const inputCost  = (result.inputTokens / 1000) * m.costPer1kInput
      const outputCost = result.outputTokens && m.costPer1kOutput
        ? (result.outputTokens / 1000) * m.costPer1kOutput
        : 0
      return (inputCost + outputCost).toFixed(6)
    })()
    : null

  return (
    <main className="min-h-screen bg-[#08080d]">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/settings" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">← Settings</a>
          <span className="text-slate-700">/</span>
          <span className="text-sm text-slate-400">AI Test</span>
        </div>
        <p className="text-[10px] text-slate-600">⌘↵ oder Ctrl+↵ zum Absenden</p>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">

          {/* ── Left: Test Interface ───────────────────────────── */}
          <div className="space-y-4">

            {/* Provider + Model selector */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Provider</label>
                <select
                  value={providerId}
                  onChange={e => handleProviderChange(e.target.value)}
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
                >
                  <option value="">— Provider wählen —</option>
                  {providers.filter(p => p.enabled || p.dataResidency === 'local').map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}{!p.hasApiKey && p.apiKeyRef ? ' ⚠' : ''}
                    </option>
                  ))}
                </select>
                {selectedProvider && !selectedProvider.hasApiKey && selectedProvider.apiKeyRef && (
                  <p className="text-[10px] text-amber-400 mt-1">⚠ API Key fehlt — in Settings → Providers eintragen</p>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Modell</label>
                <select
                  value={modelId}
                  onChange={e => setModelId(e.target.value)}
                  disabled={!providerId}
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors disabled:opacity-40"
                >
                  {availableModels.length === 0 && <option value="">— keine Modelle —</option>}
                  {availableModels.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                      {m.costPer1kInput === 0 ? ' (FREE)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* System Prompt */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">System Prompt</label>
                <div className="flex gap-1">
                  {SYSTEM_PRESETS.map(p => (
                    <button
                      key={p.label}
                      onClick={() => setSystem(p.value)}
                      className={cx(
                        'text-[10px] rounded px-1.5 py-0.5 border transition-colors',
                        systemPrompt === p.value
                          ? 'border-violet-500/50 text-violet-400 bg-violet-500/10'
                          : 'border-white/[0.06] text-slate-500 hover:text-slate-300',
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={systemPrompt}
                onChange={e => setSystem(e.target.value)}
                rows={2}
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-300 font-mono resize-none focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>

            {/* Prompt Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Prompt</label>
                <div className="flex gap-1">
                  {PROMPT_PRESETS.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => setPrompt(p)}
                      className="text-[10px] rounded px-1.5 py-0.5 border border-white/[0.06] text-slate-600 hover:text-slate-400 transition-colors"
                      title={p}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <span className="text-[10px] text-slate-700 self-center ml-1">Beispiele</span>
                </div>
              </div>
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={4}
                placeholder="Prompt eingeben… (⌘↵ zum Senden)"
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2.5 text-sm text-white placeholder-slate-600 resize-none focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>

            {/* Options Row */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-slate-500 uppercase tracking-wide">Max Tokens</label>
                <select
                  value={maxTokens}
                  onChange={e => setMaxTokens(Number(e.target.value))}
                  className="rounded bg-slate-800 border border-slate-700 px-2 py-1 text-xs text-white focus:outline-none focus:border-violet-500"
                >
                  {[64, 128, 256, 512, 1024, 2048].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => { void handleSubmit() }}
                disabled={loading || !providerId || !modelId || !prompt.trim()}
                className={cx(
                  'flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all',
                  loading || !providerId || !modelId || !prompt.trim()
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    : 'bg-violet-700 hover:bg-violet-600 text-white shadow-lg shadow-violet-900/30',
                )}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Generiere…
                  </span>
                ) : '⚡ Senden'}
              </button>
            </div>

            {/* Result */}
            {result && (
              <div className={cx(
                'rounded-xl border p-4 space-y-3',
                result.ok
                  ? 'border-emerald-500/20 bg-emerald-950/10'
                  : 'border-rose-500/20 bg-rose-950/10',
              )}>
                {result.ok ? (
                  <>
                    {/* Stats strip */}
                    <div className="flex items-center gap-4 flex-wrap">
                      <span className="text-xs text-emerald-400 font-semibold">✓ {result.providerName}</span>
                      <span className="text-xs text-slate-500 font-mono">{result.modelId}</span>
                      <span className="text-xs text-slate-400">{result.latencyMs}ms</span>
                      {result.inputTokens && (
                        <span className="text-xs text-slate-500">
                          {result.inputTokens}↑ {result.outputTokens ?? '?'}↓ tokens
                        </span>
                      )}
                      {costEstimate && (
                        <span className="text-xs text-amber-400/70">${costEstimate}</span>
                      )}
                    </div>
                    {/* Response text */}
                    <div className="rounded-lg bg-black/30 border border-white/[0.06] px-4 py-3">
                      <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{result.text}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { void navigator.clipboard.writeText(result.text) }}
                        className="text-xs text-slate-500 hover:text-slate-300 border border-white/[0.06] rounded px-2 py-0.5 transition-colors"
                      >
                        📋 Kopieren
                      </button>
                      <button
                        onClick={() => { setPrompt(''); if (textareaRef.current) textareaRef.current.focus() }}
                        className="text-xs text-slate-500 hover:text-slate-300 border border-white/[0.06] rounded px-2 py-0.5 transition-colors"
                      >
                        🔄 Neuer Prompt
                      </button>
                    </div>
                  </>
                ) : (
                  <div>
                    <p className="text-xs font-semibold text-rose-400 mb-1">✗ Fehler</p>
                    <p className="text-xs text-rose-300/80 font-mono whitespace-pre-wrap">{result.error}</p>
                    <p className="text-[10px] text-slate-600 mt-2">
                      Prüfe: API Key konfiguriert? Provider aktiviert? Modell-ID korrekt?
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Right: Sidebar ─────────────────────────────────── */}
          <div className="space-y-4">

            {/* Selected model info */}
            {selectedProvider && modelId && (() => {
              const m = selectedProvider.models.find(mo => mo.id === modelId)
              if (!m) return null
              return (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
                  <p className="text-xs font-semibold text-slate-400">Modell-Info</p>
                  <p className="text-sm font-medium text-white">{m.name}</p>
                  <p className="text-[10px] font-mono text-violet-400 break-all">{m.id}</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[10px] border border-slate-700/50 rounded px-1.5 py-0.5 text-slate-500">
                      {m.purpose}
                    </span>
                    {m.costPer1kInput === 0 ? (
                      <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded px-1.5 py-0.5">FREE</span>
                    ) : m.costPer1kInput !== undefined ? (
                      <span className="text-[10px] border border-slate-700/50 rounded px-1.5 py-0.5 text-slate-500">
                        ${m.costPer1kInput}/1k tokens
                      </span>
                    ) : null}
                    {m.contextWindow && (
                      <span className="text-[10px] border border-slate-700/50 rounded px-1.5 py-0.5 text-slate-500">
                        {(m.contextWindow / 1000).toFixed(0)}k ctx
                      </span>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Test history */}
            {history.length > 0 && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-xs font-semibold text-slate-400 mb-3">Verlauf</p>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {history.map((h, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setPrompt(h.prompt)
                        if (h.result.ok) {
                          setProviderId(h.result.providerId)
                          setModelId(h.result.modelId)
                        }
                        setResult(h.result)
                      }}
                      className="w-full text-left rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 hover:bg-white/[0.04] transition-colors"
                    >
                      <p className="text-xs text-slate-300 truncate">{h.prompt}</p>
                      {h.result.ok && (
                        <p className="text-[10px] text-slate-600 mt-0.5">
                          {h.result.providerName} · {h.result.latencyMs}ms
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick links */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
              <p className="text-xs font-semibold text-slate-400">Provider verwalten</p>
              <a href="/settings/providers" className="block text-xs text-violet-400 hover:text-violet-300 transition-colors">
                → AI Providers einrichten
              </a>
              <a href="/settings" className="block text-xs text-slate-500 hover:text-slate-300 transition-colors">
                → Settings Übersicht
              </a>
              <a href="/analytics" className="block text-xs text-slate-500 hover:text-slate-300 transition-colors">
                → Cost Analytics
              </a>
            </div>

          </div>
        </div>
      </div>
    </main>
  )
}
