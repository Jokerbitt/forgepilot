export interface WorkItem {
  id: string
  title: string
  description?: string
  priority: number // 1=Urgent, 2=High, 3=Medium, 4=Low, 0=None
  status: string // 'todo' | 'in_progress' | 'done' | 'cancelled' | 'backlog'
  riskClass?: 'low' | 'medium' | 'high' | 'critical'
  dueDate?: string // ISO
  tags?: string[]
  projectId?: string
  estimatedEffort?: number // 1-5 (story points)
  lastUpdated?: string
}

export interface ScoredItem {
  item: WorkItem
  score: number // 0–100
  reasoning: string[] // max 3 bullet points why this score
}

export interface ScoringContext {
  currentDate?: string // ISO, defaults to Date.now()
}

export interface RecommendationResult {
  items: ScoredItem[]
  generatedAt: string
  totalItems: number
}
