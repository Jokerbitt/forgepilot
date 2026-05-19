'use client'

import { useState } from 'react'
import type { Delegation, ExecutionRoute, OutputMode, TaskContract, TaskType } from '@/lib/models/delegation'
import type { RiskClass } from '@/lib/models/work-item'

interface Props {
  onClose: () => void
  onCreate: (delegation: Delegation) => void
  prefillWorkItemId?: string
  prefillGoal?: string
  /** Pre-fill all fields from an existing contract (clone/template mode) */
  prefillContract?: Partial<TaskContract>
}

const TEMPLATES = [
  { id: 'feature',  icon: '✨', label: 'Feature',  riskClass: 'B' as RiskClass, branch: 'feature' as const, model: 'claude-sonnet', tools: ['read_file', 'write_file', 'search_code'] },
  { id: 'bugfix',   icon: '🐛', label: 'Bug Fix',  riskClass: 'A' as RiskClass, branch: 'fix' as const,     model: 'claude-haiku',  tools: ['read_file', 'write_file', 'search_code'] },
  { id: 'docs',     icon: '📝', label: 'Docs',     riskClass: 'A' as RiskClass, branch: 'chore' as const,   model: 'claude-haiku',  tools: ['read_file', 'write_file'] },
  { id: 'refactor', icon: '♻️', label: 'Refactor', riskClass: 'B' as RiskClass, branch: 'chore' as const,   model: 'claude-sonnet', tools: ['read_file', 'write_file', 'search_code', 'run_command'] },
]

export function NewDelegationDialog({ onClose, onCreate, prefillWorkItemId = '', prefillGoal = '', prefillContract }: Props) {
  const pc = prefillContract // shorthand

  const [goal, setGoal] = useState(pc?.goal ?? prefillGoal)
  const [context, setContext] = useState(pc?.context ?? '')
  const [workItemId, setWorkItemId] = useState(pc?.workItemId ?? prefillWorkItemId)
  const [dodItems, setDodItems] = useState<string[]>(pc?.definitionOfDone?.length ? pc.definitionOfDone : [''])
  const [selectedTemplate, setSelectedTemplate] = useState<typeof TEMPLATES[0] | null>(null)
  const [executionRoute, setExecutionRoute] = useState<ExecutionRoute>('local-agent')
  const [llmModel, setLlmModel] = useState(pc?.llmModel ?? 'claude-sonnet')
  const [maxBudgetUsd, setMaxBudgetUsd] = useState(pc?.maxBudgetUsd ?? 1.0)
  const [riskClass, setRiskClass] = useState<RiskClass>(pc?.riskClass ?? 'B')
  const [branchStrategy, setBranchStrategy] = useState<'feature' | 'fix' | 'chore'>(pc?.branchStrategy ?? 'feature')
  const [privacyMode, setPrivacyMode] = useState<'local' | 'private-cloud' | 'public'>(pc?.privacyMode ?? 'local')
  const [outputMode, setOutputMode] = useState<OutputMode>(pc?.outputMode ?? 'text')
  const [showExpert, setShowExpert] = useState(!!pc) // auto-expand expert panel when cloning
  const [saving, setSaving] = useState(false)
  const [goalError, setGoalError] = useState(false)

  const handleTemplateSelect = (t: typeof TEMPLATES[0]) => {
    setSelectedTemplate(t)
    setRiskClass(t.riskClass)
    setBranchStrategy(t.branch)
    setLlmModel(t.model)
  }

  const handleDodChange = (idx: number, value: string) => {
    setDodItems(prev => prev.map((item, i) => i === idx ? value : item))
  }

  const handleDodKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      setDodItems(prev => [...prev.slice(0, idx + 1), '', ...prev.slice(idx + 1)])
    } else if (e.key === 'Backspace' && dodItems[idx] === '' && dodItems.length > 1) {
      e.preventDefault()
      setDodItems(prev => prev.filter((_, i) => i !== idx))
    }
  }

  const effectiveDod = dodItems.filter(d => d.trim())

  const handleCreate = async () => {
    if (!goal.trim()) {
      setGoalError(true)
      return
    }
    setGoalError(false)
    setSaving(true)

    const now = new Date().toISOString()
    const id = `del-${Date.now()}`
    const newDelegation: Delegation = {
      id,
      title: goal.trim().slice(0, 80),
      status: 'pending',
      executionRoute,
      costEstimateUsd: maxBudgetUsd * 0.5,
      contract: {
        id: `con-${Date.now()}`,
        workItemId: workItemId.trim() || 'MANUAL',
        goal: goal.trim(),
        context: context.trim(),
        taskType: (selectedTemplate?.id as TaskType | undefined) ?? undefined,
        definitionOfDone: effectiveDod.length > 0 ? effectiveDod : ['Task erfolgreich abgeschlossen'],
        riskClass,
        maxBudgetUsd,
        allowedTools: selectedTemplate?.tools ?? ['read_file', 'write_file'],
        branchStrategy,
        requiresApproval: riskClass === 'C',
        privacyMode,
        llmModel,
        outputMode,
        createdAt: now,
      },
      createdAt: now,
      updatedAt: now,
    }

    await fetch('/api/delegations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDelegation),
    })

    setSaving(false)
    onCreate(newDelegation)
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-lg">

          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>{pc ? '🔁' : '⚡'}</span>
              {pc ? 'Delegation klonen' : 'Neue Delegation'}
            </h2>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-xl leading-none">×</button>
          </div>

          <div className="p-6 space-y-5">

            {/* Goal */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Ziel <span className="text-red-400">*</span>
              </label>
              <textarea
                value={goal}
                onChange={e => { setGoal(e.target.value); if (e.target.value.trim()) setGoalError(false) }}
                placeholder="Was soll der Agent tun? Kurz und präzise..."
                className={`w-full bg-gray-900 border rounded-lg p-3 text-white text-sm resize-none h-20 focus:outline-none placeholder-gray-600 ${
                  goalError ? 'border-red-500 focus:border-red-400' : 'border-gray-800 focus:border-blue-500'
                }`}
                autoFocus
              />
              {goalError && (
                <p className="text-xs text-red-400 mt-1">Ziel ist Pflichtfeld.</p>
              )}
            </div>

            {/* Context */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Kontext <span className="text-gray-600">(optional)</span>
              </label>
              <textarea
                value={context}
                onChange={e => setContext(e.target.value)}
                placeholder="Zusätzlicher Kontext für den Agenten: betroffene Dateien, bekannte Probleme, Abhängigkeiten..."
                className="w-full bg-gray-900 border border-gray-800 rounded-lg p-3 text-white text-sm resize-none h-16 focus:border-blue-500 focus:outline-none placeholder-gray-600"
              />
            </div>

            {/* Definition of Done */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Definition of Done <span className="text-gray-600">(Enter für neue Zeile)</span>
              </label>
              <div className="space-y-1.5">
                {dodItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-gray-600 text-xs w-3 flex-shrink-0">◻</span>
                    <input
                      type="text"
                      value={item}
                      onChange={e => handleDodChange(idx, e.target.value)}
                      onKeyDown={e => handleDodKeyDown(idx, e)}
                      placeholder={idx === 0 ? 'Task erfolgreich abgeschlossen' : 'Weiteres Kriterium...'}
                      className="flex-1 bg-gray-900 border border-gray-800 rounded p-2 text-white text-sm focus:border-blue-500 focus:outline-none placeholder-gray-600"
                    />
                    {dodItems.length > 1 && (
                      <button
                        onClick={() => setDodItems(prev => prev.filter((_, i) => i !== idx))}
                        className="text-gray-600 hover:text-red-400 text-sm transition-colors"
                        title="Entfernen"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => setDodItems(prev => [...prev, ''])}
                  className="text-xs text-gray-600 hover:text-gray-400 flex items-center gap-1 transition-colors mt-1"
                >
                  <span>+</span> Kriterium hinzufügen
                </button>
              </div>
            </div>

            {/* Ticket (optional) */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Ticket-ID <span className="text-gray-600">(optional)</span>
              </label>
              <input
                type="text"
                value={workItemId}
                onChange={e => setWorkItemId(e.target.value)}
                placeholder="z.B. JOK-42"
                className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2.5 text-white text-sm focus:border-blue-500 focus:outline-none placeholder-gray-600"
              />
            </div>

            {/* Template selection */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                Vorlage
              </label>
              <div className="grid grid-cols-4 gap-2">
                {TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleTemplateSelect(t)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-xs font-medium transition-colors ${
                      selectedTemplate?.id === t.id
                        ? 'bg-blue-900/40 border-blue-500 text-blue-300'
                        : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                    }`}
                  >
                    <span className="text-xl">{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>
              {selectedTemplate && (
                <p className="text-xs text-gray-600 mt-2">
                  → RiskClass {selectedTemplate.riskClass} · {selectedTemplate.branch}/ · {selectedTemplate.model}
                </p>
              )}
            </div>

            {/* Expert options toggle */}
            <button
              onClick={() => setShowExpert(v => !v)}
              className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1.5 transition-colors"
            >
              <span>{showExpert ? '▾' : '▸'}</span>
              Alle Optionen (Expert)
            </button>

            {showExpert && (
              <div className="grid grid-cols-2 gap-3 bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Modell</label>
                  <input
                    type="text"
                    value={llmModel}
                    onChange={e => setLlmModel(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Budget ($)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={maxBudgetUsd}
                    onChange={e => setMaxBudgetUsd(Number(e.target.value))}
                    className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Risk Class</label>
                  <select
                    value={riskClass}
                    onChange={e => setRiskClass(e.target.value as RiskClass)}
                    className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white text-xs focus:border-blue-500 focus:outline-none"
                  >
                    <option value="A">A — Gering</option>
                    <option value="B">B — Moderat</option>
                    <option value="C">C — Kritisch</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Branch</label>
                  <select
                    value={branchStrategy}
                    onChange={e => setBranchStrategy(e.target.value as 'feature' | 'fix' | 'chore')}
                    className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white text-xs focus:border-blue-500 focus:outline-none"
                  >
                    <option value="feature">feature/</option>
                    <option value="fix">fix/</option>
                    <option value="chore">chore/</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ausführung</label>
                  <select
                    value={executionRoute}
                    onChange={e => setExecutionRoute(e.target.value as ExecutionRoute)}
                    className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white text-xs focus:border-blue-500 focus:outline-none"
                  >
                    <option value="local-agent">local-agent</option>
                    <option value="direct-chat">direct-chat</option>
                    <option value="runner">runner</option>
                    <option value="n8n">n8n</option>
                    <option value="manual">manual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Privacy</label>
                  <select
                    value={privacyMode}
                    onChange={e => setPrivacyMode(e.target.value as 'local' | 'private-cloud' | 'public')}
                    className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white text-xs focus:border-blue-500 focus:outline-none"
                  >
                    <option value="local">local</option>
                    <option value="private-cloud">private-cloud</option>
                    <option value="public">public</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Output-Mode</label>
                  <select
                    value={outputMode}
                    onChange={e => setOutputMode(e.target.value as OutputMode)}
                    className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white text-xs focus:border-blue-500 focus:outline-none"
                  >
                    <option value="text">text — lesbare Ausgabe</option>
                    <option value="json">json — maschinenlesbar</option>
                    <option value="stream">stream — Live-Ausgabe</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleCreate}
              disabled={!goal.trim() || saving}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2"
            >
              {saving ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Erstellt...
                </>
              ) : (
                <>⚡ Delegation starten</>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
