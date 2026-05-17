export type AgentRole =
  | 'product-planner'
  | 'architect'
  | 'backend-engineer'
  | 'frontend-saas-designer'
  | 'local-ai-worker'
  | 'qa-reviewer'
  | 'devops-automation'
  | 'knowledge-curator'

export type AgentAvailability = 'available' | 'busy' | 'offline' | 'disabled'
export type AgentAutonomyLevel = 'read-only' | 'propose-only' | 'supervised-write' | 'autopilot'

export interface AgentSkillRef {
  id: string
  title: string
  path: string
}

export interface AgentProfile {
  id: string
  displayName: string
  role: AgentRole
  availability: AgentAvailability
  autonomyLevel: AgentAutonomyLevel
  strengths: string[]
  limits: string[]
  preferredWorkloads: string[]
  allowedToolIds: string[]
  skillRefs: AgentSkillRef[]
  costClass: 'free-local' | 'included-subscription' | 'metered-low' | 'metered-high'
  defaultModelProfileId?: string
  updatedAt: string
}
