import type { NBARecommendation } from '@/lib/models/nba'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { ExecutionRoute, PrivacyMode, Delegation } from '@/lib/models/delegation'
import { TaskDetailModal } from '@/components/delegation/TaskDetailModal'
import type { NBAConfig } from '@/lib/nba-engine/nba-config'
import { shouldRequireApproval } from '@/lib/nba-engine/approval-policy'

const actionTranslations: Record<string, string> = {
  'do-now': 'JETZT MACHEN',
  'delegate-ai': 'AN KI DELEGIEREN',
  'delegate-runner': 'AN RUNNER DELEGIEREN',
  'research': 'RECHERCHE NÖTIG',
  'wait': 'WARTEN',
  'blocked': 'BLOCKIERT'
}

export function NBACard({ rec }: { rec: NBARecommendation }) {
  const { workItem, score, suggestedAction, rationale } = rec
  const router = useRouter()
  const [isPinning, setIsPinning] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Settings State
  const [isExpertMode, setIsExpertMode] = useState(false)
  const [maxBudgetUsd, setMaxBudgetUsd] = useState<number>(1.0)
  const [branchStrategy, setBranchStrategy] = useState<'feature' | 'fix' | 'chore'>('feature')
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>('local')
  const [executionRoute, setExecutionRoute] = useState<ExecutionRoute>('local-agent')
  const [llmModel, setLlmModel] = useState<string>('claude-3-7-sonnet')
  const [customLlmModels, setCustomLlmModels] = useState<string[]>([])
  const [approvalMode, setApprovalMode] = useState<NBAConfig['approvalMode']>('balanced')
  const [autopilotMinScore, setAutopilotMinScore] = useState(85)
  const [autopilotMaxRiskClass, setAutopilotMaxRiskClass] = useState<NBAConfig['autopilotMaxRiskClass']>('A')
  const [delegating, setDelegating] = useState(false)

  // Context State (User Story)
  const [storyDescription, setStoryDescription] = useState(`Als User möchte ich, dass Aufgabe ${workItem.id} gelöst wird.`)
  const [storyTasks, setStoryTasks] = useState([
    'Code analysieren',
    'Änderungen implementieren',
    'Tests schreiben/anpassen'
  ])
  const [refining, setRefining] = useState(false)
  
  // Delegations State
  const [ticketTasks, setTicketTasks] = useState<Delegation[]>([])
  const [selectedTask, setSelectedTask] = useState<Delegation | null>(null)
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [isTasksExpanded, setIsTasksExpanded] = useState(true)

  // Quick Task State
  const [quickTaskPrompt, setQuickTaskPrompt] = useState('')
  const [creatingQuickTask, setCreatingQuickTask] = useState(false)

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

    fetch('/api/delegations').then(res => res.json()).then((data: Delegation[]) => {
      if (data && Array.isArray(data)) {
        setTicketTasks(data.filter(d => d.contract?.workItemId === workItem.id))
      }
    }).catch(console.error)
  }, [workItem.id])

  const handlePin = async () => {
    setIsPinning(true)
    const config = await fetch('/api/settings').then(res => res.json())
    const currentPins = config.pinnedItems || []
    
    // Toggle pin
    const newPins = currentPins.includes(workItem.id) 
      ? currentPins.filter((id: string) => id !== workItem.id)
      : [...currentPins, workItem.id]
      
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinnedItems: newPins })
    })
    
    // Force a reload to get new scores
    router.refresh()
  }

  const handleMagicRefine = () => {
    setRefining(true)
    // SIMULATION: LLM call to expand the story
    setTimeout(() => {
      setStoryDescription(`**Feature:** ${workItem.title}\n\nAls Entwickler benötige ich eine saubere Implementierung dieser Anforderung, um die Stabilität und Wartbarkeit des Systems zu gewährleisten. Der Code muss den Clean Code Prinzipien folgen und ausreichend getestet sein.`)
      setStoryTasks([
        'Kontext und betroffene Dateien analysieren',
        'Abhängigkeiten prüfen',
        'Logik implementieren',
        'Unit-Tests schreiben (100% Coverage auf neue Zeilen)',
        'Linter ausführen'
      ])
      setRefining(false)
    }, 1500)
  }

  const handleQuickTaskSubmit = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && quickTaskPrompt.trim()) {
      setCreatingQuickTask(true)
      try {
        await fetch('/api/magic-create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'delegation',
            prompt: quickTaskPrompt,
            existingTicketId: workItem.id
          })
        })
        router.refresh()
      } catch (err) {
        console.error(err)
        setCreatingQuickTask(false)
      }
    }
  }

  const handleEditTask = (task: Delegation) => {
    setSelectedTask(task)
    setIsTaskModalOpen(true)
  }

  const handleManualTask = () => {
    const newDelegation: Delegation = {
      id: `DEL-${Date.now().toString().slice(-4)}`,
      status: 'pending',
      executionRoute: 'local-agent',
      costEstimateUsd: 0.1,
      contract: {
        id: `CON-${Date.now().toString().slice(-4)}`,
        workItemId: workItem.id,
        goal: '',
        context: '',
        definitionOfDone: [],
        riskClass: 'A',
        maxBudgetUsd: 1.0,
        allowedTools: ['read_file', 'write_file'],
        branchStrategy: 'feature',
        requiresApproval: true,
        privacyMode: 'local',
        llmModel: 'claude-3-7-sonnet',
        createdAt: new Date().toISOString()
      },
      logs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    setSelectedTask(newDelegation)
    setIsTaskModalOpen(true)
  }

  const handleDelegate = async () => {
    setDelegating(true)
    const delegationId = `del-${Date.now()}`
    
    const contextStr = `# User Story\n${storyDescription}\n\n# Tasks\n${storyTasks.map(t => '- [ ] ' + t).join('\n')}`
    const requiresApproval = shouldRequireApproval({
      approvalMode,
      riskClass: rec.riskClass,
      scoreTotal: score.total,
      autopilotMinScore,
      autopilotMaxRiskClass,
    })

    const payload = {
      id: delegationId,
      contract: {
        id: `tc-${Date.now()}`,
        workItemId: rec.workItem.id,
        goal: `Erledige Aufgabe: ${rec.workItem.title}`,
        context: contextStr,
        definitionOfDone: ['Code kompiliert', 'Tests grün', 'Keine Linter-Fehler'],
        riskClass: rec.riskClass,
        maxBudgetUsd: isExpertMode ? maxBudgetUsd : 1.0,
        allowedTools: isExpertMode ? ['read_file', 'write_file', 'run_command', 'search'] : ['read_file', 'write_file'],
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
        { timestamp: new Date(Date.now() + 1000).toISOString(), type: 'thought', message: 'Analysiere Task Contract und Ticket-Kontext...' }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    try {
      await fetch('/api/delegations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      router.refresh()
    } catch (err) {
      console.error(err)
      setDelegating(false)
    }
  }
  
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const sortedTasks = [...ticketTasks].sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === dropIndex) return
    
    const newTasks = [...sortedTasks]
    const [draggedItem] = newTasks.splice(draggedIndex, 1)
    newTasks.splice(dropIndex, 0, draggedItem)
    
    const updatedTasks = newTasks.map((t, idx) => ({ ...t, priority: idx + 1 }))
    setTicketTasks(updatedTasks)
    setDraggedIndex(null)
    
    try {
      await fetch('/api/delegations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTasks)
      })
    } catch (err) {
      console.error('Failed to update order', err)
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 hover:border-gray-700 transition-colors">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center">
          <span className="text-xs font-mono text-gray-500 mr-2">{workItem.id}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${workItem.source === 'github' ? 'bg-gray-800 text-white' : 'bg-indigo-900/50 text-indigo-300'}`}>
            {workItem.source}
          </span>
          <button 
            onClick={handlePin} 
            disabled={isPinning}
            className="text-xs ml-2 opacity-50 hover:opacity-100 hover:scale-110 transition-all"
            title="Ticket anpinnen (+1000 Score)"
          >
            📌
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-1 rounded-md ${score.total >= 70 ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
            Score: {score.total}
          </span>
        </div>
      </div>
      
      <h3 className="text-white font-medium mb-2">{workItem.title}</h3>
      
      <div className="flex flex-wrap gap-2 mb-4">
        {workItem.labels?.map(label => (
          <span key={label} className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded">
            {label}
          </span>
        ))}
      </div>
      
      {sortedTasks.length > 0 && (
        <div className="mb-4 space-y-2">
          <button 
            onClick={() => setIsTasksExpanded(!isTasksExpanded)}
            className="flex items-center text-xs font-bold text-gray-500 uppercase tracking-wider hover:text-white transition-colors"
          >
            Erstellte AI Tasks ({sortedTasks.length}) {isTasksExpanded ? '▼' : '▶'}
          </button>
          {isTasksExpanded && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
              {sortedTasks.map((task, index) => (
                <div 
                  key={task.id} 
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`bg-gray-950 border border-gray-800 rounded p-2 flex items-center justify-between cursor-grab active:cursor-grabbing hover:border-gray-600 transition-colors ${draggedIndex === index ? 'opacity-50' : ''}`}
                >
                  <span className="text-sm text-gray-300 truncate mr-2 flex items-center gap-2" title={task.contract?.goal}>
                    <span className="text-xs font-bold text-gray-600">#{index + 1}</span>
                    {task.contract?.taskType && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 capitalize">
                        {task.contract.taskType === 'feature' ? '✨ Feature' :
                         task.contract.taskType === 'bugfix' ? '🐛 Bug Fix' :
                         task.contract.taskType === 'docs' ? '📝 Docs' :
                         task.contract.taskType === 'refactor' ? '♻️ Refactor' :
                         task.contract.taskType === 'research' ? '🔍 Research' :
                         task.contract.taskType}
                      </span>
                    )}
                    <span className={task.status === 'failed' ? 'text-red-400' : ''}>
                      {task.contract?.goal || 'Ohne Titel'}
                    </span>
                  </span>
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      task.status === 'completed' ? 'bg-green-900/50 text-green-400' :
                      task.status === 'running' ? 'bg-blue-900/50 text-blue-400' :
                      task.status === 'failed' ? 'bg-red-900/50 text-red-400 border border-red-500/30' :
                      'bg-gray-800 text-gray-400'
                    }`}>
                      {task.status}
                    </span>
                    <button 
                      onClick={() => handleEditTask(task)}
                      className="text-gray-500 hover:text-white transition-colors"
                      title="Task bearbeiten"
                    >
                      ✏️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mb-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input 
              type="text" 
              value={quickTaskPrompt}
              onChange={e => setQuickTaskPrompt(e.target.value)}
              onKeyDown={handleQuickTaskSubmit}
              disabled={creatingQuickTask}
              placeholder="Quick Task eintragen & Enter..."
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:border-blue-500 focus:outline-none placeholder-gray-600 disabled:opacity-50"
            />
          </div>
          <button 
            onClick={handleManualTask}
            className="text-xs font-bold px-3 py-1.5 rounded transition-colors bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700"
            title="Detaillierten Task anlegen"
          >
            📋 Manuell
          </button>
        </div>
      </div>

      <div className="border-t border-gray-800 pt-3 flex justify-between items-center mt-3">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-gray-400">{rationale}</p>
          <div className="flex items-center space-x-3 text-xs text-gray-500 mt-1">
            {workItem.estimate && <span>🎯 {workItem.estimate} pts</span>}
            {workItem.assigneeName && (
              <div className="flex items-center space-x-1">
                {workItem.assigneeAvatarUrl && (
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-700 text-[9px] text-gray-300">
                    {workItem.assigneeName?.slice(0, 1).toUpperCase() ?? '?'}
                  </span>
                )}
                <span>{workItem.assigneeName}</span>
              </div>
            )}
          </div>
        </div>
        {suggestedAction === 'delegate-ai' ? (
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs font-bold px-3 py-1.5 rounded transition-transform bg-blue-600 text-white hover:bg-blue-500 hover:scale-105 cursor-pointer shadow-lg shadow-blue-500/20"
          >
            {isExpanded ? 'SCHLIESSEN' : 'AN KI DELEGIEREN'}
          </button>
        ) : (
          <button className="text-xs font-bold px-3 py-1.5 rounded transition-transform bg-gray-800 text-gray-300 cursor-default">
            {actionTranslations[suggestedAction] || suggestedAction.replace('-', ' ').toUpperCase()}
          </button>
        )}
      </div>
      
      {isExpanded && (
        <div className="mt-4 border-t border-gray-800 pt-4 animate-in fade-in slide-in-from-top-4 duration-300">
          
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-sm font-bold text-white">Agenten-Konfiguration</h4>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-400">Simple Mode</span>
              <button 
                onClick={() => setIsExpertMode(!isExpertMode)}
                className={`w-10 h-5 rounded-full relative transition-colors ${isExpertMode ? 'bg-blue-600' : 'bg-gray-700'}`}
              >
                <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-transform ${isExpertMode ? 'left-6' : 'left-1'}`} />
              </button>
              <span className="text-xs text-gray-400">Expert Mode</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            
            <div className="bg-gray-950 p-4 rounded-lg border border-gray-800 space-y-4">
              <div className="flex justify-between items-center mb-2">
                <h5 className="text-sm font-bold text-gray-300">User Story & Kontext</h5>
                <button 
                  onClick={handleMagicRefine}
                  disabled={refining}
                  className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded flex items-center gap-1 transition-colors"
                >
                  {refining ? 'Lädt...' : '✨ Magic Refine'}
                </button>
              </div>
              
              <div>
                <label className="block text-xs text-gray-500 mb-1">Beschreibung</label>
                <textarea 
                  value={storyDescription}
                  onChange={e => setStoryDescription(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-gray-300 resize-none h-24"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Sub-Tasks</label>
                <textarea 
                  value={storyTasks.join('\n')}
                  onChange={e => setStoryTasks(e.target.value.split('\n'))}
                  className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-gray-300 resize-none h-32"
                  placeholder="Ein Task pro Zeile..."
                />
              </div>
            </div>

            <div className="bg-gray-950 p-4 rounded-lg border border-gray-800 space-y-4">
              <h5 className="text-sm font-bold text-gray-300 mb-2">Einstellungen</h5>
              
              {!isExpertMode ? (
                <div className="text-sm text-gray-400 italic py-4">
                  Im Simple Mode wählt ForgePilot automatisch das beste Setup (Antigravity Agent, $1 Budget) für eine sichere und schnelle Umsetzung.
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Bevorzugter Agent</label>
                    <select 
                      value={executionRoute} onChange={e => setExecutionRoute(e.target.value as ExecutionRoute)}
                      className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white"
                    >
                      <option value="local-agent">Antigravity (Local Agent)</option>
                      <option value="direct-chat">Claude Code (CLI)</option>
                      <option value="runner">n8n Workflow Runner</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">LLM-Modell</label>
                    <select 
                      value={llmModel} onChange={e => setLlmModel(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white"
                    >
                      <optgroup label="Anthropic">
                        <option value="claude-3-7-sonnet">Claude 3.7 Sonnet (Empfohlen)</option>
                        <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                      </optgroup>
                      <optgroup label="OpenAI">
                        <option value="gpt-4o">GPT-4o</option>
                        <option value="o1-preview">o1 Preview</option>
                      </optgroup>
                      {customLlmModels.length > 0 && (
                        <optgroup label="Eigene Modelle">
                          {customLlmModels.map(m => <option key={m} value={m}>{m}</option>)}
                        </optgroup>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Budget ($)</label>
                    <input 
                      type="number" step="0.5" value={maxBudgetUsd} onChange={e => setMaxBudgetUsd(Number(e.target.value))}
                      className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white"
                    />
                  </div>
                </>
              )}
            </div>

          </div>

          <button 
            onClick={handleDelegate}
            disabled={delegating}
            className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg transition-colors flex justify-center items-center gap-2"
          >
            {delegating ? 'Delegation wird gestartet...' : '🚀 JETZT AUSFÜHREN'}
          </button>
        </div>
      )}

      <TaskDetailModal 
        delegation={selectedTask}
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false)
          setSelectedTask(null)
        }}
      />
    </div>
  )
}
