'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { NBARecommendation } from '@/lib/models/nba'
import type { Delegation, ExecutionRoute, PrivacyMode } from '@/lib/models/delegation'
import type { NBAConfig } from '@/lib/nba-engine/nba-config'
import { shouldRequireApproval } from '@/lib/nba-engine/approval-policy'

type BranchStrategy = 'feature' | 'fix' | 'chore'

const BRANCH_STRATEGIES: BranchStrategy[] = ['feature', 'fix', 'chore']
const PRIVACY_MODES: PrivacyMode[] = ['local', 'private-cloud', 'public']
const EXECUTION_ROUTES: ExecutionRoute[] = ['local-agent', 'direct-chat', 'runner']

function toBranchStrategy(value: string): BranchStrategy {
  return BRANCH_STRATEGIES.includes(value as BranchStrategy) ? value as BranchStrategy : 'feature'
}

function toPrivacyMode(value: string): PrivacyMode {
  return PRIVACY_MODES.includes(value as PrivacyMode) ? value as PrivacyMode : 'local'
}

function toExecutionRoute(value: string): ExecutionRoute {
  return EXECUTION_ROUTES.includes(value as ExecutionRoute) ? value as ExecutionRoute : 'local-agent'
}

interface DelegationModalProps {
  rec: NBARecommendation | null
  isOpen: boolean
  onClose: () => void
}

const LINEAR_ID_RE = /^[A-Z]+-\d+$/i

export function DelegationModal({ rec, isOpen, onClose }: DelegationModalProps) {
  const router = useRouter()
  const [isExpertMode, setIsExpertMode] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Expert mode states
  const [maxBudgetUsd, setMaxBudgetUsd] = useState(1.0)
  const [branchStrategy, setBranchStrategy] = useState<BranchStrategy>('feature')
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>('local')
  const [executionRoute, setExecutionRoute] = useState<ExecutionRoute>('local-agent')
  const [llmModel, setLlmModel] = useState<string>('claude-3-7-sonnet')
  const [customLlmModels, setCustomLlmModels] = useState<string[]>([])
  const [approvalMode, setApprovalMode] = useState<NBAConfig['approvalMode']>('balanced')
  const [autopilotMinScore, setAutopilotMinScore] = useState(85)
  const [autopilotMaxRiskClass, setAutopilotMaxRiskClass] = useState<NBAConfig['autopilotMaxRiskClass']>('A')
  const [customContext, setCustomContext] = useState<string>('')

  // Linear auto-fill state (M17)
  const [workItemId, setWorkItemId] = useState<string>('')
  const [autofillGoal, setAutofillGoal] = useState<string>('')
  const [autofillDoD, setAutofillDoD] = useState<string[]>([])
  const [isFetchingDetails, setIsFetchingDetails] = useState(false)

  // Fetch custom models
  useEffect(() => {
    fetch('/api/settings').then(res => res.json()).then(data => {
      if (data && data.customLlmModels) {
        setCustomLlmModels(data.customLlmModels)
      }
      if (data && data.approvalMode) {
        setApprovalMode(data.approvalMode)
        setAutopilotMinScore(data.autopilotMinScore ?? 85)
        setAutopilotMaxRiskClass(data.autopilotMaxRiskClass ?? 'A')
      }
    }).catch(console.error)
  }, [])

  // Seed workItemId from the recommendation when opening the modal so a user
  // can blur to auto-fill, or edit before triggering a fetch.
  useEffect(() => {
    if (rec) {
      setWorkItemId(rec.workItem.id)
      setAutofillGoal('')
      setAutofillDoD([])
    }
  }, [rec])

  async function handleWorkItemIdBlur() {
    const id = workItemId.trim()
    if (!id || !LINEAR_ID_RE.test(id)) return
    setIsFetchingDetails(true)
    try {
      const res = await fetch(`/api/work-items/${encodeURIComponent(id)}/details`)
      if (!res.ok) return
      const data = (await res.json()) as { title?: string; description?: string }
      if (data.title) {
        setAutofillGoal(data.title)
        setAutofillDoD([`Implement: ${data.title}`])
        if (data.description) {
          setCustomContext((data.description ?? '').slice(0, 500))
        }
      }
    } catch {
      // Silent: per spec, fetch failures must not surface UI errors.
    } finally {
      setIsFetchingDetails(false)
    }
  }

  if (!isOpen || !rec) return null

  const handleDelegate = async () => {
    setIsSubmitting(true)
    
    // Create the delegation object
    const delegationId = `del-${Date.now()}`
    const requiresApproval = shouldRequireApproval({
      approvalMode,
      riskClass: rec.riskClass,
      scoreTotal: rec.score.total,
      autopilotMinScore,
      autopilotMaxRiskClass,
    })
    const effectiveWorkItemId = workItemId.trim() || rec.workItem.id
    const goal = autofillGoal
      ? autofillGoal
      : `Erledige Aufgabe: ${rec.workItem.title}`
    const definitionOfDone = autofillDoD.length > 0
      ? autofillDoD
      : ['Code kompiliert', 'Tests grün', 'Keine Linter-Fehler']

    const delegation: Delegation = {
      id: delegationId,
      title: rec.workItem.title.slice(0, 80),
      contract: {
        id: `tc-${Date.now()}`,
        workItemId: effectiveWorkItemId,
        goal,
        context: customContext,
        definitionOfDone,
        riskClass: rec.riskClass,
        maxBudgetUsd: isExpertMode ? maxBudgetUsd : 1.0,
        allowedTools: ['all'],
        branchStrategy: isExpertMode ? branchStrategy : 'feature',
        requiresApproval,
        privacyMode: isExpertMode ? privacyMode : 'local',
        llmModel: isExpertMode ? llmModel : 'claude-3-7-sonnet',
        createdAt: new Date().toISOString()
      },
      status: requiresApproval ? 'pending' : 'approved',
      executionRoute: isExpertMode ? executionRoute : rec.executionRoute,
      costEstimateUsd: rec.estimatedCostUsd || 0.1,
      logs: [
        { timestamp: new Date().toISOString(), type: 'info', message: 'Delegation Request empfangen.' },
        ...(requiresApproval ? [] : [{ timestamp: new Date().toISOString(), type: 'success' as const, message: `Auto-Freigabe durch ${approvalMode}-Modus.` }]),
        { timestamp: new Date(Date.now() + 1000).toISOString(), type: 'thought', message: 'Analysiere Task Contract und Ticket-Kontext...' },
        { timestamp: new Date(Date.now() + 2500).toISOString(), type: 'command', message: 'git checkout -b feature/M3-test' },
        { timestamp: new Date(Date.now() + 4000).toISOString(), type: 'thought', message: 'Lade benötigte Dateien in den Kontext.' }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    if (!requiresApproval) {
      delegation.status = 'running'
    }
    
    await fetch('/api/delegations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(delegation)
    })
    
    setIsSubmitting(false)
    onClose()
    router.refresh()
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <header className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-950">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>🤖</span> Task Contract: KI-Delegation
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
        </header>
        
        <div className="p-6 overflow-y-auto">
          <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="text-xs text-gray-500 font-mono mb-1">{rec.workItem.id}</div>
            <h3 className="text-lg font-medium text-white">{rec.workItem.title}</h3>
            <p className="text-sm text-gray-400 mt-2">Risiko-Klasse: <span className="text-white">{rec.riskClass}</span></p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Work-Item-ID (Linear: z.B. ENG-42)
            </label>
            <div className="relative">
              <input
                type="text"
                value={workItemId}
                onChange={e => setWorkItemId(e.target.value)}
                onBlur={handleWorkItemIdBlur}
                placeholder="z.B. ENG-42"
                aria-label="Work Item ID"
                data-testid="delegation-work-item-id"
                className="w-full bg-gray-950 border border-gray-700 rounded-md px-3 py-2 pr-10 text-white"
              />
              {isFetchingDetails && (
                <span
                  role="status"
                  aria-label="Lade Linear-Details"
                  data-testid="delegation-autofill-spinner"
                  className="absolute right-3 top-1/2 -translate-y-1/2 inline-block h-4 w-4 rounded-full border-2 border-gray-600 border-t-blue-400 animate-spin"
                />
              )}
            </div>
            {autofillGoal && (
              <p className="text-xs text-blue-300 mt-2" data-testid="delegation-autofill-preview">
                ✓ Aus Linear vorausgefüllt: <span className="text-white">{autofillGoal}</span>
              </p>
            )}
          </div>

          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-800">
            <span className="text-gray-300 font-medium">Modus</span>
            <label className="flex items-center cursor-pointer">
              <span className={`mr-3 text-sm ${!isExpertMode ? 'text-blue-400 font-bold' : 'text-gray-500'}`}>Simple Mode</span>
              <div className="relative">
                <input type="checkbox" className="sr-only" checked={isExpertMode} onChange={() => setIsExpertMode(!isExpertMode)} />
                <div className={`block w-10 h-6 rounded-full transition-colors ${isExpertMode ? 'bg-indigo-600' : 'bg-gray-700'}`}></div>
                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isExpertMode ? 'transform translate-x-4' : ''}`}></div>
              </div>
              <span className={`ml-3 text-sm ${isExpertMode ? 'text-indigo-400 font-bold' : 'text-gray-500'}`}>Expert Mode</span>
            </label>
          </div>

          {!isExpertMode ? (
            <div className="space-y-4 text-gray-300">
              <p>Dieser Task wird an die KI übergeben mit den folgenden Standardwerten:</p>
              <ul className="list-disc pl-5 space-y-2 text-sm text-gray-400">
                <li>Budget-Limit: <strong className="text-white">$1.00</strong></li>
                <li>Branching: <strong className="text-white">Automatisch</strong></li>
                <li>Privacy: <strong className="text-white">Lokal (sicher)</strong></li>
                <li>Tools: <strong className="text-white">Alle Standard-Tools erlaubt</strong></li>
              </ul>
              <div className="bg-blue-900/20 border border-blue-900/50 p-4 rounded-lg mt-4 text-sm text-blue-200">
                ℹ️ Im Simple Mode füllt die Engine den Vertrag automatisch optimal aus. Du kannst die Details später im Review prüfen.
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Zusätzlicher Kontext (Optional)</label>
                <textarea 
                  value={customContext} onChange={e => setCustomContext(e.target.value)}
                  placeholder="Gibt dem Agenten Hinweise zur Ausführung (z.B. 'Bitte nutze Tailwind für das Styling...')"
                  rows={3}
                  className="w-full bg-gray-950 border border-gray-700 rounded-md px-3 py-2 text-white resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Maximales Budget (USD)</label>
                <input 
                  type="number" step="0.1" 
                  value={maxBudgetUsd} onChange={e => setMaxBudgetUsd(parseFloat(e.target.value))}
                  className="w-full bg-gray-950 border border-gray-700 rounded-md px-3 py-2 text-white" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Branch-Strategie</label>
                <select 
                  value={branchStrategy} onChange={e => setBranchStrategy(toBranchStrategy(e.target.value))}
                  className="w-full bg-gray-950 border border-gray-700 rounded-md px-3 py-2 text-white"
                >
                  <option value="feature">Feature Branch (z.B. feature/JOK-1)</option>
                  <option value="fix">Bugfix Branch (z.B. fix/JOK-1)</option>
                  <option value="chore">Chore Branch</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Privacy Mode</label>
                <select 
                  value={privacyMode} onChange={e => setPrivacyMode(toPrivacyMode(e.target.value))}
                  className="w-full bg-gray-950 border border-gray-700 rounded-md px-3 py-2 text-white"
                >
                  <option value="local">Lokal (Local LLM / Runner)</option>
                  <option value="private-cloud">Private Cloud (API)</option>
                  <option value="public">Public (Unbeschränkt)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Bevorzugter Agent (Route)</label>
                <select 
                  value={executionRoute} onChange={e => setExecutionRoute(toExecutionRoute(e.target.value))}
                  className="w-full bg-gray-950 border border-gray-700 rounded-md px-3 py-2 text-white mb-2"
                >
                  <option value="local-agent">Antigravity (Local Agent)</option>
                  <option value="direct-chat">Claude Code (CLI)</option>
                  <option value="runner">n8n Workflow Runner</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Gewünschtes LLM-Modell</label>
                <select 
                  value={llmModel} onChange={e => setLlmModel(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-700 rounded-md px-3 py-2 text-white"
                >
                  <optgroup label="Anthropic">
                    <option value="claude-3-7-sonnet">Claude 3.7 Sonnet (Empfohlen)</option>
                    <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                    <option value="claude-3-opus">Claude 3 Opus</option>
                  </optgroup>
                  <optgroup label="Google">
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                    <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                  </optgroup>
                  <optgroup label="OpenAI">
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="o1-preview">o1 Preview (Für komplexe Logik)</option>
                  </optgroup>
                  <optgroup label="Lokal / Open Source">
                    <option value="llama-3-70b">Llama 3 70B (Ollama)</option>
                    <option value="deepseek-coder">DeepSeek Coder V2</option>
                  </optgroup>
                  {customLlmModels.length > 0 && (
                    <optgroup label="Eigene Modelle">
                      {customLlmModels.map(model => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>
          )}
        </div>

        <footer className="px-6 py-4 border-t border-gray-800 bg-gray-950 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            disabled={isSubmitting}
          >
            Abbrechen
          </button>
          <button 
            onClick={handleDelegate}
            disabled={isSubmitting}
            className={`px-6 py-2 rounded-lg font-bold text-white transition-colors ${
              isExpertMode ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            {isSubmitting ? 'Delegiere...' : 'Vertrag unterschreiben & Starten'}
          </button>
        </footer>
      </div>
    </div>
  )
}
