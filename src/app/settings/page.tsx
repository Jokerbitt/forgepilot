'use client'

import { useEffect, useState } from 'react'
import type { NBAConfig } from '@/lib/nba-engine/nba-config'
import { describeApprovalMode } from '@/lib/nba-engine/approval-policy'

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

export default function SettingsPage() {
  const [config, setConfig] = useState<NBAConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [newModel, setNewModel] = useState('')

  // API Keys state
  const [apiKeySet, setApiKeySet] = useState<Record<string, boolean>>({})
  const [apiKeyDraft, setApiKeyDraft] = useState<Record<string, string>>({
    GITHUB_TOKEN: '',
    LINEAR_API_KEY: '',
    LINEAR_TEAM_ID: '',
    ANTHROPIC_API_KEY: '',
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
  }, [])

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
    setApiKeyDraft({ GITHUB_TOKEN: '', LINEAR_API_KEY: '', LINEAR_TEAM_ID: '', ANTHROPIC_API_KEY: '' })
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
