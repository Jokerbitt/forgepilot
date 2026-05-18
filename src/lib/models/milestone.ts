export type MilestoneStatus = 'planned' | 'in_progress' | 'completed' | 'blocked' | 'cancelled'
export type WorkPackageStatus = 'backlog' | 'ready' | 'in_progress' | 'in_review' | 'done' | 'blocked' | 'cancelled'
export type WorkPackagePriority = 'critical' | 'high' | 'medium' | 'low'
export type RiskClass = 'A' | 'B' | 'C'

export interface Milestone {
  id: string
  briefId: string
  title: string
  description: string
  goal: string
  targetWeek?: number      // relative week from project start
  status: MilestoneStatus
  workPackageIds: string[]
  createdAt: string
  updatedAt: string
}

export interface WorkPackage {
  id: string
  milestoneId: string
  briefId: string
  title: string
  description: string
  definitionOfDone: string[]
  riskClass: RiskClass
  priority: WorkPackagePriority
  estimatedHours: number
  dependsOn: string[]      // workPackage IDs
  status: WorkPackageStatus
  delegationIds: string[]
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface MilestoneGenerationResult {
  milestones: Omit<Milestone, 'id' | 'createdAt' | 'updatedAt' | 'briefId' | 'workPackageIds'>[]
  workPackages: Array<Omit<WorkPackage, 'id' | 'createdAt' | 'updatedAt' | 'briefId' | 'milestoneId' | 'delegationIds'> & {
    milestoneIndex: number  // 0-based index into milestones array
  }>
}
