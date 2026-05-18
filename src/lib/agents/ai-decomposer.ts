/**
 * AI-powered Task Decomposer
 *
 * Uses Claude (Haiku for speed) to intelligently decompose any delegation
 * goal into atomic sub-tasks. Falls back to pattern-based decomposition
 * when AI is unavailable.
 */

import { generateText, stripJsonCodeFence } from '@/lib/ai/text-generation'
import { decomposeTask } from './atomic-task'
import type { AtomicTask } from './atomic-task'

const SYSTEM_PROMPT = `You are an expert software engineering task decomposer for ForgePilot.
Your job: break a high-level engineering goal into 2-6 atomic sub-tasks.

Rules for atomic tasks:
- Each task touches ≤ 3 files
- Each task has a clear "done" state (acceptance criteria)
- Each task is independent or clearly sequential
- Prefer smaller over larger (S over M over L)
- Assign skill categories: api-route | ui-component | data-model | test | refactor | infrastructure | documentation
- Assign best agent: claude-code | codex | antigravity | general

Respond ONLY with a JSON array. No explanations. Schema:
[{
  "title": "Short imperative title",
  "description": "One sentence explaining what to build",
  "acceptanceCriteria": ["criterion 1", "criterion 2"],
  "skillCategory": "api-route",
  "assignedAgentType": "claude-code",
  "filePatterns": ["src/app/api/**/*.ts"],
  "effort": "S",
  "dependsOn": []
}]`

interface RawTask {
  title?: string
  description?: string
  acceptanceCriteria?: string[]
  skillCategory?: string
  assignedAgentType?: string
  filePatterns?: string[]
  effort?: string
  dependsOn?: string[]
}

export async function decomposeWithAI(
  goal: string,
  context?: string,
): Promise<AtomicTask[]> {
  try {
    const prompt = context
      ? `Goal: ${goal}\n\nContext: ${context}`
      : `Goal: ${goal}`

    const result = await generateText({
      system: SYSTEM_PROMPT,
      prompt,
      maxTokens: 1500,
      purpose: 'fast',
    })

    const raw = JSON.parse(stripJsonCodeFence(result.text)) as RawTask[]
    if (!Array.isArray(raw) || raw.length === 0) throw new Error('Empty response')

    return raw.map((t: RawTask, i: number): AtomicTask => ({
      id: `ai-task-${Date.now()}-${i}`,
      title: t.title ?? `Task ${i + 1}`,
      description: t.description ?? goal,
      acceptanceCriteria: Array.isArray(t.acceptanceCriteria) ? t.acceptanceCriteria : [],
      skillCategory: (t.skillCategory ?? 'infrastructure') as AtomicTask['skillCategory'],
      assignedAgentType: (t.assignedAgentType ?? 'claude-code') as AtomicTask['assignedAgentType'],
      filePatterns: Array.isArray(t.filePatterns) ? t.filePatterns : ['src/**/*'],
      effort: (['S', 'M', 'L'].includes(t.effort ?? '') ? t.effort : 'M') as AtomicTask['effort'],
      dependsOn: Array.isArray(t.dependsOn) ? t.dependsOn : [],
      order: i,
    }))
  } catch {
    // Fallback to pattern-based decomposition
    return decomposeTask(goal, context)
  }
}
