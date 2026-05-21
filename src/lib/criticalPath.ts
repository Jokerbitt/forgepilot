import fs from 'fs'
import path from 'path'

export interface CriticalPathIssue {
  id: string
  title: string
  priority: number
  status: string
  estimate?: number
}

export interface CriticalPathResult {
  issues: CriticalPathIssue[]
  totalEstimate: number
  longestChain: number
}

interface RawIssue {
  id: string
  title: string
  priority: number
  status: string
  estimate?: number
  blocks?: string[]
  blockedBy?: string[]
}

interface RawIssuesFile {
  issues?: RawIssue[]
}

const EMPTY_RESULT: CriticalPathResult = {
  issues: [],
  totalEstimate: 0,
  longestChain: 0,
}

function loadIssues(): RawIssue[] {
  try {
    const filePath = path.join(process.cwd(), 'config', 'linear-issues.json')
    if (!fs.existsSync(filePath)) {
      return []
    }
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as RawIssuesFile
    if (!Array.isArray(parsed.issues)) {
      return []
    }
    return parsed.issues
  } catch {
    return []
  }
}

function hasDependencies(issues: RawIssue[]): boolean {
  return issues.some(
    (issue) =>
      (issue.blocks && issue.blocks.length > 0) ||
      (issue.blockedBy && issue.blockedBy.length > 0)
  )
}

/**
 * Topological sort using Kahn's algorithm.
 * Returns sorted node IDs, or null if a cycle is detected.
 */
function topologicalSort(
  ids: string[],
  edges: Map<string, string[]>
): string[] | null {
  const inDegree = new Map<string, number>()
  for (const id of ids) {
    inDegree.set(id, 0)
  }

  for (const [, neighbors] of edges) {
    for (const neighbor of neighbors) {
      inDegree.set(neighbor, (inDegree.get(neighbor) ?? 0) + 1)
    }
  }

  const queue: string[] = []
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id)
  }

  const sorted: string[] = []
  while (queue.length > 0) {
    const node = queue.shift()!
    sorted.push(node)
    for (const neighbor of edges.get(node) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 0) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) queue.push(neighbor)
    }
  }

  if (sorted.length !== ids.length) {
    // Cycle detected — return all nodes in original order as fallback
    return null
  }

  return sorted
}

/**
 * Longest path via DP on a DAG.
 * Returns the sequence of node IDs forming the longest path (by node count).
 */
function longestPath(
  sortedIds: string[],
  edges: Map<string, string[]>
): string[] {
  // dp[id] = { length, prev }
  const dp = new Map<string, { length: number; prev: string | null }>()

  for (const id of sortedIds) {
    dp.set(id, { length: 1, prev: null })
  }

  for (const id of sortedIds) {
    for (const neighbor of edges.get(id) ?? []) {
      const current = dp.get(id)!
      const neighborCurrent = dp.get(neighbor)!
      if (current.length + 1 > neighborCurrent.length) {
        dp.set(neighbor, { length: current.length + 1, prev: id })
      }
    }
  }

  // Find node with maximum length
  let maxLength = 0
  let tail: string | null = null
  for (const [id, info] of dp) {
    if (info.length > maxLength) {
      maxLength = info.length
      tail = id
    }
  }

  if (!tail) return []

  // Reconstruct path
  const path_: string[] = []
  let current: string | null = tail
  while (current !== null) {
    path_.unshift(current)
    current = dp.get(current)?.prev ?? null
  }

  return path_
}

function computeGraphCriticalPath(issues: RawIssue[]): CriticalPathResult {
  const issueMap = new Map<string, RawIssue>()
  for (const issue of issues) {
    issueMap.set(issue.id, issue)
  }

  // Build adjacency list: A blocks B means edge A → B
  const edges = new Map<string, string[]>()
  for (const issue of issues) {
    if (!edges.has(issue.id)) {
      edges.set(issue.id, [])
    }
    for (const blockedId of issue.blocks ?? []) {
      if (issueMap.has(blockedId)) {
        edges.get(issue.id)!.push(blockedId)
      }
    }
    // blockedBy: issue is blocked by X → X must precede issue (X → issue)
    for (const blockerId of issue.blockedBy ?? []) {
      if (issueMap.has(blockerId)) {
        if (!edges.has(blockerId)) {
          edges.set(blockerId, [])
        }
        edges.get(blockerId)!.push(issue.id)
      }
    }
  }

  const ids = issues.map((i) => i.id)
  const sorted = topologicalSort(ids, edges)

  // If cycle detected, fall back to priority sort
  if (!sorted) {
    return fallbackPrioritySort(issues)
  }

  const criticalIds = longestPath(sorted, edges)

  if (criticalIds.length === 0) {
    return fallbackPrioritySort(issues)
  }

  const criticalIssues: CriticalPathIssue[] = criticalIds
    .map((id) => issueMap.get(id))
    .filter((i): i is RawIssue => i !== undefined)
    .map(toPathIssue)

  const totalEstimate = criticalIssues.reduce(
    (sum, i) => sum + (i.estimate ?? 0),
    0
  )

  return {
    issues: criticalIssues,
    totalEstimate,
    longestChain: criticalIssues.length,
  }
}

function fallbackPrioritySort(issues: RawIssue[]): CriticalPathResult {
  const sorted = [...issues]
    .sort((a, b) => b.priority - a.priority)
    .map(toPathIssue)

  const totalEstimate = sorted.reduce((sum, i) => sum + (i.estimate ?? 0), 0)

  return {
    issues: sorted,
    totalEstimate,
    longestChain: sorted.length,
  }
}

function toPathIssue(issue: RawIssue): CriticalPathIssue {
  const result: CriticalPathIssue = {
    id: issue.id,
    title: issue.title,
    priority: issue.priority,
    status: issue.status,
  }
  if (issue.estimate !== undefined) {
    result.estimate = issue.estimate
  }
  return result
}

export async function computeCriticalPath(): Promise<CriticalPathResult> {
  try {
    const issues = loadIssues()

    if (issues.length === 0) {
      return EMPTY_RESULT
    }

    if (!hasDependencies(issues)) {
      return fallbackPrioritySort(issues)
    }

    return computeGraphCriticalPath(issues)
  } catch {
    return EMPTY_RESULT
  }
}
