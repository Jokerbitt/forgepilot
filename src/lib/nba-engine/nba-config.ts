import fs from 'fs'
import path from 'path'
import type { RiskClass } from '@/lib/models/work-item'
import type { ApprovalMode } from './approval-policy'

export type AIProvider = 'anthropic' | 'ollama'

export interface NBAConfig {
  ignoreStatuses: string[]
  penalizeOldBacklogs: boolean
  backlogPenaltyAgeDays: number
  backlogPenaltyScore: number
  showTriageJoker: boolean
  maxRecommendations: number
  pinnedItems: string[]
  customLlmModels: string[]
  projects: string[]
  milestones: string[]
  approvalMode: ApprovalMode
  autopilotMinScore: number
  autopilotMaxRiskClass: RiskClass
  aiProvider: AIProvider
  localCodingModel: string
  localFastModel: string
  maxConcurrentAgents: number
  autoStartApproved: boolean
  autoPmAgent?: boolean
}

const CONFIG_PATH = path.join(process.cwd(), 'config', 'nba-settings.json')

const DEFAULT_CONFIG: NBAConfig = {
  ignoreStatuses: ['done', 'cancelled', 'duplicate', 'archived'],
  penalizeOldBacklogs: true,
  backlogPenaltyAgeDays: 90,
  backlogPenaltyScore: 20,
  showTriageJoker: true,
  maxRecommendations: 5,
  pinnedItems: [],
  customLlmModels: [],
  projects: ['LOCAL_IDEAS', 'FORGEPILOT'],
  milestones: ['M0 Foundation', 'M1 Connectors', 'M2 NBA Engine', 'M3 Delegation Queue', 'M4 UX Polish', 'Backlog'],
  approvalMode: 'balanced',
  autopilotMinScore: 85,
  autopilotMaxRiskClass: 'A',
  aiProvider: 'anthropic',
  localCodingModel: 'qwen2.5-coder:14b',
  localFastModel: 'llama3.2:3b',
  maxConcurrentAgents: 2,
  autoStartApproved: false,
}

export function getNBAConfig(): NBAConfig {
  try {
    const data = fs.readFileSync(CONFIG_PATH, 'utf-8')
    const parsed = JSON.parse(data) as Partial<NBAConfig>
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      ignoreStatuses: parsed.ignoreStatuses ?? DEFAULT_CONFIG.ignoreStatuses,
      pinnedItems: parsed.pinnedItems ?? DEFAULT_CONFIG.pinnedItems,
      customLlmModels: parsed.customLlmModels ?? DEFAULT_CONFIG.customLlmModels,
      projects: parsed.projects ?? DEFAULT_CONFIG.projects,
      milestones: parsed.milestones ?? DEFAULT_CONFIG.milestones,
      approvalMode: parsed.approvalMode ?? DEFAULT_CONFIG.approvalMode,
      autopilotMinScore: parsed.autopilotMinScore ?? DEFAULT_CONFIG.autopilotMinScore,
      autopilotMaxRiskClass: parsed.autopilotMaxRiskClass ?? DEFAULT_CONFIG.autopilotMaxRiskClass,
      aiProvider: parsed.aiProvider ?? DEFAULT_CONFIG.aiProvider,
      localCodingModel: parsed.localCodingModel ?? DEFAULT_CONFIG.localCodingModel,
      localFastModel: parsed.localFastModel ?? DEFAULT_CONFIG.localFastModel,
      maxConcurrentAgents: parsed.maxConcurrentAgents ?? DEFAULT_CONFIG.maxConcurrentAgents,
      autoStartApproved: parsed.autoStartApproved ?? DEFAULT_CONFIG.autoStartApproved,
    }
  } catch (error) {
    return DEFAULT_CONFIG
  }
}

export function saveNBAConfig(config: NBAConfig): void {
  const dir = path.dirname(CONFIG_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}
