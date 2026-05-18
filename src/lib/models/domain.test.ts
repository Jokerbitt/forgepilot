import { describe, it, expect } from 'vitest'
import type { AgentProfile } from './agent-profile'
import type { ContextPackage } from './context-package'
import type { KnowledgeItem, MemoryCard } from './knowledge'
import type { ModelProfile, RoutingDecision } from './model-router'
import type { Milestone, Project, WorkPackage } from './project'

describe('project domain models', () => {
  it('connects project, milestone and work package ids without duplicating WorkItem fields', () => {
    const project: Project = {
      id: 'project-forgepilot',
      title: 'ForgePilot',
      slug: 'forgepilot',
      status: 'active',
      summary: 'AI workflow OS for controlled project execution',
      desiredOutcome: 'Turn ideas into governed agent work',
      milestoneIds: ['m1'],
      workPackageIds: ['wp1'],
      dependencyIds: [],
      createdAt: '2026-05-17T10:00:00Z',
      updatedAt: '2026-05-17T10:00:00Z',
    }

    const milestone: Milestone = {
      id: 'm1',
      projectId: project.id,
      title: 'M1 - Project Brief',
      description: 'Project understanding and blueprint',
      status: 'active',
      order: 1,
      workPackageIds: ['wp1'],
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    }

    const workPackage: WorkPackage = {
      id: 'wp1',
      projectId: project.id,
      milestoneId: milestone.id,
      title: 'Domain models',
      description: 'Add missing shared models',
      status: 'todo',
      priority: 1,
      riskClass: 'A',
      workItemIds: ['JOK-142'],
      requirementIds: [],
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    }

    expect(project.milestoneIds).toContain(milestone.id)
    expect(milestone.workPackageIds).toContain(workPackage.id)
    expect(workPackage.workItemIds).toEqual(['JOK-142'])
  })
})

describe('knowledge and context models', () => {
  it('links memory cards into context packages with privacy and token budget', () => {
    const knowledgeItem: KnowledgeItem = {
      id: 'ki1',
      projectId: 'project-forgepilot',
      sourceId: 'source1',
      type: 'decision',
      title: 'Local-first routing',
      summary: 'Use local models for simple and sensitive work.',
      contentHash: 'hash1',
      confidence: 'high',
      freshness: 'fresh',
      tags: ['local-ai'],
      relatedItemIds: [],
      createdAt: '2026-05-17T10:00:00Z',
      updatedAt: '2026-05-17T10:00:00Z',
    }

    const memoryCard: MemoryCard = {
      id: 'mem1',
      projectId: knowledgeItem.projectId,
      type: 'decision',
      title: knowledgeItem.title,
      summary: knowledgeItem.summary,
      sourceItemIds: [knowledgeItem.id],
      confidence: 'high',
      freshness: 'fresh',
      tags: ['local-ai'],
      tokenEstimate: 40,
      createdAt: knowledgeItem.createdAt,
      updatedAt: knowledgeItem.updatedAt,
    }

    const contextPackage: ContextPackage = {
      id: 'ctx1',
      projectId: knowledgeItem.projectId,
      workItemId: 'JOK-144',
      status: 'ready',
      goal: 'Build Context Package Builder',
      summary: 'Use memory cards and source references.',
      references: [{
        id: memoryCard.id,
        type: 'memory_card',
        title: memoryCard.title,
        urlOrPath: 'memory/mem1.md',
        relevanceScore: 0.92,
        tokenEstimate: memoryCard.tokenEstimate,
      }],
      constraints: ['No secrets in cloud context'],
      risks: [],
      allowedTools: ['read', 'search'],
      forbiddenActions: ['send-secrets-to-cloud'],
      privacyMode: 'hybrid',
      riskClass: 'B',
      tokenBudget: 4000,
      tokenEstimate: 800,
      redacted: true,
      createdAt: knowledgeItem.createdAt,
    }

    expect(contextPackage.references[0]?.id).toBe(memoryCard.id)
    expect(contextPackage.tokenEstimate).toBeLessThan(contextPackage.tokenBudget)
    expect(contextPackage.redacted).toBe(true)
  })
})

describe('agent and model routing models', () => {
  it('routes local summarization work to a local model profile', () => {
    const agent: AgentProfile = {
      id: 'agent-local-ai',
      displayName: 'Local AI Worker',
      role: 'local-ai-worker',
      availability: 'available',
      autonomyLevel: 'propose-only',
      strengths: ['embeddings', 'summaries', 'classification'],
      limits: ['complex architecture decisions'],
      preferredWorkloads: ['embedding', 'summarization', 'context-compression'],
      allowedToolIds: ['ollama.generate', 'ollama.embed'],
      skillRefs: [{
        id: 'skill-model-route',
        title: 'Model Route',
        path: 'Agent_Skills/skill-model-route.md',
      }],
      costClass: 'free-local',
      defaultModelProfileId: 'ollama-llama32',
      updatedAt: '2026-05-17T10:00:00Z',
    }

    const model: ModelProfile = {
      id: 'ollama-llama32',
      provider: 'ollama',
      modelName: 'llama3.2:3b',
      executionMode: 'local',
      strengths: ['fast local summaries'],
      weaknesses: ['limited deep reasoning'],
      recommendedWorkloads: ['summarization', 'classification'],
      privacyModes: ['local-only', 'hybrid'],
      costClass: 'free-local',
      healthStatus: 'healthy',
      localEndpoint: 'http://localhost:11434',
      updatedAt: agent.updatedAt,
    }

    const decision: RoutingDecision = {
      id: 'route1',
      taskId: 'JOK-144',
      selectedModelProfileId: model.id,
      selectedProvider: model.provider,
      selectedModel: model.modelName,
      workload: 'summarization',
      reason: 'Local model is sufficient for short context compression.',
      privacyMode: 'hybrid',
      requiresApproval: false,
      fallbackModelProfileId: 'codex-cloud',
      createdAt: agent.updatedAt,
    }

    expect(agent.defaultModelProfileId).toBe(model.id)
    expect(decision.selectedProvider).toBe('ollama')
    expect(decision.requiresApproval).toBe(false)
  })
})
