'use client'

import { useState, useEffect } from 'react'
import type { Delegation, ExecutionRoute, OutputMode, TaskContract, TaskType } from '@/lib/models/delegation'
import type { RiskClass } from '@/lib/models/work-item'
import { DELEGATION_TEMPLATES, templateToContract } from '@/lib/delegations/templates'
import type { FeatureSuggestion } from '@/app/api/delegations/suggest-features/route'

interface Props {
  onClose: () => void
  onCreate: (delegation: Delegation) => void
  prefillWorkItemId?: string
  prefillGoal?: string
  prefillBriefId?: string
  prefillBriefTitle?: string
  /** Pre-fill all fields from an existing contract (clone/template mode) */
  prefillContract?: Partial<TaskContract>
}

const TEMPLATES = [
  { id: 'feature',  icon: '✨', label: 'Feature',  riskClass: 'B' as RiskClass, branch: 'feature' as const, model: 'claude-sonnet', tools: ['read_file', 'write_file', 'search_code'] },
  { id: 'bugfix',   icon: '🐛', label: 'Bug Fix',  riskClass: 'A' as RiskClass, branch: 'fix' as const,     model: 'claude-haiku',  tools: ['read_file', 'write_file', 'search_code'] },
  { id: 'docs',     icon: '📝', label: 'Docs',     riskClass: 'A' as RiskClass, branch: 'chore' as const,   model: 'claude-haiku',  tools: ['read_file', 'write_file'] },
  { id: 'refactor', icon: '♻️', label: 'Refactor', riskClass: 'B' as RiskClass, branch: 'chore' as const,   model: 'claude-sonnet', tools: ['read_file', 'write_file', 'search_code', 'run_command'] },
]

export function NewDelegationDialog({
  onClose,
  onCreate,
  prefillWorkItemId = '',
  prefillGoal = '',
  prefillBriefId,
  prefillBriefTitle,
  prefillContract,
}: Props) {
  const pc = prefillContract // shorthand

  const [goal, setGoal] = useState(pc?.goal ?? prefillGoal)
  const [context, setContext] = useState(pc?.context ?? '')
  const [workItemId, setWorkItemId] = useState(pc?.workItemId ?? prefillWorkItemId)
  const [dodItems, setDodItems] = useState<string[]>(pc?.definitionOfDone?.length ? pc.definitionOfDone : [''])
  const [selectedTemplate, setSelectedTemplate] = useState<typeof TEMPLATES[0] | null>(null)
  const [selectedRichTemplate, setSelectedRichTemplate] = useState<string | null>(null)
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
  const [generatingDod, setGeneratingDod] = useState(false)
  const [dodError, setDodError] = useState<string | null>(null)
  const [features, setFeatures] = useState<FeatureSuggestion[]>([])
  const [showFeatures, setShowFeatures] = useState(false)
  const [selectedFeatures, setSelectedFeatures] = useState<Set<number>>(new Set())
  const [batchCreating, setBatchCreating] = useState(false)
  const [batchDone, setBatchDone] = useState(0)
  const [project, setProject] = useState('')
  const [customProject, setCustomProject] = useState('')
  const [projectOptions, setProjectOptions] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/delegations/projects')
      .then(r => r.json() as Promise<{ projects: string[] }>)
      .then(data => setProjectOptions(data.projects ?? []))
      .catch(() => setProjectOptions([]))
  }, [])

  const handleTemplateSelect = (t: typeof TEMPLATES[0]) => {
    setSelectedTemplate(t)
    setRiskClass(t.riskClass)
    setBranchStrategy(t.branch)
    setLlmModel(t.model)
  }

  const handleRichTemplateSelect = (templateId: string) => {
    const richTemplate = DELEGATION_TEMPLATES.find(t => t.id === templateId)
    if (!richTemplate) return
    const contract = templateToContract(richTemplate)
    setGoal(contract.goal)
    setContext(contract.context ?? '')
    setDodItems(contract.acceptanceCriteria.length ? contract.acceptanceCriteria : [''])
    setRiskClass(contract.riskClass)
    setBranchStrategy(contract.branchStrategy)
    setMaxBudgetUsd(contract.maxBudgetUsd)
    setSelectedRichTemplate(templateId)
    // also set the simple template indicator
    const simpleMap: Record<string, typeof TEMPLATES[0]> = {
      'add-api-route': TEMPLATES[0], 'add-ui-component': TEMPLATES[0],
      'extend-data-model': TEMPLATES[0], 'add-cron-job': TEMPLATES[3],
      'fix-bug': TEMPLATES[1], 'add-tests': TEMPLATES[2],
      'refactor-module': TEMPLATES[3], 'write-docs': TEMPLATES[2],
    }
    if (simpleMap[templateId]) setSelectedTemplate(simpleMap[templateId])
  }

  const handleGenerateDod = async () => {
    if (!goal.trim()) { setGoalError(true); return }
    setGeneratingDod(true)
    setDodError(null)
    const payload = { goal: goal.trim(), context: context.trim() }
    try {
      // Call DoD + feature suggestions in parallel
      const [dodRes, featRes] = await Promise.all([
        fetch('/api/delegations/generate-dod', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        }),
        fetch('/api/delegations/suggest-features', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        }),
      ])
      const dodData = await dodRes.json() as { dod?: string[]; error?: string }
      const featData = await featRes.json() as { features?: FeatureSuggestion[] }

      if (!dodRes.ok || !dodData.dod) {
        setDodError(dodData.error ?? 'Unbekannter Fehler')
      } else {
        setDodItems(dodData.dod.map(d => d.trim()).filter(d => d.length > 0))
      }
      if (featData.features?.length) {
        setFeatures(featData.features)
        setShowFeatures(true)
      }
    } catch {
      setDodError('Netzwerkfehler beim Generieren')
    } finally {
      setGeneratingDod(false)
    }
  }

  const toggleFeature = (i: number) => {
    setSelectedFeatures(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const toggleAllFeatures = () => {
    setSelectedFeatures(prev =>
      prev.size === features.length ? new Set() : new Set(features.map((_, i) => i))
    )
  }

  const handleBatchCreate = async () => {
    if (selectedFeatures.size === 0) return
    setBatchCreating(true)
    setBatchDone(0)
    const now = new Date().toISOString()
    let created = 0
    for (const idx of Array.from(selectedFeatures).sort()) {
      const f = features[idx]
      const id = `del-${Date.now()}-${idx}`
      const newDelegation: Delegation = {
        id,
        title: f.name,
        status: 'pending',
        executionRoute,
        costEstimateUsd: maxBudgetUsd * 0.5,
        contract: {
          id: `con-${Date.now()}-${idx}`,
          workItemId: selectedProject || 'MANUAL',
          goal: f.goal,
          context: context.trim(),
          taskType: (selectedTemplate?.id as TaskType | undefined) ?? undefined,
          definitionOfDone: ['Task erfolgreich abgeschlossen'],
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
      created++
      setBatchDone(created)
      onCreate(newDelegation)
    }
    setBatchCreating(false)
    onClose()
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
  const selectedProject = project === '__new__' ? customProject.trim() : project

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
      briefId: prefillBriefId,
      briefTitle: prefillBriefTitle,
      contract: {
        id: `con-${Date.now()}`,
        workItemId: selectedProject || 'MANUAL',
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

            {/* Project selector */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Projekt <span className="text-red-400">*</span>
              </label>
              <select
                value={project}
                onChange={e => setProject(e.target.value)}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg p-3 text-white text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="" disabled>Projekt wählen…</option>
                {projectOptions.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
                <option value="__new__">+ Neues Projekt…</option>
              </select>
              {project === '__new__' && (
                <input
                  type="text"
                  value={customProject}
                  onChange={e => setCustomProject(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="projekt-slug (Buchstaben, Zahlen, Bindestriche)"
                  className="w-full mt-2 bg-gray-900 border border-gray-800 rounded-lg p-3 text-white text-sm focus:border-blue-500 focus:outline-none placeholder-gray-600"
                  autoFocus
                />
              )}
            </div>

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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Definition of Done <span className="text-gray-600">(Enter für neue Zeile)</span>
                </label>
                <button
                  type="button"
                  onClick={handleGenerateDod}
                  disabled={generatingDod || !goal.trim()}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-violet-700/50 bg-violet-950/30 text-violet-300 text-xs font-medium transition-colors hover:border-violet-500 hover:text-violet-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="KI generiert DoD-Kriterien aus dem Ziel"
                >
                  {generatingDod ? (
                    <>
                      <span className="inline-block w-2.5 h-2.5 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
                      Generiert…
                    </>
                  ) : (
                    <>✨ KI vorschlagen</>
                  )}
                </button>
              </div>
              {dodError && (
                <p className="text-xs text-red-400 mb-1.5">{dodError}</p>
              )}
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

            {/* Feature Suggestions */}
            {features.length > 0 && (
              <div>
                {/* Header row */}
                <div className="flex items-center justify-between mb-2">
                  <button
                    type="button"
                    onClick={() => setShowFeatures(v => !v)}
                    className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wide hover:text-gray-300 transition-colors"
                  >
                    <span>{showFeatures ? '▾' : '▸'}</span>
                    💡 Feature-Ideen ({features.length})
                  </button>
                  {showFeatures && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={toggleAllFeatures}
                        className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        {selectedFeatures.size === features.length ? 'Keine' : 'Alle'}
                      </button>
                      {selectedFeatures.size > 0 && (
                        <button
                          type="button"
                          onClick={handleBatchCreate}
                          disabled={batchCreating}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-blue-700/60 bg-blue-950/30 text-blue-300 text-xs font-semibold hover:border-blue-500 hover:text-blue-200 transition-colors disabled:opacity-50"
                        >
                          {batchCreating ? (
                            <>
                              <span className="inline-block w-2.5 h-2.5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                              {batchDone}/{selectedFeatures.size} erstellt…
                            </>
                          ) : (
                            <>⚡ {selectedFeatures.size} delegieren</>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {showFeatures && (
                  <div className="rounded-lg border border-gray-800 bg-gray-900/60 overflow-hidden">
                    <table className="w-full text-xs">
                      <tbody>
                        {features.map((f, i) => {
                          const checked = selectedFeatures.has(i)
                          return (
                            <tr
                              key={i}
                              onClick={() => toggleFeature(i)}
                              className={`border-b border-gray-800/50 last:border-0 cursor-pointer transition-colors ${
                                checked ? 'bg-blue-950/20' : 'hover:bg-gray-800/30'
                              }`}
                            >
                              {/* Checkbox */}
                              <td className="pl-3 pr-2 py-2.5 w-6 shrink-0">
                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                  checked
                                    ? 'bg-blue-600 border-blue-500'
                                    : 'border-gray-600 bg-gray-900'
                                }`}>
                                  {checked && <span className="text-white text-[10px] leading-none">✓</span>}
                                </div>
                              </td>
                              {/* Name */}
                              <td className={`py-2.5 pr-2 font-medium transition-colors ${checked ? 'text-white' : 'text-gray-300'}`}>
                                {f.name}
                              </td>
                              {/* Complexity */}
                              <td className="py-2.5 pr-2">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${
                                  f.complexity === 'Klein'  ? 'bg-emerald-950/50 text-emerald-400' :
                                  f.complexity === 'Mittel' ? 'bg-amber-950/50 text-amber-400' :
                                                              'bg-red-950/50 text-red-400'
                                }`}>{f.complexity}</span>
                              </td>
                              {/* When */}
                              <td className="py-2.5 pr-3 text-gray-600 text-right whitespace-nowrap">{f.when}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>

                    {/* Quick single-select footer hint */}
                    <div className="px-3 py-2 border-t border-gray-800 flex items-center justify-between">
                      <span className="text-[10px] text-gray-700">
                        {selectedFeatures.size === 0
                          ? 'Zeilen anklicken zum Auswählen'
                          : `${selectedFeatures.size} ausgewählt`}
                      </span>
                      {selectedFeatures.size === 1 && (() => {
                        const f = features[Array.from(selectedFeatures)[0]]
                        return (
                          <button
                            type="button"
                            onClick={() => {
                              setGoal(f.goal)
                              setDodItems([''])
                              setFeatures([])
                              setShowFeatures(false)
                              setSelectedFeatures(new Set())
                            }}
                            className="text-[10px] text-blue-500 hover:text-blue-300 transition-colors"
                          >
                            → Als Ziel übernehmen
                          </button>
                        )
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}

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

            {/* Rich Template Picker */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                Template wählen
              </label>
              <div className="grid grid-cols-4 gap-1.5 mb-2">
                {DELEGATION_TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleRichTemplateSelect(t.id)}
                    title={t.description}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border text-xs font-medium transition-colors ${
                      selectedRichTemplate === t.id
                        ? 'bg-violet-900/40 border-violet-500 text-violet-300'
                        : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                    }`}
                  >
                    <span className="text-lg">{t.emoji}</span>
                    <span className="text-center leading-tight">{t.name}</span>
                  </button>
                ))}
              </div>
              {selectedRichTemplate && (() => {
                const rt = DELEGATION_TEMPLATES.find(t => t.id === selectedRichTemplate)
                return rt ? (
                  <p className="text-xs text-violet-400/70 bg-violet-950/30 border border-violet-900/40 rounded px-2 py-1">
                    ✓ {rt.name} — Goal, Kontext und {rt.acceptanceCriteria.length} DoD-Kriterien wurden übernommen
                  </p>
                ) : null
              })()}
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
              disabled={!goal.trim() || !selectedProject || saving}
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
