/**
 * context-router.ts — Token-efficient context assembly.
 *
 * Builds only the context blocks actually needed for a given task type,
 * reducing prompt overhead from ~6000 to ~1500 tokens for non-feature tasks.
 */

import { buildKnowledgeBlock } from './knowledge-packages'
import { buildCodebaseContextBlock } from './codebase-scout'
import { buildSkillBlock } from '@/lib/delegation-execution'
import type { TaskContract } from '@/lib/models/delegation'

export type ContextProfile = 'feature' | 'bug-fix' | 'test' | 'ui-component' | 'review' | 'refactor' | 'docs' | 'infra'

export interface ContextBlocks {
  skillBlock: string
  knowledgeBlock: string
  codebaseBlock: string
  /** Estimated token cost of all blocks combined */
  estimatedTokens: number
  /** Which profile was used */
  profile: ContextProfile
}

/**
 * Maps taskType from TaskContract to a ContextProfile.
 * Falls back to 'feature' for unknown types.
 */
export function resolveContextProfile(contract: Pick<TaskContract, 'taskType' | 'skillCategory'>): ContextProfile {
  const t = contract.taskType?.toLowerCase() ?? ''
  const s = contract.skillCategory ?? ''

  if (t === 'test' || s === 'test') return 'test'
  if (t === 'bug' || t === 'bug-fix' || t === 'fix') return 'bug-fix'
  if (t === 'ui' || s === 'ui-component') return 'ui-component'
  if (t === 'review' || t === 'code-review') return 'review'
  if (t === 'refactor' || s === 'refactor') return 'refactor'
  if (t === 'docs' || t === 'documentation' || s === 'documentation') return 'docs'
  if (t === 'infra' || t === 'infrastructure' || s === 'infrastructure') return 'infra'
  return 'feature'
}

/**
 * Profile configuration: which blocks to include for each task type.
 * true = full block, false = skip, 'minimal' = reduced depth
 */
const PROFILE_CONFIG: Record<ContextProfile, {
  skill: boolean
  knowledge: boolean
  codebase: boolean | 'minimal'
}> = {
  'feature':      { skill: true,  knowledge: true,  codebase: true      },
  'bug-fix':      { skill: true,  knowledge: false, codebase: 'minimal' },
  'test':         { skill: true,  knowledge: false, codebase: 'minimal' },
  'ui-component': { skill: true,  knowledge: true,  codebase: 'minimal' },
  'review':       { skill: false, knowledge: false, codebase: false     },
  'refactor':     { skill: true,  knowledge: false, codebase: 'minimal' },
  'docs':         { skill: false, knowledge: false, codebase: 'minimal' },
  'infra':        { skill: true,  knowledge: true,  codebase: true      },
}

function roughTokens(s: string): number {
  return Math.ceil(s.length / 4)
}

/**
 * Builds only the context blocks needed for the given task type.
 * Pass targetRepo for remote repos, omit for local (uses cwd).
 */
export function buildSelectiveContext(
  contract: Pick<TaskContract, 'taskType' | 'skillCategory' | 'goal' | 'context' | 'allowedFilePatterns'>,
  targetRepo?: string,
): ContextBlocks {
  const profile = resolveContextProfile(contract)
  const cfg = PROFILE_CONFIG[profile]

  const skillBlock = cfg.skill
    ? buildSkillBlock(contract.skillCategory, contract.allowedFilePatterns)
    : ''

  const knowledgeBlock = cfg.knowledge
    ? buildKnowledgeBlock(contract.goal, contract.context ?? '', contract.skillCategory)
    : ''

  const codebaseBlock = cfg.codebase && targetRepo
    ? buildCodebaseContextBlock(contract.goal, contract.context ?? '', targetRepo)
    : ''

  const estimatedTokens = roughTokens(skillBlock) + roughTokens(knowledgeBlock) + roughTokens(codebaseBlock)

  return { skillBlock, knowledgeBlock, codebaseBlock, estimatedTokens, profile }
}
