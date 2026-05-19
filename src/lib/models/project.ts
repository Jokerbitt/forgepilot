import type { RiskClass, WorkItemStatus } from './work-item'

export type ProjectStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived'
export type MilestoneStatus = 'planned' | 'active' | 'blocked' | 'completed' | 'archived'
export type WorkPackageStatus = WorkItemStatus
export type DependencyType = 'blocks' | 'relates-to' | 'duplicates' | 'supersedes'

export interface ProjectDependency {
  id: string
  fromId: string
  toId: string
  type: DependencyType
  reason?: string
}

export interface WorkPackage {
  id: string
  projectId: string
  milestoneId: string
  title: string
  description: string
  status: WorkPackageStatus
  priority: 0 | 1 | 2 | 3 | 4
  riskClass: RiskClass
  workItemIds: string[]
  requirementIds: string[]
  ownerAgentRole?: string
  estimatedMinutes?: number
  blockedBy?: string[]
  createdAt: string
  updatedAt: string
}

export interface Milestone {
  id: string
  projectId: string
  title: string
  description: string
  status: MilestoneStatus
  order: number
  workPackageIds: string[]
  targetDate?: string
  riskClass?: RiskClass
  createdAt: string
  updatedAt: string
}

export interface Project {
  id: string
  title: string
  slug: string
  status: ProjectStatus
  briefId?: string
  summary: string
  desiredOutcome: string
  ownerId?: string
  milestoneIds: string[]
  workPackageIds: string[]
  dependencyIds: string[]
  knowledgeRootPath?: string
  linearProjectId?: string
  githubRepository?: string
  createdAt: string
  updatedAt: string
}
