'use client'

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react'
import type { NBAConfig } from '@/lib/nba-engine/nba-config'
import { describeApprovalMode } from '@/lib/nba-engine/approval-policy'
import type { PMAgentResult } from '@/lib/agent-runner/pm-agent'
import type { AutonomousConfig } from '@/lib/config/autonomous-config'
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Cpu,
  Database,
  Download,
  Gauge,
  Info,
  KeyRound,
  Lock,
  RefreshCw,
  Rocket,
  Server,
  Settings as SettingsIcon,
  ShieldCheck,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import { cx } from '@/components/ui/primitives'
import { AIProviderStatus } from '@/components/settings/AIProviderStatus'
import { SystemReadinessPanel } from '@/components/settings/SystemReadinessPanel'
import { StorageCutoverPanel } from '@/components/settings/StorageCutoverPanel'
import { ProviderAutoRouterPanel } from '@/components/settings/ProviderAutoRouterPanel'

const panelClassName = 'rounded-lg border border-white/[0.07] bg-white/[0.035] p-4 shadow-sm shadow-black/10'
const inputClassName = 'w-full rounded-md border border-white/[0.09] bg-[#080912] px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/25'
const primaryButtonClassName = 'rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40'
const secondaryButtonClassName = 'rounded-md border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-white/[0.16] hover:bg-white/[0.07]'

function SectionHeading({
  icon: Icon,
  title,
  badge,
}: {
  icon: ElementType
  title: string
  badge?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
        <span className="flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.07] bg-white/[0.04] text-violet-300">
          <Icon className="h-4 w-4" />
        </span>
        {title}
      </h2>
      {badge}
    </div>
  )
}

function StatusPill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        tone === 'success' && 'bg-emerald-500/12 text-emerald-300',
        tone === 'warning' && 'bg-amber-500/12 text-amber-300',
        tone === 'danger' && 'bg-red-500/12 text-red-300',
        tone === 'neutral' && 'bg-white/[0.06] text-slate-400'
      )}
    >
      {children}
    </span>
  )
}

// ─── Settings Import/Export ──────────────────────────────────────────────────
function SettingsImportExport() {
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'success' | 'error'>('idle')
  const [importResult, setImportResult] = useState<{ imported: string[]; skipped: string[]; errors: string[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleImport = async (file: File) => {
    setImportStatus('importing')
    setImportResult(null)
    try {
      const text = await file.text()
      const res = await fetch('/api/settings/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: text,
      })
      const data = await res.json() as { ok: boolean; imported: string[]; skipped: string[]; errors: string[] }
      setImportResult(data)
      setImportStatus(res.ok ? 'success' : 'error')
    } catch {
      setImportStatus('error')
      setImportResult(null)
    }
  }

  return (
    <section className="space-y-4">
      <SectionHeading icon={Download} title="Einstellungen sichern" />
      <div className={cx(panelClassName, 'space-y-3')}>
        <p className="text-sm text-gray-400">
          Exportiere alle Konfigurationen als JSON-Bundle oder importiere eine gesicherte Konfiguration.
          API Keys werden <strong className="text-slate-200">nie</strong> exportiert.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <a
            href="/api/settings/export"
            download
            className={cx(secondaryButtonClassName, 'flex items-center gap-2')}
          >
            <Download className="h-4 w-4" />
            Konfiguration exportieren
          </a>
          <a
            href="/api/admin/backup"
            download
            className={cx(secondaryButtonClassName, 'flex items-center gap-2')}
            title="Vollständiges Backup aller config/*.json Dateien (inkl. API Keys — vertraulich behandeln)"
          >
            <Download className="h-4 w-4" />
            Vollständiges Backup
          </a>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importStatus === 'importing'}
            className={cx(secondaryButtonClassName, 'flex items-center gap-2 disabled:opacity-40')}
          >
            <Download className="h-4 w-4 rotate-180" />
            {importStatus === 'importing' ? 'Importiere...' : 'Konfiguration importieren'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) void handleImport(file)
              e.target.value = ''
            }}
          />
        </div>
        {importStatus === 'success' && importResult && (
          <div className="rounded-md bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 space-y-1">
            <p className="font-semibold">Import erfolgreich</p>
            {importResult.imported.length > 0 && (
              <p>Importiert: {importResult.imported.join(', ')}</p>
            )}
            {importResult.skipped.length > 0 && (
              <p className="text-slate-400">Übersprungen: {importResult.skipped.join(', ')}</p>
            )}
          </div>
        )}
        {importStatus === 'error' && (
          <div className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {importResult?.errors?.length
              ? importResult.errors.join(' · ')
              : 'Import fehlgeschlagen. Prüfe das Format der Datei.'}
          </div>
        )}
      </div>
    </section>
  )
}

// ─── Sentry DSN Input ────────────────────────────────────────────────────────
function SentryDsnInput() {
  const [dsn, setDsn] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const handleSave = async () => {
    if (!dsn.trim()) return
    setStatus('saving')
    try {
      const res = await fetch('/api/settings/env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'NEXT_PUBLIC_SENTRY_DSN', value: dsn.trim() }),
      })
      setStatus(res.ok ? 'saved' : 'error')
      if (res.ok) {
        setDsn('')
        setTimeout(() => setStatus('idle'), 3000)
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        type="text"
        value={dsn}
        onChange={e => setDsn(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') void handleSave() }}
        placeholder="https://...@o0.ingest.sentry.io/..."
        className={cx(inputClassName, 'font-mono sm:flex-1')}
      />
      <button
        onClick={() => void handleSave()}
        disabled={!dsn.trim() || status === 'saving'}
        className={primaryButtonClassName}
      >
        {status === 'saving' ? '…' : status === 'saved' ? 'Gespeichert' : status === 'error' ? 'Fehler' : 'Speichern'}
      </button>
    </div>
  )
}

// ─── Knowledge Index Panel ───────────────────────────────────────────────────
interface KnowledgeStatsData {
  cardCount: number
  sourceCount: number
  lastIndexedAt: string | null
  cardsByType: Record<string, number>
  nasAvailable: boolean
}

function KnowledgeIndexPanel() {
  const [stats, setStats] = useState<KnowledgeStatsData | null>(null)
  const [indexing, setIndexing] = useState(false)
  const [indexResult, setIndexResult] = useState<{ sourcesIndexed?: number; cardsCreated?: number; error?: string } | null>(null)

  const loadStats = async () => {
    try {
      const res = await fetch('/api/knowledge/stats')
      if (res.ok) setStats(await res.json() as KnowledgeStatsData)
    } catch { /* ignore */ }
  }

  useEffect(() => { void loadStats() }, [])

  const handleIndex = async () => {
    setIndexing(true)
    setIndexResult(null)
    try {
      const res = await fetch('/api/knowledge/index-nas', { method: 'POST' })
      const data = await res.json() as { sourcesIndexed?: number; cardsCreated?: number; error?: string }
      setIndexResult(data)
      await loadStats()
    } catch {
      setIndexResult({ error: 'Indexierung fehlgeschlagen' })
    } finally {
      setIndexing(false)
    }
  }

  const lastIndexed = stats?.lastIndexedAt
    ? new Date(stats.lastIndexedAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
    : 'Noch nicht indexiert'

  return (
    <div className={cx(panelClassName, 'space-y-4')}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-md border border-white/[0.06] bg-white/[0.025] px-3 py-2">
          <p className="text-xs text-slate-500">Memory Cards</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-slate-100">{stats?.cardCount ?? '—'}</p>
        </div>
        <div className="rounded-md border border-white/[0.06] bg-white/[0.025] px-3 py-2">
          <p className="text-xs text-slate-500">Quellen</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-slate-100">{stats?.sourceCount ?? '—'}</p>
        </div>
        <div className="rounded-md border border-white/[0.06] bg-white/[0.025] px-3 py-2 sm:col-span-2">
          <p className="text-xs text-slate-500">Letzter Index</p>
          <p className="mt-0.5 text-sm font-medium text-slate-200 truncate">{lastIndexed}</p>
        </div>
      </div>

      {stats?.cardsByType && Object.keys(stats.cardsByType).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(stats.cardsByType).map(([type, count]) => (
            <span key={type} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-slate-400">
              {type} <span className="font-semibold text-slate-200">{count}</span>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={() => void handleIndex()}
          disabled={indexing}
          className={cx(primaryButtonClassName, 'flex items-center gap-2')}
        >
          <RefreshCw className={cx('h-4 w-4', indexing && 'animate-spin')} />
          {indexing ? 'Indexiere…' : 'Jetzt indexieren'}
        </button>
        {!stats?.nasAvailable && (
          <p className="text-xs text-amber-400">NAS / FORGEPILOT_DOCS_DIR nicht erreichbar</p>
        )}
      </div>

      {indexResult && (
        <div className={cx(
          'rounded-md px-3 py-2 text-xs',
          indexResult.error
            ? 'bg-red-500/10 text-red-300'
            : 'bg-emerald-500/10 text-emerald-300'
        )}>
          {indexResult.error
            ? indexResult.error
            : `${indexResult.sourcesIndexed ?? 0} Quellen · ${indexResult.cardsCreated ?? 0} neue Cards`}
        </div>
      )}

      <p className="text-xs text-slate-600">
        Liest Markdown-Dateien aus <code className="text-slate-500">FORGEPILOT_DOCS_DIR</code> (oder NAS-Standardpfad)
        und extrahiert Abschnitte als Memory Cards für den Context Engineer.
        Automatisch täglich um 04:00 UTC via Vercel Cron.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

interface ApiKeyField {
  key:
    | 'GITHUB_TOKEN'
    | 'LINEAR_API_KEY'
    | 'LINEAR_TEAM_ID'
    | 'ANTHROPIC_API_KEY'
    | 'OPENAI_API_KEY'
    | 'XAI_API_KEY'
    | 'GOOGLE_API_KEY'
    | 'GROQ_API_KEY'
    | 'OPENROUTER_API_KEY'
    | 'MISTRAL_API_KEY'
    | 'DEEPSEEK_API_KEY'
  label: string
  placeholder: string
  hint: string
  inputType?: 'password' | 'text'
}

const API_KEY_FIELDS: ApiKeyField[] = [
  {
    key: 'GITHUB_TOKEN',
    label: 'GitHub Token',
    placeholder: 'ghp_...',
    hint: 'Für GitHub Work Items + PR erstellen. Scope: repo',
  },
  {
    key: 'LINEAR_API_KEY',
    label: 'Linear API Key',
    placeholder: 'lin_api_...',
    hint: 'Für Linear Tickets als Work Items. Settings → API → Personal API Keys',
  },
  {
    key: 'LINEAR_TEAM_ID',
    label: 'Linear Team ID',
    placeholder: 'team-xxxxxxxx',
    hint: 'Team-ID aus Linear (URL: linear.app/[team]/settings). Wird für Ticket-Erstellung benötigt.',
    inputType: 'text',
  },
  {
    key: 'ANTHROPIC_API_KEY',
    label: 'Anthropic API Key',
    placeholder: 'sk-ant-api03-...',
    hint: 'Für die NBA Engine und Magic Create. console.anthropic.com',
  },
  {
    key: 'XAI_API_KEY',
    label: 'xAI / Grok API Key',
    placeholder: 'xai-...',
    hint: 'Für Grok-Critic, Daily Report und unabhängige Validierung. console.x.ai',
  },
  {
    key: 'OPENAI_API_KEY',
    label: 'OpenAI API Key',
    placeholder: 'sk-...',
    hint: 'Optionaler Cloud-Fallback für anspruchsvolle Reviews und Planung.',
  },
  {
    key: 'GOOGLE_API_KEY',
    label: 'Google Gemini API Key',
    placeholder: 'AIza...',
    hint: 'Optionaler Critic-/Planning-Fallback. Google AI Studio.',
  },
  {
    key: 'GROQ_API_KEY',
    label: 'Groq API Key',
    placeholder: 'gsk_...',
    hint: 'Kostenlos: console.groq.com — schnelle Inferenz mit Llama & Mixtral',
  },
  {
    key: 'OPENROUTER_API_KEY',
    label: 'OpenRouter API Key',
    placeholder: 'sk-or-...',
    hint: 'Optionaler Multi-Modell-Fallback, auch mit kostenlosen Modellen.',
  },
  {
    key: 'MISTRAL_API_KEY',
    label: 'Mistral API Key',
    placeholder: '...',
    hint: 'Optionaler EU-naher Cloud-Fallback.',
  },
  {
    key: 'DEEPSEEK_API_KEY',
    label: 'DeepSeek API Key',
    placeholder: 'sk-...',
    hint: 'Optionaler günstiger Coding-/Reasoning-Fallback.',
  },
]

interface AutoPmStatus {
  lastRunAt: string | null
  autoPmAgent: boolean
  isStale: boolean
}

export default function SettingsPage() {
  const [config, setConfig] = useState<NBAConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [newModel, setNewModel] = useState('')
  const [execStatus, setExecStatus] = useState<{ executeMode: string; executeModeHint: string; anthropic: { status: string }; claudeCode: { status: string } } | null>(null)
  const [authStatus, setAuthStatus] = useState<{ loggedIn: boolean; authMethod: string; subscriptionType: string; email?: string } | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [autoPmStatus, setAutoPmStatus] = useState<AutoPmStatus | null>(null)
  const [autoPmSaving, setAutoPmSaving] = useState(false)
  const [pmHistory, setPmHistory] = useState<PMAgentResult[]>([])
  const [expandedRun, setExpandedRun] = useState<string | null>(null)

  // Autonomous mode state
  const [autonomousConfig, setAutonomousConfig] = useState<AutonomousConfig | null>(null)
  const [autonomousSaving, setAutonomousSaving] = useState(false)

  // API Keys state
  const [apiKeySet, setApiKeySet] = useState<Record<string, boolean>>({})
  const [apiKeyDraft, setApiKeyDraft] = useState<Record<string, string>>({
    GITHUB_TOKEN: '',
    LINEAR_API_KEY: '',
    LINEAR_TEAM_ID: '',
    ANTHROPIC_API_KEY: '',
    OPENAI_API_KEY: '',
    XAI_API_KEY: '',
    GOOGLE_API_KEY: '',
    GROQ_API_KEY: '',
    OPENROUTER_API_KEY: '',
    MISTRAL_API_KEY: '',
    DEEPSEEK_API_KEY: '',
    OLLAMA_BASE_URL: '',
    LM_STUDIO_BASE_URL: '',
  })
  const [llmModeDraft, setLlmModeDraft] = useState<string>('auto')
  const [llmModeSet, setLlmModeSet] = useState(false)
  const [llmModeSaving, setLlmModeSaving] = useState(false)
  const [llmModeSaved, setLlmModeSaved] = useState(false)
  const [criticModeDraft, setCriticModeDraft] = useState<string>('auto')
  const [criticProvidersDraft, setCriticProvidersDraft] = useState('')
  const [criticConfigSaved, setCriticConfigSaved] = useState(false)
  const [criticConfigSaving, setCriticConfigSaving] = useState(false)
  const [apiKeySaving, setApiKeySaving] = useState(false)
  const [apiKeySaved, setApiKeySaved] = useState(false)
  const [confirmClearKey, setConfirmClearKey] = useState<string | null>(null)
  const [staleKeys, setStaleKeys] = useState<Record<string, number>>({})

  // Telegram state
  const [telegramEnabled, setTelegramEnabled] = useState(false)
  const [telegramBotToken, setTelegramBotToken] = useState('')
  const [telegramChatId, setTelegramChatId] = useState('')
  const [telegramSeverity, setTelegramSeverity] = useState<string[]>(['warning', 'critical'])
  const [telegramConfigured, setTelegramConfigured] = useState(false)
  const [telegramSaving, setTelegramSaving] = useState(false)
  const [telegramTesting, setTelegramTesting] = useState(false)
  const [telegramTestResult, setTelegramTestResult] = useState<'ok' | 'error' | null>(null)
  const [telegramSettingWebhook, setTelegramSettingWebhook] = useState(false)
  const [telegramWebhookResult, setTelegramWebhookResult] = useState<'ok' | 'error' | null>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(setConfig)
    fetch('/api/api-keys')
      .then(res => res.json())
      .then((data: {
        _set: Record<string, boolean>
        LLM_MODE?: string
        FORGEPILOT_CRITIC_MODE?: string
        FORGEPILOT_CRITIC_PROVIDERS?: string
      }) => {
        setApiKeySet(data._set ?? {})
        if (data.LLM_MODE) {
          setLlmModeDraft(data.LLM_MODE)
          setLlmModeSet(true)
        }
        if ('FORGEPILOT_CRITIC_MODE' in data) {
          setCriticModeDraft(String(data.FORGEPILOT_CRITIC_MODE ?? 'auto'))
        }
        if ('FORGEPILOT_CRITIC_PROVIDERS' in data) {
          setCriticProvidersDraft(String(data.FORGEPILOT_CRITIC_PROVIDERS ?? ''))
        }
      })
    fetch('/api/local-ai/status')
      .then(res => res.json())
      .then(setExecStatus)
      .catch(() => null)
    fetch('/api/auth/status')
      .then(res => res.json())
      .then((data: { loggedIn: boolean; authMethod: string; subscriptionType: string; email?: string }) => {
        setAuthStatus(data)
      })
      .catch(() => setAuthStatus({ loggedIn: false, authMethod: 'none', subscriptionType: 'none' }))
      .finally(() => setAuthLoading(false))
    fetch('/api/pm-agent/auto')
      .then(res => res.json())
      .then((data: AutoPmStatus) => setAutoPmStatus(data))
      .catch(() => null)
    fetch('/api/pm-agent/history?limit=5')
      .then(res => res.json())
      .then((data: PMAgentResult[]) => setPmHistory(data))
      .catch(() => null)
    fetch('/api/settings/autonomous')
      .then(res => res.json())
      .then((data: AutonomousConfig) => setAutonomousConfig(data))
      .catch(() => null)
    fetch('/api/api-keys/rotation-status')
      .then(res => res.json())
      .then((data: { keys: Array<{ keyName: string; ageDays: number; isStale: boolean }> }) => {
        const map: Record<string, number> = {}
        for (const k of data.keys) {
          if (k.isStale) map[k.keyName] = k.ageDays
        }
        setStaleKeys(map)
      })
      .catch(() => null)
    fetch('/api/telegram/config')
      .then(res => res.json())
      .then((data: { botToken: string; chatId: string; enabled: boolean; notifyOnSeverity: string[]; configured: boolean }) => {
        setTelegramEnabled(data.enabled)
        setTelegramBotToken(data.botToken)
        setTelegramChatId(data.chatId)
        setTelegramSeverity(data.notifyOnSeverity ?? ['warning', 'critical'])
        setTelegramConfigured(data.configured)
      })
      .catch(() => null)
  }, [])

  const handleAutonomousUpdate = async (update: Partial<AutonomousConfig>) => {
    setAutonomousSaving(true)
    try {
      const res = await fetch('/api/settings/autonomous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      })
      const data = await res.json() as AutonomousConfig
      setAutonomousConfig(data)
    } finally {
      setAutonomousSaving(false)
    }
  }

  const handleAutoPmToggle = async (enabled: boolean) => {
    setAutoPmSaving(true)
    try {
      await fetch('/api/pm-agent/auto', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoPmAgent: enabled }),
      })
      setAutoPmStatus(prev => prev ? { ...prev, autoPmAgent: enabled } : null)
    } finally {
      setAutoPmSaving(false)
    }
  }

  const isMaxActive = authStatus?.loggedIn === true && authStatus.subscriptionType === 'max'

  const handleSaveApiKeys = async () => {
    setApiKeySaving(true)
    // Only send non-empty drafts
    const payload: Record<string, string> = {}
    for (const [k, v] of Object.entries(apiKeyDraft)) {
      if (v.trim()) payload[k] = v.trim()
    }
    const res = await fetch('/api/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json() as { _set: Record<string, boolean> }
    setApiKeySet(data._set ?? {})
    setApiKeyDraft({
      GITHUB_TOKEN: '',
      LINEAR_API_KEY: '',
      LINEAR_TEAM_ID: '',
      ANTHROPIC_API_KEY: '',
      OPENAI_API_KEY: '',
      XAI_API_KEY: '',
      GOOGLE_API_KEY: '',
      GROQ_API_KEY: '',
      OPENROUTER_API_KEY: '',
      MISTRAL_API_KEY: '',
      DEEPSEEK_API_KEY: '',
      OLLAMA_BASE_URL: '',
      LM_STUDIO_BASE_URL: '',
    })
    setApiKeySaving(false)
    setApiKeySaved(true)
    setTimeout(() => setApiKeySaved(false), 3000)
  }

  const handleClearApiKey = async (key: string) => {
    setApiKeySaving(true)
    setConfirmClearKey(null)
    const res = await fetch('/api/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: '' }),
    })
    const data = await res.json() as { _set: Record<string, boolean> }
    setApiKeySet(data._set ?? {})
    setApiKeySaving(false)
    setApiKeySaved(true)
    setTimeout(() => setApiKeySaved(false), 3000)
  }

  const handleSaveLlmMode = async () => {
    setLlmModeSaving(true)
    const res = await fetch('/api/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ LLM_MODE: llmModeDraft }),
    })
    const data = await res.json() as { _set: Record<string, boolean> }
    setApiKeySet(data._set ?? {})
    setLlmModeSet(true)
    setLlmModeSaving(false)
    setLlmModeSaved(true)
    setTimeout(() => setLlmModeSaved(false), 3000)
  }

  const handleSaveCriticConfig = async () => {
    setCriticConfigSaving(true)
    const res = await fetch('/api/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        FORGEPILOT_CRITIC_MODE: criticModeDraft,
        FORGEPILOT_CRITIC_PROVIDERS: criticProvidersDraft.trim(),
      }),
    })
    const data = await res.json() as { _set: Record<string, boolean> }
    setApiKeySet(data._set ?? {})
    setCriticConfigSaving(false)
    setCriticConfigSaved(true)
    setTimeout(() => setCriticConfigSaved(false), 3000)
  }

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    })
    setSaving(false)
  }

  if (!config) {
    return (
      <main className="min-h-screen bg-[#07070c] px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className={cx(panelClassName, 'text-sm text-slate-400')}>Einstellungen werden geladen...</div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#07070c] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-7">
        <header className="page-header">
          <div>
            <p className="page-eyebrow">System Setup</p>
            <h1 className="page-title flex items-center gap-2">
              <SettingsIcon className="h-6 w-6 text-violet-300" />
              Engine Einstellungen
            </h1>
            <p className="page-description">
              Provider, lokale KI, Agenten-Automation und Betriebssicherheit an einem Ort.
            </p>
          </div>
        </header>

        <SystemReadinessPanel />

        {/* Claude CLI Auth Section */}
        <section className="space-y-4">
          <SectionHeading
            icon={Bot}
            title="Claude CLI Auth"
            badge={
              authLoading ? (
                <StatusPill>Lade...</StatusPill>
              ) : isMaxActive ? (
                <StatusPill tone="success">Max aktiv</StatusPill>
              ) : authStatus?.loggedIn ? (
                <StatusPill tone="warning">Eingeloggt</StatusPill>
              ) : (
                <StatusPill tone="danger">Nicht eingeloggt</StatusPill>
              )
            }
          />
          <div className={cx(panelClassName, 'space-y-2')}>
            <p className="text-sm text-gray-400">
              Status der lokalen <code className="text-xs bg-gray-800 px-1 py-0.5 rounded">claude</code> CLI-Session.
              Bei aktiver Max-Subscription wird kein API Key benötigt — die CLI nutzt die OAuth-Session.
            </p>
            {authStatus && !authLoading && (
              <dl className="text-xs text-gray-400 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 pt-1">
                <dt className="text-gray-500">Auth-Methode</dt>
                <dd className="font-mono text-gray-300">{authStatus.authMethod}</dd>
                <dt className="text-gray-500">Subscription</dt>
                <dd className="font-mono text-gray-300">{authStatus.subscriptionType}</dd>
                {authStatus.email && (
                  <>
                    <dt className="text-gray-500">Konto</dt>
                    <dd className="font-mono text-gray-300">{authStatus.email}</dd>
                  </>
                )}
              </dl>
            )}
            {!authLoading && !authStatus?.loggedIn && (
              <p className="text-xs text-red-400 pt-1">
                Mit <code className="bg-gray-800 px-1 py-0.5 rounded">claude login</code> im Terminal anmelden.
              </p>
            )}
          </div>
        </section>

        {/* AI Provider Status Section */}
        <section className="space-y-4">
          <SectionHeading
            icon={Cpu}
            title="KI-Anbieter Status"
          />
          <AIProviderStatus />
        </section>

        {/* Auto-Router + Zero-Key Section */}
        <section className="space-y-4">
          <SectionHeading
            icon={Zap}
            title="Auto-Router & Zero-Key Provider"
          />
          <div className={panelClassName}>
            <ProviderAutoRouterPanel />
          </div>
        </section>

        {/* API Keys Section */}
        <section className="space-y-4">
          <SectionHeading
            icon={KeyRound}
            title="API Keys & Verbindungen"
            badge={
              apiKeySaved
                ? <StatusPill tone="success"><Check className="h-3 w-3" /> Gespeichert</StatusPill>
                : Object.keys(staleKeys).length > 0
                ? <StatusPill tone="warning"><AlertTriangle className="h-3 w-3" /> Rotation empfohlen</StatusPill>
                : null
            }
          />
          <div className={cx(panelClassName, 'space-y-4')}>
            <p className="text-sm text-gray-400">
              Keys werden lokal in <code className="text-xs bg-gray-800 px-1 py-0.5 rounded">config/api-keys.json</code> gespeichert (nicht in Git).
            </p>
            {API_KEY_FIELDS.map(({ key, label, placeholder, hint, inputType }) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-300">{label}</label>
                  <div className="flex items-center gap-2">
                    <StatusPill tone={apiKeySet[key] ? 'success' : 'neutral'}>{apiKeySet[key] ? 'Gesetzt' : 'Nicht gesetzt'}</StatusPill>
                    {apiKeySet[key] && (
                      confirmClearKey === key ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-red-400">Löschen?</span>
                          <button
                            onClick={() => handleClearApiKey(key)}
                            className="text-xs bg-red-600 hover:bg-red-500 text-white px-2 py-0.5 rounded font-bold transition-colors"
                          >
                            Ja
                          </button>
                          <button
                            onClick={() => setConfirmClearKey(null)}
                            className="text-xs text-gray-500 hover:text-white px-1 transition-colors"
                            aria-label="Löschen abbrechen"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmClearKey(key)}
                          className="text-xs text-gray-600 hover:text-red-400 transition-colors"
                          title="Key löschen"
                          aria-label={`${label} löschen`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )
                    )}
                  </div>
                </div>
                <input
                  type={inputType ?? 'password'}
                  value={apiKeyDraft[key] ?? ''}
                  onChange={e => setApiKeyDraft(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={apiKeySet[key] && inputType !== 'text' ? '••••••••••••••••' : placeholder}
                  className={cx(inputClassName, 'font-mono')}
                />
                <p className="text-xs text-gray-500 mt-1">{hint}</p>
                {staleKeys[key] !== undefined && (
                  <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    Zuletzt gesetzt vor {staleKeys[key]} Tagen — Rotation empfohlen (&gt;90 Tage).
                  </p>
                )}
                {key === 'ANTHROPIC_API_KEY' && isMaxActive && (
                  <p className="text-xs text-green-400 mt-1">Nicht nötig bei Max-Subscription — claude CLI nutzt die OAuth-Session.</p>
                )}
              </div>
            ))}
            <button
              onClick={handleSaveApiKeys}
              disabled={apiKeySaving || Object.values(apiKeyDraft).every(v => !v.trim())}
              className={cx(primaryButtonClassName, 'w-full')}
            >
              {apiKeySaving ? 'Speichere...' : 'API Keys speichern'}
            </button>
          </div>
        </section>

        {/* Lokale KI — Ollama + LM Studio */}
        <section className="space-y-4">
          <SectionHeading icon={Server} title="Lokale KI (Ollama / LM Studio)" badge={<StatusPill>Optional</StatusPill>} />
          <div className={cx(panelClassName, 'space-y-4')}>
            <p className="text-sm text-gray-400">
              Verbinde lokale Inferenz-Server als kostenlose Alternative zu Cloud-Providern.
            </p>
            {/* Ollama URL */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-gray-300">Ollama Base URL</label>
                <StatusPill tone={apiKeySet['OLLAMA_BASE_URL'] ? 'success' : 'neutral'}>
                  {apiKeySet['OLLAMA_BASE_URL'] ? 'Gesetzt' : 'Nicht gesetzt'}
                </StatusPill>
              </div>
              <input
                type="text"
                value={apiKeyDraft['OLLAMA_BASE_URL'] ?? ''}
                onChange={e => setApiKeyDraft(prev => ({ ...prev, OLLAMA_BASE_URL: e.target.value }))}
                placeholder={apiKeySet['OLLAMA_BASE_URL'] ? 'URL gesetzt — neu eingeben zum Ändern' : 'http://localhost:11434'}
                className={cx(inputClassName, 'font-mono')}
              />
              <p className="text-xs text-gray-500 mt-1">
                Standard: <code className="bg-gray-800 px-1 rounded">http://localhost:11434</code> — auch per LAN oder Tailscale erreichbar.
              </p>
            </div>
            {/* LM Studio URL */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-gray-300">LM Studio Base URL</label>
                <StatusPill tone={apiKeySet['LM_STUDIO_BASE_URL'] ? 'success' : 'neutral'}>
                  {apiKeySet['LM_STUDIO_BASE_URL'] ? 'Gesetzt' : 'Nicht gesetzt'}
                </StatusPill>
              </div>
              <input
                type="text"
                value={apiKeyDraft['LM_STUDIO_BASE_URL'] ?? ''}
                onChange={e => setApiKeyDraft(prev => ({ ...prev, LM_STUDIO_BASE_URL: e.target.value }))}
                placeholder={apiKeySet['LM_STUDIO_BASE_URL'] ? 'URL gesetzt — neu eingeben zum Ändern' : 'http://localhost:1234'}
                className={cx(inputClassName, 'font-mono')}
              />
              <p className="text-xs text-gray-500 mt-1">
                Standard: <code className="bg-gray-800 px-1 rounded">http://localhost:1234</code> — LM Studio lokaler Server.
              </p>
            </div>
            <button
              onClick={handleSaveApiKeys}
              disabled={apiKeySaving || (!apiKeyDraft['OLLAMA_BASE_URL']?.trim() && !apiKeyDraft['LM_STUDIO_BASE_URL']?.trim())}
              className={cx(secondaryButtonClassName, 'w-full')}
            >
              {apiKeySaving ? 'Speichere...' : 'Lokale KI URLs speichern'}
            </button>
          </div>
        </section>

        {/* LLM-Modus Selector */}
        <section className="space-y-4">
          <SectionHeading
            icon={Cpu}
            title="LLM-Modus"
            badge={
              llmModeSaved
                ? <StatusPill tone="success"><Check className="h-3 w-3" /> Gespeichert</StatusPill>
                : llmModeSet
                ? <StatusPill tone="success">Aktiv: {llmModeDraft}</StatusPill>
                : <StatusPill>auto</StatusPill>
            }
          />
          <div className={cx(panelClassName, 'space-y-4')}>
            <p className="text-sm text-gray-400">
              Wähle, welcher Provider für die KI-Generierung verwendet wird. <strong>auto</strong> wählt automatisch den besten verfügbaren Provider.
            </p>
            <div>
              <label className="block text-xs text-gray-500 mb-2">Provider-Modus</label>
              <select
                value={llmModeDraft}
                onChange={e => setLlmModeDraft(e.target.value)}
                className={cx(inputClassName, 'cursor-pointer')}
              >
                <option value="auto">auto — Bester verfügbarer Provider (empfohlen)</option>
                <option value="anthropic">anthropic — Anthropic API</option>
                <option value="groq">groq — Groq (kostenlos, schnell)</option>
                <option value="ollama">ollama — Ollama lokal (kostenlos)</option>
                <option value="lmstudio">lmstudio — LM Studio lokal (kostenlos)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Wird als Fallback genutzt wenn kein Provider explizit per ENV gesetzt ist.
              </p>
            </div>
            <button
              onClick={() => void handleSaveLlmMode()}
              disabled={llmModeSaving}
              className={cx(primaryButtonClassName)}
            >
              {llmModeSaving ? 'Speichere...' : 'LLM-Modus speichern'}
            </button>
          </div>
        </section>

        {/* Critic Router */}
        <section className="space-y-4">
          <SectionHeading
            icon={ShieldCheck}
            title="Daily Report & Critic Router"
            badge={
              criticConfigSaved
                ? <StatusPill tone="success"><Check className="h-3 w-3" /> Gespeichert</StatusPill>
                : <StatusPill tone="success">Auto empfohlen</StatusPill>
            }
          />
          <div className={cx(panelClassName, 'space-y-4')}>
            <p className="text-sm text-gray-400">
              Steuert, welche LLMs als Kritiker für Daily Report, Code-Review und Validierung genutzt werden.
              <strong className="text-slate-200"> Auto</strong> bevorzugt die besten konfigurierten Modelle und fällt bei Bedarf auf lokale KI zurück.
            </p>
            <div>
              <label className="block text-xs text-gray-500 mb-2">Critic-Modus</label>
              <select
                value={criticModeDraft}
                onChange={e => setCriticModeDraft(e.target.value)}
                className={cx(inputClassName, 'cursor-pointer')}
              >
                <option value="auto">auto — Beste konfigurierte Kette (empfohlen)</option>
                <option value="local-first">local-first — Ollama / LM Studio zuerst</option>
                <option value="cloud-first">cloud-first — nur konfigurierte Cloud-Critics</option>
                <option value="single">single — nur explizite Provider-Kette verwenden</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-2">Optionale Provider-Kette</label>
              <input
                type="text"
                value={criticProvidersDraft}
                onChange={e => setCriticProvidersDraft(e.target.value)}
                placeholder="xai:grok-3-mini,anthropic:claude-sonnet-4-5,ollama:qwen2.5-coder:14b"
                className={cx(inputClassName, 'font-mono')}
              />
              <p className="text-xs text-gray-500 mt-1">
                Leer lassen für Auto-Routing. Format: <code className="bg-gray-800 px-1 rounded">provider:model,provider:model</code>.
                Aliase wie <code className="bg-gray-800 px-1 rounded">grok</code>, <code className="bg-gray-800 px-1 rounded">gemini</code> und <code className="bg-gray-800 px-1 rounded">lmstudio</code> werden verstanden.
              </p>
            </div>
            <button
              onClick={() => void handleSaveCriticConfig()}
              disabled={criticConfigSaving}
              className={cx(primaryButtonClassName)}
            >
              {criticConfigSaving ? 'Speichere...' : 'Critic-Routing speichern'}
            </button>
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeading
            icon={Cpu}
            title="AI Provider"
            badge={<StatusPill>{config.aiProvider === 'ollama' ? 'Lokal aktiv' : 'Anthropic aktiv'}</StatusPill>}
          />
          <div className={cx(panelClassName, 'space-y-4')}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(['anthropic', 'ollama'] as const).map(provider => (
                <button
                  key={provider}
                  onClick={() => setConfig({ ...config, aiProvider: provider })}
                  className={`px-3 py-3 rounded-lg border text-left transition-colors ${
                    config.aiProvider === provider
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
                  }`}
                >
                  <span className="block text-sm font-bold">
                    {provider === 'anthropic' ? 'Anthropic' : 'Lokal / Ollama'}
                  </span>
                  <span className="block text-xs opacity-80 mt-1">
                    {provider === 'anthropic'
                      ? 'Cloud-Provider fuer Claude-nahe KI-Features'
                      : 'Lokale Modelle, bevorzugt auf dem MacBook Pro'}
                  </span>
                </button>
              ))}
            </div>

            <p className="text-sm text-gray-400">
              Research Run, Requirements-Generierung und AI Suggest nutzen diese Auswahl.
            </p>

            {/* Quick-links to provider management + test */}
            <div className="flex flex-wrap gap-2 pt-1">
              <a
                href="/settings/providers"
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-300 hover:bg-violet-500/20 transition-colors"
              >
                <SettingsIcon className="h-3.5 w-3.5" /> Provider & Modelle verwalten
              </a>
              <a
                href="/settings/ai-test"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-colors"
              >
                <Zap className="h-3.5 w-3.5" /> AI direkt testen
              </a>
              <a
                href="/settings/deployment"
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-500/20 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 19.5h20L12 2z" />
                </svg>
                Vercel Deployment
              </a>
              <a
                href="/settings/notifications"
                className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs font-semibold text-purple-300 hover:bg-purple-500/20 transition-colors"
              >
                🔔 Benachrichtigungen
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Coding-/Research-Modell</label>
                <input
                  type="text"
                  value={config.localCodingModel}
                  onChange={e => setConfig({ ...config, localCodingModel: e.target.value })}
                  placeholder="qwen2.5-coder:14b"
                  className={cx(inputClassName, 'font-mono')}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Schnelles Modell</label>
                <input
                  type="text"
                  value={config.localFastModel}
                  onChange={e => setConfig({ ...config, localFastModel: e.target.value })}
                  placeholder="llama3.2:3b"
                  className={cx(inputClassName, 'font-mono')}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ─── Monitoring / Sentry ──────────────────────────────────────────── */}
        <section className="space-y-4">
          <SectionHeading icon={Activity} title="Monitoring" badge={<StatusPill>Optional</StatusPill>} />
          <div className={cx(panelClassName, 'space-y-4')}>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Sentry DSN{' '}
                <a
                  href="https://sentry.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-400 hover:underline"
                >
                  (kostenlos auf sentry.io)
                </a>
              </label>
              <SentryDsnInput />
            </div>
            <p className="text-xs text-gray-600">
              Wenn gesetzt, werden Fehler und Performance-Daten automatisch an Sentry gesendet.
              10 % der Requests werden getrackt (Sampling). Kein DSN = kein Tracking.
            </p>
          </div>
        </section>

        {/* ─── Knowledge Index ──────────────────────────────────────────────── */}
        <section className="space-y-4">
          <SectionHeading
            icon={BookOpen}
            title="Wissen &amp; NAS-Indexer"
            badge={<StatusPill>Phase 8C</StatusPill>}
          />
          <KnowledgeIndexPanel />
        </section>

        <section className="space-y-4">
          <SectionHeading icon={Gauge} title="Anzeige Limits" />
          <div className={cx(panelClassName, 'flex items-center justify-between gap-4')}>
            <span>Maximal sichtbare Empfehlungen</span>
            <input
              type="number"
              value={config.maxRecommendations}
              onChange={e => setConfig({...config, maxRecommendations: parseInt(e.target.value)})}
              className={cx(inputClassName, 'w-24 text-center')}
            />
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeading icon={Clock} title="Time-Decay" />
          <div className={cx(panelClassName, 'space-y-4')}>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.penalizeOldBacklogs}
                onChange={e => setConfig({...config, penalizeOldBacklogs: e.target.checked})}
                className="form-checkbox h-5 w-5 text-blue-600 rounded bg-gray-800 border-gray-700"
              />
              <span>Alte Backlogs automatisch abwerten</span>
            </label>

            <div className="flex justify-between items-center opacity-80">
              <span>Alter in Tagen (Threshold)</span>
              <input
                type="number"
                value={config.backlogPenaltyAgeDays}
                onChange={e => setConfig({...config, backlogPenaltyAgeDays: parseInt(e.target.value)})}
                className={cx(inputClassName, 'w-24 text-center')}
              />
            </div>

            <div className="flex justify-between items-center opacity-80">
              <span>Punkte Abzug (Penalty)</span>
              <input
                type="number"
                value={config.backlogPenaltyScore}
                onChange={e => setConfig({...config, backlogPenaltyScore: parseInt(e.target.value)})}
                className={cx(inputClassName, 'w-24 text-center')}
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeading icon={Activity} title="Triage & Extras" />
          <div className={panelClassName}>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.showTriageJoker}
                onChange={e => setConfig({...config, showTriageJoker: e.target.checked})}
                className="form-checkbox h-5 w-5 text-blue-600 rounded bg-gray-800 border-gray-700"
              />
              <div>
                <span className="block">Triage-Joker aktivieren</span>
                <span className="text-xs text-gray-500">Mischt gelegentlich ein uraltes Ticket ins Dashboard, um es aufzuräumen.</span>
              </div>
            </label>
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeading icon={ShieldCheck} title="Freigabe & Autopilot" />
          <div className={cx(panelClassName, 'space-y-4')}>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Approval-Modus</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(['manual', 'balanced', 'autopilot'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setConfig({ ...config, approvalMode: mode })}
                    className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                      config.approvalMode === mode
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
                    }`}
                  >
                    {mode === 'manual' ? 'Manuell' : mode === 'balanced' ? 'Ausgewogen' : 'Autopilot'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">{describeApprovalMode(config.approvalMode)}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={config.approvalMode === 'autopilot' ? '' : 'opacity-50'}>
                <label className="block text-xs text-gray-500 mb-1">Autopilot Mindestscore</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={config.autopilotMinScore}
                  onChange={e => setConfig({ ...config, autopilotMinScore: parseInt(e.target.value) })}
                  className="w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-700"
                />
              </div>
              <div className={config.approvalMode === 'autopilot' ? '' : 'opacity-50'}>
                <label className="block text-xs text-gray-500 mb-1">Maximale RiskClass fuer Autopilot</label>
                <select
                  value={config.autopilotMaxRiskClass}
                  onChange={e => setConfig({ ...config, autopilotMaxRiskClass: e.target.value as NBAConfig['autopilotMaxRiskClass'] })}
                  className="w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-700"
                >
                  <option value="A">Class A</option>
                  <option value="B">Class B</option>
                  <option value="C">Class C</option>
                </select>
              </div>
            </div>

            {/* M20.2: Multi-Delegation Queue Settings */}
            <div className="mt-4 border-t border-white/[0.06] pt-4 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Queue &amp; Auto-Start</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Max. parallele Agents</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={config.maxConcurrentAgents ?? 2}
                    onChange={e => setConfig({ ...config, maxConcurrentAgents: Math.max(1, parseInt(e.target.value) || 1) })}
                    className={inputClassName}
                  />
                  <p className="text-[11px] text-slate-600 mt-1">Delegationen, die gleichzeitig laufen dürfen (Standard: 2)</p>
                </div>
                <div className="flex flex-col justify-center">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <div
                      onClick={() => setConfig({ ...config, autoStartApproved: !config.autoStartApproved })}
                      className={cx(
                        'relative h-5 w-9 rounded-full transition-colors cursor-pointer',
                        config.autoStartApproved ? 'bg-violet-600' : 'bg-white/[0.08]',
                      )}
                    >
                      <span className={cx(
                        'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                        config.autoStartApproved ? 'translate-x-4' : 'translate-x-0.5',
                      )} />
                    </div>
                    <span className="text-sm text-slate-300">Auto-Start genehmigte Delegationen</span>
                  </label>
                  <p className="text-[11px] text-slate-600 mt-1 ml-12">Neue &apos;approved&apos; Delegationen sofort starten</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeading icon={Cpu} title="Eigene KI-Modelle" />
          <div className={cx(panelClassName, 'space-y-4')}>
            <p className="text-sm text-gray-400">Füge eigene oder lokale LLM-Modelle hinzu, die du bei der Delegation auswählen möchtest.</p>

            <div className="flex space-x-2">
              <input
                type="text"
                value={newModel}
                onChange={e => setNewModel(e.target.value)}
                placeholder="z.B. ollama/llama-3-8b"
                className="flex-1 bg-gray-800 text-white px-3 py-2 rounded border border-gray-700"
              />
              <button
                onClick={() => {
                  if (newModel && !config.customLlmModels?.includes(newModel)) {
                    setConfig({...config, customLlmModels: [...(config.customLlmModels || []), newModel]})
                    setNewModel('')
                  }
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-bold transition-colors"
              >
                Hinzufügen
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {(config.customLlmModels || []).length === 0 ? (
                <span className="text-sm text-gray-500 italic">Keine eigenen Modelle hinterlegt.</span>
              ) : (
                (config.customLlmModels || []).map(model => (
                  <div key={model} className="bg-gray-800 border border-gray-700 rounded-full px-3 py-1 flex items-center space-x-2 text-sm text-gray-300">
                    <span>{model}</span>
                    <button
                      onClick={() => setConfig({...config, customLlmModels: config.customLlmModels.filter(m => m !== model)})}
                      className="text-gray-500 hover:text-red-400"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* PM Agent Auto-Run Section */}
        <section className="space-y-4">
          <SectionHeading icon={Bot} title="PM Agent Auto-Run" badge={<StatusPill>Täglich</StatusPill>} />
          <div className={cx(panelClassName, 'space-y-4')}>
            <p className="text-sm text-gray-400">
              Der PM Agent analysiert automatisch dein Projektportfolio — einmal pro 24 Stunden wenn aktiviert.
            </p>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoPmStatus?.autoPmAgent ?? true}
                disabled={autoPmSaving}
                onChange={e => handleAutoPmToggle(e.target.checked)}
                className="form-checkbox h-5 w-5 text-blue-600 rounded bg-gray-800 border-gray-700"
              />
              <div>
                <span className="block text-sm font-medium text-gray-300">Täglich automatisch ausführen</span>
                <span className="text-xs text-gray-500">
                  Läuft nur wenn letzter Run älter als 24h ist
                </span>
              </div>
            </label>
            {autoPmStatus?.lastRunAt ? (
              <div className="text-xs text-gray-500 space-y-1">
                <p>
                  Letzter Run:{' '}
                  <span className="text-gray-300 font-mono">
                    {new Date(autoPmStatus.lastRunAt).toLocaleString('de-DE', {
                      day: '2-digit', month: '2-digit', year: '2-digit',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </p>
                {autoPmStatus.isStale && (
                  <p className="text-amber-400">Plan ist veraltet — nächster Auto-Run wird ausgeführt.</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-600 italic">Noch kein PM Agent Run gefunden.</p>
            )}

            {/* Run History */}
            {pmHistory.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-gray-800">
                <p className="text-xs font-medium text-gray-400">Letzte Runs</p>
                <div className="space-y-1">
                  {pmHistory.map((run) => {
                    const isExpanded = expandedRun === run.runAt
                    const healthColor =
                      run.overallHealth === 'green'
                        ? 'bg-green-900/40 text-green-400'
                        : run.overallHealth === 'yellow'
                          ? 'bg-yellow-900/40 text-yellow-400'
                          : 'bg-red-900/40 text-red-400'
                    const runDate = new Date(run.runAt).toLocaleString('de-DE', {
                      day: 'numeric',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                    return (
                      <div key={run.runAt} className="rounded-lg border border-gray-800 overflow-hidden">
                        <button
                          onClick={() => setExpandedRun(isExpanded ? null : run.runAt)}
                          className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-gray-800/50 transition-colors text-left"
                        >
                          <span className="text-gray-300 font-mono">{runDate}</span>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-gray-500">
                              {run.reviews?.length ?? 0} WPs · {run.blockers?.length ?? 0} Blocker
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${healthColor}`}>
                              {run.overallHealth}
                            </span>
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-gray-600" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-600" />}
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="px-3 pb-3 pt-1 border-t border-gray-800 space-y-2">
                            <p className="text-xs text-gray-400 leading-relaxed">{run.summary}</p>
                            {run.blockers && run.blockers.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-red-400 mb-1">Blocker</p>
                                <ul className="space-y-0.5">
                                  {run.blockers.map((b, i) => (
                                    <li key={i} className="text-xs text-gray-400 flex gap-1">
                                      <span className="text-red-500 shrink-0">·</span>
                                      <span>{b}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {run.recommendations && run.recommendations.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-blue-400 mb-1">Empfehlungen</p>
                                <ul className="space-y-0.5">
                                  {run.recommendations.slice(0, 3).map((r, i) => (
                                    <li key={i} className="text-xs text-gray-400 flex gap-1">
                                      <span className="text-blue-500 shrink-0">·</span>
                                      <span>{r}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Production Readiness Checklist */}
        <section className={cx(panelClassName, 'space-y-4 p-5')}>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <Rocket className="h-5 w-5 text-violet-300" /> Bereit für echten Agenten-Betrieb?
          </h2>
          <div className="space-y-3 text-sm">
            {/* claude CLI */}
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 text-base ${execStatus?.claudeCode?.status === 'healthy' ? 'text-emerald-400' : 'text-red-400'}`}>
                {execStatus?.claudeCode?.status === 'healthy' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              </span>
              <div>
                <p className="font-medium text-white">claude CLI installiert</p>
                <p className="text-gray-400 text-xs mt-0.5">
                  {execStatus?.claudeCode?.status === 'healthy'
                    ? 'claude CLI gefunden — Agenten können echten Code schreiben'
                    : 'Nicht gefunden — npm install -g @anthropic-ai/claude-code'}
                </p>
              </div>
            </div>
            {/* Anthropic API Key */}
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 text-base ${execStatus?.anthropic?.status === 'healthy' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {execStatus?.anthropic?.status === 'healthy' ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              </span>
              <div>
                <p className="font-medium text-white">Anthropic API Key</p>
                <p className="text-gray-400 text-xs mt-0.5">
                  {execStatus?.anthropic?.status === 'healthy'
                    ? 'API Key konfiguriert (Env-Variable oder Einstellungen)'
                    : 'Fehlend — oben unter "API Keys" eintragen'}
                </p>
              </div>
            </div>
            {/* Credits */}
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-4 w-4 text-sky-400" />
              <div>
                <p className="font-medium text-white">Anthropic-Guthaben</p>
                <p className="text-gray-400 text-xs mt-0.5">
                  Kann nicht automatisch geprüft werden — bitte unter{' '}
                  <span className="text-sky-400 font-mono">console.anthropic.com → Billing</span>{' '}
                  prüfen und aufladen
                </p>
              </div>
            </div>
            {/* Execute mode badge */}
            {execStatus && (
              <div className={`mt-3 rounded-lg border p-3 text-xs ${
                execStatus.executeMode === 'real'
                  ? 'border-emerald-800/50 bg-emerald-950/20 text-emerald-300'
                  : 'border-amber-800/50 bg-amber-950/20 text-amber-300'
              }`}>
                <span className="font-semibold">
                  {execStatus.executeMode === 'real' ? 'Echter Agent-Modus aktiv' : 'Simulation-Modus aktiv'}
                </span>
                <p className="mt-1 text-gray-400">{execStatus.executeModeHint}</p>
              </div>
            )}
          </div>
        </section>

        {/* Autonomous Mode Section */}
        {autonomousConfig !== null && (
          <section className="space-y-4">
            <SectionHeading
              icon={Zap}
              title="Autonomer Modus"
              badge={
                autonomousConfig.enabled ? (
                  <StatusPill tone="success">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  AUTONOM AKTIV
                  </StatusPill>
                ) : (
                  <StatusPill>MANUELL</StatusPill>
                )
              }
            />
            <div className={`rounded-lg border bg-white/[0.035] p-5 space-y-5 transition-colors ${
              autonomousConfig.enabled ? 'border-emerald-800/50' : 'border-gray-800'
            }`}>
              <p className="text-sm text-gray-400">
                Im autonomen Modus führt ForgePilot Delegations selbständig aus — ohne manuelle Freigabe.
              </p>

              {/* Main toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-200">Autonomer Modus</p>
                  {autonomousConfig.enabled && autonomousConfig.lastEnabledAt && (
                    <p className="text-xs text-emerald-400 mt-0.5">
                      Aktiviert um {new Date(autonomousConfig.lastEnabledAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleAutonomousUpdate({ enabled: !autonomousConfig.enabled })}
                  disabled={autonomousSaving}
                  className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                    autonomousConfig.enabled ? 'bg-emerald-500' : 'bg-slate-600'
                  }`}
                  aria-label="Autonomen Modus umschalten"
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                      autonomousConfig.enabled ? 'translate-x-8' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Sub-settings — dimmed when mode is off */}
              <div className={`space-y-4 transition-opacity ${autonomousConfig.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Einstellungen</p>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autonomousConfig.autoApproveDelegations}
                    onChange={e => handleAutonomousUpdate({ autoApproveDelegations: e.target.checked })}
                    className="form-checkbox h-4 w-4 mt-0.5 text-emerald-500 rounded bg-gray-800 border-gray-700"
                  />
                  <div>
                    <span className="block text-sm font-medium text-gray-300">Delegations auto-freigeben</span>
                    <span className="text-xs text-gray-500">Delegations werden automatisch genehmigt wenn das Risiko passt</span>
                  </div>
                </label>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">Risiko-Schwelle</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: 'low'   , label: 'Niedrig', desc: 'Nur RiskClass A' },
                      { value: 'medium', label: 'Mittel',  desc: 'RiskClass A + B' },
                      { value: 'high'  , label: 'Hoch',    desc: 'A + B (kein C)' },
                      { value: 'all'   , label: 'Alles',   desc: 'Vollständig autonom' },
                    ] as const).map(opt => (
                      <button key={opt.value} type="button"
                        onClick={() => handleAutonomousUpdate({ riskThreshold: opt.value })}
                        className={`px-3 py-2 rounded-lg border text-left transition-colors ${
                          autonomousConfig.riskThreshold === opt.value
                            ? (opt.value === 'all' ? 'bg-emerald-700 border-emerald-500 text-white' : 'bg-gray-700 border-emerald-500 text-white')
                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                        }`}>
                        <span className="block text-sm font-medium">{opt.label}</span>
                        <span className="block text-xs opacity-70">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                  {autonomousConfig.riskThreshold === 'all' && (
                    <p className="mt-2 text-xs text-emerald-400">✓ Vollständig autonom — alle Delegations laufen ohne Rückfrage durch</p>
                  )}
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autonomousConfig.autoExecuteOnApproval}
                    onChange={e => handleAutonomousUpdate({ autoExecuteOnApproval: e.target.checked })}
                    className="form-checkbox h-4 w-4 mt-0.5 text-emerald-500 rounded bg-gray-800 border-gray-700"
                  />
                  <div>
                    <span className="block text-sm font-medium text-gray-300">Nach Freigabe sofort ausführen</span>
                    <span className="text-xs text-gray-500">Delegation startet automatisch nach der Genehmigung</span>
                  </div>
                </label>
              </div>

              {/* Warning — always visible */}
              <div className="flex items-start gap-2 rounded-lg bg-amber-950/30 border border-amber-800/40 px-3 py-2.5 text-xs text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>High-Risk Delegations (RiskClass C) benötigen <strong>immer</strong> deine manuelle Freigabe — unabhängig von dieser Einstellung.</span>
              </div>
            </div>
          </section>
        )}

        {/* Settings Import/Export */}
        <SettingsImportExport />

        {/* Storage Cutover — JOK-188 */}
        <section className="space-y-4" id="storage">
          <SectionHeading icon={Database} title="Storage Cutover" badge={<StatusPill>Persistenz</StatusPill>} />
          <StorageCutoverPanel />
        </section>

        {/* Datenschutz Section — Art. 20 DSGVO */}
        <section className="space-y-4">
          <SectionHeading icon={Lock} title="Datenschutz" badge={<StatusPill>DSGVO</StatusPill>} />
          <div className={cx(panelClassName, 'space-y-3')}>
            <p className="text-sm text-gray-400">
              Gemäß Art. 20 DSGVO können Sie alle über Sie gespeicherten Verarbeitungsprotokolle als ZIP-Archiv herunterladen.
              Das Archiv enthält alle KI-Verarbeitungsrecords, Delegations und Projektbriefs.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => {
                  const date = new Date().toISOString().slice(0, 10)
                  const a = document.createElement('a')
                  a.href = '/api/dsgvo/export'
                  a.download = `forgepilot-export-${date}.zip`
                  document.body.appendChild(a)
                  a.click()
                  document.body.removeChild(a)
                }}
              className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm flex items-center gap-2"
            >
                <Download className="h-4 w-4" />
                <span>Daten exportieren (DSGVO Art. 20)</span>
              </button>
            </div>
            <p className="text-xs text-gray-600">
              Das ZIP enthält: processing-ledger.json, delegations.json, project-briefs.json, metadata.json + README.
            </p>
          </div>
        </section>

        {/* ── Telegram Bot ──────────────────────────────────────────────── */}
        <section>
          <SectionHeading
            icon={Bot}
            title="Telegram Bot"
          />
          <p className="text-sm text-slate-400 mb-4">Status-Updates und Befehle direkt in Telegram empfangen und senden</p>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
            {/* Enable toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setTelegramEnabled(e => !e)}
                className={`relative h-6 w-11 rounded-full transition-colors ${telegramEnabled ? 'bg-violet-600' : 'bg-slate-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${telegramEnabled ? 'translate-x-5' : ''}`} />
              </div>
              <span className="text-sm font-medium text-slate-200">Telegram-Integration aktiviert</span>
            </label>

            {/* Bot Token */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Bot Token</label>
              <input
                type="password"
                value={telegramBotToken}
                onChange={e => setTelegramBotToken(e.target.value)}
                placeholder={telegramConfigured ? '(gesetzt — leer lassen zum Beibehalten)' : '123456789:AABBccDDeeFfGgHhIiJj...'}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <p className="mt-1 text-xs text-slate-500">
                Bot erstellen via <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-violet-400 hover:underline">@BotFather</a> auf Telegram
              </p>
            </div>

            {/* Chat ID */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Chat ID</label>
              <input
                type="text"
                value={telegramChatId}
                onChange={e => setTelegramChatId(e.target.value)}
                placeholder="z.B. 123456789 oder @dein_channel"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <p className="mt-1 text-xs text-slate-500">
                Deine Chat-ID herausfinden: starte <code className="bg-slate-800 px-1 rounded">@userinfobot</code> auf Telegram
              </p>
            </div>

            {/* Severity filter */}
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400">Benachrichtigungen weiterleiten bei Schweregrad</label>
              <div className="flex flex-wrap gap-3">
                {(['info', 'warning', 'critical'] as const).map(sev => (
                  <label key={sev} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={telegramSeverity.includes(sev)}
                      onChange={e => {
                        setTelegramSeverity(prev =>
                          e.target.checked ? [...prev, sev] : prev.filter(s => s !== sev),
                        )
                      }}
                      className="rounded border-slate-600 bg-slate-800 accent-violet-500"
                    />
                    <span className="text-sm text-slate-300 capitalize">{sev}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Webhook URL info */}
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2">
              <p className="text-xs text-slate-500 mb-1">Webhook URL (für @BotFather / setWebhook):</p>
              <code className="text-xs text-violet-300">{'https://[deine-domain]/api/telegram/webhook'}</code>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={async () => {
                  setTelegramSaving(true)
                  try {
                    await fetch('/api/telegram/config', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        botToken: telegramBotToken,
                        chatId: telegramChatId,
                        enabled: telegramEnabled,
                        notifyOnSeverity: telegramSeverity,
                      }),
                    })
                    setTelegramConfigured(true)
                  } finally {
                    setTelegramSaving(false)
                  }
                }}
                disabled={telegramSaving}
                className="rounded-lg border border-violet-600/60 bg-violet-700/20 px-4 py-2 text-sm font-medium text-violet-300 hover:bg-violet-700/30 disabled:opacity-50"
              >
                {telegramSaving ? 'Speichert…' : '💾 Speichern'}
              </button>
              <button
                onClick={async () => {
                  setTelegramTesting(true)
                  setTelegramTestResult(null)
                  try {
                    const res = await fetch('/api/telegram/test', { method: 'POST' })
                    const data = await res.json() as { ok: boolean }
                    setTelegramTestResult(data.ok ? 'ok' : 'error')
                  } catch {
                    setTelegramTestResult('error')
                  } finally {
                    setTelegramTesting(false)
                    setTimeout(() => setTelegramTestResult(null), 4000)
                  }
                }}
                disabled={telegramTesting || !telegramConfigured}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40"
              >
                {telegramTesting ? 'Sende…' : '📨 Test senden'}
              </button>
              {telegramTestResult === 'ok' && (
                <span className="rounded-full bg-emerald-900/40 px-3 py-1 text-xs text-emerald-400">✅ Nachricht gesendet</span>
              )}
              {telegramTestResult === 'error' && (
                <span className="rounded-full bg-red-900/40 px-3 py-1 text-xs text-red-400">❌ Fehler — Token/ChatID prüfen</span>
              )}
              <button
                onClick={async () => {
                  setTelegramSettingWebhook(true)
                  setTelegramWebhookResult(null)
                  try {
                    const res = await fetch('/api/telegram/setup-webhook', { method: 'POST' })
                    const data = await res.json() as { ok: boolean; webhookUrl?: string; error?: string }
                    setTelegramWebhookResult(data.ok ? 'ok' : 'error')
                  } catch {
                    setTelegramWebhookResult('error')
                  } finally {
                    setTelegramSettingWebhook(false)
                    setTimeout(() => setTelegramWebhookResult(null), 5000)
                  }
                }}
                disabled={telegramSettingWebhook || !telegramConfigured}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40"
              >
                {telegramSettingWebhook ? 'Richtet ein…' : '🔗 Webhook einrichten'}
              </button>
              {telegramWebhookResult === 'ok' && (
                <span className="rounded-full bg-emerald-900/40 px-3 py-1 text-xs text-emerald-400">✅ Webhook registriert</span>
              )}
              {telegramWebhookResult === 'error' && (
                <span className="rounded-full bg-red-900/40 px-3 py-1 text-xs text-red-400">❌ Webhook-Fehler — NEXT_PUBLIC_BASE_URL prüfen</span>
              )}
            </div>

            {/* Available commands */}
            <details className="group">
              <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300">▶ Verfügbare Bot-Befehle</summary>
              <div className="mt-2 rounded-lg bg-slate-800 px-3 py-2 font-mono text-xs text-slate-400 space-y-1">
                <p>/help — alle Befehle</p>
                <p>/status — Delegationen &amp; Benachrichtigungen</p>
                <p>/runs — letzte 5 Agent Runs</p>
                <p>/digest — Aktivitäts-Zusammenfassung</p>
                <p>/approve &lt;id&gt; — Delegation genehmigen</p>
                <p>/reject &lt;id&gt; — Delegation ablehnen</p>
                <p>/notif — ungelesene Benachrichtigungen</p>
              </div>
            </details>
          </div>
        </section>

        <div className="pt-4 border-t border-gray-800">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            {saving ? 'Wird gespeichert...' : 'Einstellungen speichern'}
          </button>
        </div>
      </div>
    </main>
  )
}
