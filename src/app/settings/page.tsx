'use client'

import { useEffect, useState } from 'react'
import type { NBAConfig } from '@/lib/nba-engine/nba-config'
import { describeApprovalMode } from '@/lib/nba-engine/approval-policy'
import type { PMAgentResult } from '@/lib/agent-runner/pm-agent'
import type { AutonomousConfig } from '@/lib/config/autonomous-config'

interface ApiKeyField {
  key: 'GITHUB_TOKEN' | 'LINEAR_API_KEY' | 'LINEAR_TEAM_ID' | 'ANTHROPIC_API_KEY'
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
    OLLAMA_BASE_URL: '',
  })
  const [apiKeySaving, setApiKeySaving] = useState(false)
  const [apiKeySaved, setApiKeySaved] = useState(false)
  const [confirmClearKey, setConfirmClearKey] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(setConfig)
    fetch('/api/api-keys')
      .then(res => res.json())
      .then((data: { _set: Record<string, boolean> }) => setApiKeySet(data._set ?? {}))
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
    setApiKeyDraft({ GITHUB_TOKEN: '', LINEAR_API_KEY: '', LINEAR_TEAM_ID: '', ANTHROPIC_API_KEY: '', OLLAMA_BASE_URL: '' })
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

  if (!config) return <div className="p-8 text-white">Lade Einstellungen...</div>

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="border-b border-gray-800 pb-4">
          <h1 className="text-3xl font-bold">⚙️ Engine Einstellungen</h1>
        </header>

        {/* Claude CLI Auth Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-300">🤖 Claude CLI Auth</h2>
            {authLoading ? (
              <span className="text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-500">Lade…</span>
            ) : isMaxActive ? (
              <span className="text-xs px-2 py-1 rounded-full bg-green-900/40 text-green-400 font-medium">Max aktiv</span>
            ) : authStatus?.loggedIn ? (
              <span className="text-xs px-2 py-1 rounded-full bg-yellow-900/40 text-yellow-400 font-medium">Eingeloggt</span>
            ) : (
              <span className="text-xs px-2 py-1 rounded-full bg-red-900/40 text-red-400 font-medium">Nicht eingeloggt</span>
            )}
          </div>
          <div className="bg-gray-900 p-4 rounded-lg border border-gray-800 space-y-2">
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

        {/* API Keys Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-300">🔑 API Keys &amp; Verbindungen</h2>
            {apiKeySaved && (
              <span className="text-green-400 text-sm font-medium animate-pulse">✓ Gespeichert</span>
            )}
          </div>
          <div className="bg-gray-900 p-4 rounded-lg border border-gray-800 space-y-4">
            <p className="text-sm text-gray-400">
              Keys werden lokal in <code className="text-xs bg-gray-800 px-1 py-0.5 rounded">config/api-keys.json</code> gespeichert (nicht in Git).
            </p>
            {API_KEY_FIELDS.map(({ key, label, placeholder, hint, inputType }) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-300">{label}</label>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      apiKeySet[key]
                        ? 'bg-green-900/40 text-green-400'
                        : 'bg-gray-800 text-gray-500'
                    }`}>
                      {apiKeySet[key] ? '✓ Gesetzt' : 'Nicht gesetzt'}
                    </span>
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
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmClearKey(key)}
                          className="text-xs text-gray-600 hover:text-red-400 transition-colors"
                          title="Key löschen"
                        >
                          🗑
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
                  className="w-full bg-gray-950 text-white px-3 py-2 rounded border border-gray-700 focus:border-blue-500 focus:outline-none text-sm font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">{hint}</p>
                {key === 'ANTHROPIC_API_KEY' && isMaxActive && (
                  <p className="text-xs text-green-400 mt-1">Nicht nötig bei Max-Subscription — claude CLI nutzt die OAuth-Session.</p>
                )}
              </div>
            ))}
            <button
              onClick={handleSaveApiKeys}
              disabled={apiKeySaving || Object.values(apiKeyDraft).every(v => !v.trim())}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm"
            >
              {apiKeySaving ? 'Speichere...' : 'API Keys speichern'}
            </button>
          </div>
        </section>

        {/* Ollama / Local AI Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-300">🦙 Lokale KI (Ollama)</h2>
            <span className="text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-500">Optional</span>
          </div>
          <div className="bg-gray-900 p-4 rounded-lg border border-gray-800 space-y-3">
            <p className="text-sm text-gray-400">
              Verbinde einen lokalen Ollama-Server (z.B. auf dem Mac mit M5 Pro) als kostenlose Alternative zu Anthropic.
              <span className="block mt-1 text-xs text-gray-600">Ollama läuft auf <code className="bg-gray-800 px-1 rounded">localhost:11434</code> — von außen per LAN oder Tailscale erreichbar.</span>
            </p>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-gray-300">Ollama Base URL</label>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  apiKeySet['OLLAMA_BASE_URL']
                    ? 'bg-green-900/40 text-green-400'
                    : 'bg-gray-800 text-gray-500'
                }`}>
                  {apiKeySet['OLLAMA_BASE_URL'] ? '✓ Gesetzt' : 'Nicht gesetzt'}
                </span>
              </div>
              <input
                type="text"
                value={apiKeyDraft['OLLAMA_BASE_URL'] ?? ''}
                onChange={e => setApiKeyDraft(prev => ({ ...prev, OLLAMA_BASE_URL: e.target.value }))}
                placeholder={apiKeySet['OLLAMA_BASE_URL'] ? 'URL gesetzt — neu eingeben zum Ändern' : 'http://localhost:11434'}
                className="w-full bg-gray-950 text-white px-3 py-2 rounded border border-gray-700 focus:border-blue-500 focus:outline-none text-sm font-mono"
              />
              <p className="text-xs text-gray-500 mt-1">
                Wird für zukünftige lokale Inferenz genutzt. Noch nicht aktiv — Vorbereitung für Mac-Setup.
              </p>
            </div>
            <button
              onClick={handleSaveApiKeys}
              disabled={apiKeySaving || !apiKeyDraft['OLLAMA_BASE_URL']?.trim()}
              className="w-full bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm"
            >
              {apiKeySaving ? 'Speichere...' : 'Ollama URL speichern'}
            </button>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-300">AI Provider</h2>
            <span className="text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-500">
              {config.aiProvider === 'ollama' ? 'Lokal aktiv' : 'Anthropic aktiv'}
            </span>
          </div>
          <div className="bg-gray-900 p-4 rounded-lg border border-gray-800 space-y-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Coding-/Research-Modell</label>
                <input
                  type="text"
                  value={config.localCodingModel}
                  onChange={e => setConfig({ ...config, localCodingModel: e.target.value })}
                  placeholder="qwen2.5-coder:14b"
                  className="w-full bg-gray-950 text-white px-3 py-2 rounded border border-gray-700 focus:border-blue-500 focus:outline-none text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Schnelles Modell</label>
                <input
                  type="text"
                  value={config.localFastModel}
                  onChange={e => setConfig({ ...config, localFastModel: e.target.value })}
                  placeholder="llama3.2:3b"
                  className="w-full bg-gray-950 text-white px-3 py-2 rounded border border-gray-700 focus:border-blue-500 focus:outline-none text-sm font-mono"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-gray-300">Anzeige Limits</h2>
          <div className="flex justify-between items-center bg-gray-900 p-4 rounded-lg">
            <span>Maximal sichtbare Empfehlungen</span>
            <input
              type="number"
              value={config.maxRecommendations}
              onChange={e => setConfig({...config, maxRecommendations: parseInt(e.target.value)})}
              className="bg-gray-800 text-white px-3 py-1 rounded w-20 text-center"
            />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-gray-300">Time-Decay (Verrottende Backlogs)</h2>
          <div className="bg-gray-900 p-4 rounded-lg space-y-4">
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
                className="bg-gray-800 text-white px-3 py-1 rounded w-20 text-center"
              />
            </div>

            <div className="flex justify-between items-center opacity-80">
              <span>Punkte Abzug (Penalty)</span>
              <input
                type="number"
                value={config.backlogPenaltyScore}
                onChange={e => setConfig({...config, backlogPenaltyScore: parseInt(e.target.value)})}
                className="bg-gray-800 text-white px-3 py-1 rounded w-20 text-center"
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-gray-300">Triage & Extras</h2>
          <div className="bg-gray-900 p-4 rounded-lg">
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
          <h2 className="text-xl font-bold text-gray-300">Freigabe & Autopilot</h2>
          <div className="bg-gray-900 p-4 rounded-lg space-y-4">
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
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-gray-300">Eigene KI-Modelle</h2>
          <div className="bg-gray-900 p-4 rounded-lg space-y-4">
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
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-300">PM Agent Auto-Run</h2>
            <span className="text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-500">Täglich</span>
          </div>
          <div className="bg-gray-900 p-4 rounded-lg border border-gray-800 space-y-4">
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
                            <span className="text-gray-600">{isExpanded ? '▲' : '▼'}</span>
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
        <section className="space-y-4 border border-gray-700 rounded-xl p-5 bg-gray-900/60">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span>🚀</span> Bereit für echten Agenten-Betrieb?
          </h2>
          <div className="space-y-3 text-sm">
            {/* claude CLI */}
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 text-base ${execStatus?.claudeCode?.status === 'healthy' ? 'text-emerald-400' : 'text-red-400'}`}>
                {execStatus?.claudeCode?.status === 'healthy' ? '✅' : '❌'}
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
                {execStatus?.anthropic?.status === 'healthy' ? '✅' : '⚠️'}
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
              <span className="mt-0.5 text-base text-sky-400">ℹ️</span>
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
                  {execStatus.executeMode === 'real' ? '✅ Echter Agent-Modus aktiv' : '⚡ Simulation-Modus aktiv'}
                </span>
                <p className="mt-1 text-gray-400">{execStatus.executeModeHint}</p>
              </div>
            )}
          </div>
        </section>

        {/* Autonomous Mode Section */}
        {autonomousConfig !== null && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-300">Autonomer Modus</h2>
              {autonomousConfig.enabled ? (
                <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-emerald-900/40 text-emerald-400 font-medium">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  AUTONOM AKTIV
                </span>
              ) : (
                <span className="text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-500 font-medium">MANUELL</span>
              )}
            </div>
            <div className={`bg-gray-900 p-5 rounded-lg border space-y-5 transition-colors ${
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
                <span className="shrink-0 mt-0.5">⚠️</span>
                <span>High-Risk Delegations (RiskClass C) benötigen <strong>immer</strong> deine manuelle Freigabe — unabhängig von dieser Einstellung.</span>
              </div>
            </div>
          </section>
        )}

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
