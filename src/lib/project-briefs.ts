import fs from 'fs'
import path from 'path'
import type {
  BriefScope,
  IdeaIntakeInput,
  IdeaIntakeValidationErrors,
  Finding,
  ProjectBrief,
  ResearchRun,
  ResearchBrief,
  ResearchMode,
  ResearchPrivacyMode,
  SourceRecord,
} from '@/lib/models/project-brief'
import { persistencePromptGuidance, platformPromptGuidance } from '@/lib/project-planning-recommendations'

const PROJECT_BRIEFS_FILE = path.join(process.cwd(), 'config', 'project-briefs.json')

const BRIEF_SCOPES: BriefScope[] = ['minimal', 'standard', 'full']
const RESEARCH_MODES: ResearchMode[] = ['quick', 'standard', 'deep']
const PRIVACY_MODES: ResearchPrivacyMode[] = ['local', 'hybrid', 'cloud']

export const PROJECT_BRIEF_LIMITS = {
  titleMax: 120,
  rawIdeaMax: 2000,
  fieldMax: 800,
  constraintMax: 140,
  maxConstraints: 8,
}

export function splitConstraintLines(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, PROJECT_BRIEF_LIMITS.maxConstraints)
}

export function validateIdeaIntakeInput(input: IdeaIntakeInput): IdeaIntakeValidationErrors {
  const errors: IdeaIntakeValidationErrors = {}

  if (input.title.trim().length < 3) errors.title = 'Bitte gib einen klaren Projektnamen ein.'
  if (input.title.length > PROJECT_BRIEF_LIMITS.titleMax) errors.title = `Maximal ${PROJECT_BRIEF_LIMITS.titleMax} Zeichen.`
  if (input.rawIdea.trim().length < 20) errors.rawIdea = 'Beschreibe die Idee etwas ausführlicher.'
  if (input.rawIdea.length > PROJECT_BRIEF_LIMITS.rawIdeaMax) errors.rawIdea = `Maximal ${PROJECT_BRIEF_LIMITS.rawIdeaMax} Zeichen.`
  if (input.problemStatement.trim().length < 10) errors.problemStatement = 'Welches konkrete Problem soll gelöst werden?'
  if (input.targetAudience.trim().length < 3) errors.targetAudience = 'Für wen ist das gedacht?'
  if (input.desiredOutcome.trim().length < 10) errors.desiredOutcome = 'Beschreibe den gewünschten Zielzustand.'
  if (!BRIEF_SCOPES.includes(input.scope)) errors.scope = 'Ungültiger Scope.'
  if (!RESEARCH_MODES.includes(input.researchMode)) errors.researchMode = 'Ungültige Recherche-Tiefe.'
  if (!PRIVACY_MODES.includes(input.privacyMode)) errors.privacyMode = 'Ungültiger Datenschutzmodus.'

  input.constraints.some((constraint, index) => {
    if (constraint.length > PROJECT_BRIEF_LIMITS.constraintMax) {
      errors.constraints = `Constraint ${index + 1} ist zu lang.`
      return true
    }
    return false
  })

  return errors
}

export function hasIdeaIntakeErrors(errors: IdeaIntakeValidationErrors): boolean {
  return Object.keys(errors).length > 0
}

export function buildProjectBrief(input: IdeaIntakeInput, now = new Date(), id = crypto.randomUUID()): ProjectBrief {
  const createdAt = now.toISOString()
  const searchTerms = deriveSearchTerms(input)

  return {
    id,
    title: input.title.trim(),
    status: 'in_review',
    createdAt,
    updatedAt: createdAt,
    rawIdea: input.rawIdea.trim(),
    problemStatement: input.problemStatement.trim(),
    targetAudience: input.targetAudience.trim(),
    desiredOutcome: input.desiredOutcome.trim(),
    planningMode: input.planningMode ?? 'beginner',
    targetPlatform: input.targetPlatform ?? 'undecided',
    customPlatformNote: input.customPlatformNote?.trim() || undefined,
    platformGuidance: platformPromptGuidance(input.targetPlatform ?? 'undecided', input.customPlatformNote),
    persistenceStrategy: input.persistenceStrategy ?? 'recommend',
    persistenceGuidance: persistencePromptGuidance(input.persistenceStrategy ?? 'recommend'),
    constraints: input.constraints.map(item => item.trim()).filter(Boolean),
    scope: input.scope,
    researchMode: input.researchMode,
    privacyMode: input.privacyMode,
    requirements: buildInitialRequirements(input, id),
    useCases: [],
    nonGoals: [],
    risks: buildInitialRisks(input, id),
    researchRunIds: [],
    researchBriefDraft: {
      title: `Research Brief: ${input.title.trim()}`,
      mode: input.researchMode,
      privacyMode: input.privacyMode,
      preferredExecutor: 'agent',
      researchQuestions: [
        `Welche bestehenden Lösungen oder Ansätze adressieren "${input.problemStatement.trim()}"?`,
        `Welche Anforderungen ergeben sich für "${input.targetAudience.trim()}"?`,
        `Welche Risiken und offenen Annahmen müssen vor der Umsetzung geklärt werden?`,
      ],
      searchTerms,
      preferredSourceTypes: input.privacyMode === 'local'
        ? ['obsidian', 'nas', 'docs', 'pdf']
        : ['web', 'github', 'docs', 'vendor_docs', 'blog'],
      excludeCriteria: [
        'Quellen ohne klaren Bezug zur Problemstellung',
        'Unbelegte Marketing-Aussagen ohne überprüfbare Fakten',
      ],
    },
  }
}

export function buildResearchBriefFromProjectBrief(
  brief: ProjectBrief,
  now = new Date(),
  id = `${brief.id}-research-brief`
): ResearchBrief {
  return {
    id,
    briefId: brief.id,
    title: brief.researchBriefDraft.title,
    status: 'ready',
    createdAt: now.toISOString(),
    researchQuestions: brief.researchBriefDraft.researchQuestions,
    searchTerms: brief.researchBriefDraft.searchTerms,
    preferredSourceTypes: brief.researchBriefDraft.preferredSourceTypes,
    excludeCriteria: brief.researchBriefDraft.excludeCriteria,
    mode: brief.researchBriefDraft.mode,
    privacyMode: brief.researchBriefDraft.privacyMode,
    maxBudgetUsd: budgetForMode(brief.researchBriefDraft.mode, brief.researchBriefDraft.privacyMode),
    maxDurationMinutes: durationForMode(brief.researchBriefDraft.mode),
    preferredExecutor: brief.researchBriefDraft.preferredExecutor,
    outputSchema: {
      requiredOutputs: ['findings_summary', 'project_brief', 'requirements'],
      optionalOutputs: ['use_cases'],
      evidenceRules: [
        'Jedes Finding muss mindestens eine Quelle referenzieren.',
        'Jede Quelle braucht URL oder lokalen Dateipfad und Abrufdatum.',
        'Unklare oder widerspruechliche Aussagen werden als offene Annahme markiert.',
        'Local Mode nutzt nur NAS, Obsidian, lokale Dateien und lokale Modelle.',
      ],
      qualityGates: [
        'Research Brief vor Ausfuehrung pruefen.',
        'Findings vor ProjectBrief-Update reviewen.',
        'Keine Writebacks ohne Nutzerfreigabe.',
      ],
      writebackTargets: ['nas', 'obsidian'],
    },
  }
}

export function buildResearchRunPoc(
  brief: ProjectBrief,
  researchBrief = buildResearchBriefFromProjectBrief(brief),
  now = new Date(),
  id = `${brief.id}-research-run-poc`
): ResearchRun {
  const startedAt = now.toISOString()
  const source: SourceRecord = {
    id: `${id}-source-brief`,
    runId: id,
    type: 'nas',
    title: `ProjectBrief: ${brief.title}`,
    urlOrPath: `project-brief://${brief.id}`,
    publisher: 'ForgePilot',
    retrievedAt: startedAt,
    language: 'de',
    relevanceScore: 100,
    trustScore: 75,
    notes: 'POC-Quelle: Der gespeicherte ProjectBrief wird als interne Quelle genutzt.',
    snippets: [
      brief.rawIdea,
      brief.problemStatement,
      brief.targetAudience,
      brief.desiredOutcome,
      ...brief.constraints,
    ].filter(Boolean),
  }

  const findings = buildPocFindings(brief, id, source.id)
  const outputs = [
    {
      id: `${id}-output-findings`,
      runId: id,
      briefId: brief.id,
      type: 'findings_summary' as const,
      title: 'Findings Summary',
      content: renderFindingsSummary(findings),
      linkedFindingIds: findings.map(finding => finding.id),
      linkedRequirementIds: [],
      status: 'review_pending' as const,
    },
    {
      id: `${id}-output-project-brief`,
      runId: id,
      briefId: brief.id,
      type: 'project_brief' as const,
      title: 'Projektsteckbrief Entwurf',
      content: renderProjectBriefDraft(brief, findings),
      linkedFindingIds: findings.map(finding => finding.id),
      linkedRequirementIds: brief.requirements.map(requirement => requirement.id),
      status: 'review_pending' as const,
    },
    {
      id: `${id}-output-requirements`,
      runId: id,
      briefId: brief.id,
      type: 'requirements' as const,
      title: 'Requirements Entwurf',
      content: renderRequirementsDraft(brief),
      linkedFindingIds: findings.map(finding => finding.id),
      linkedRequirementIds: brief.requirements.map(requirement => requirement.id),
      status: 'review_pending' as const,
    },
  ]

  return {
    id,
    researchBriefId: researchBrief.id,
    briefId: brief.id,
    title: `ResearchRun POC: ${brief.title}`,
    status: 'review_pending',
    mode: researchBrief.mode,
    privacyMode: researchBrief.privacyMode,
    executor: researchBrief.preferredExecutor,
    startedAt,
    completedAt: startedAt,
    budgetUsd: researchBrief.maxBudgetUsd,
    actualCostUsd: 0,
    sources: [source],
    findings,
    outputs,
    confidenceScore: calculateConfidenceScore(findings),
    openUncertainties: findings
      .filter(finding => finding.isOpenAssumption)
      .map(finding => finding.claim),
  }
}

export function readProjectBriefs(filePath = PROJECT_BRIEFS_FILE): ProjectBrief[] {
  try {
    const data = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(data)
    return Array.isArray(parsed) ? parsed as ProjectBrief[] : []
  } catch {
    return []
  }
}

export function findProjectBriefById(id: string, filePath = PROJECT_BRIEFS_FILE): ProjectBrief | undefined {
  return readProjectBriefs(filePath).find(brief => brief.id === id)
}

export function writeProjectBriefs(briefs: ProjectBrief[], filePath = PROJECT_BRIEFS_FILE): void {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(briefs, null, 2), 'utf-8')
}

export function readProjectBriefById(id: string, filePath = PROJECT_BRIEFS_FILE): ProjectBrief | null {
  return readProjectBriefs(filePath).find(b => b.id === id) ?? null
}

export function updateProjectBrief(
  id: string,
  patch: Partial<Omit<ProjectBrief, 'id' | 'createdAt'>>,
  filePath = PROJECT_BRIEFS_FILE,
): ProjectBrief | null {
  const briefs = readProjectBriefs(filePath)
  const index = briefs.findIndex(b => b.id === id)
  if (index < 0) return null
  briefs[index] = { ...briefs[index], ...patch, id, createdAt: briefs[index].createdAt, updatedAt: new Date().toISOString() }
  writeProjectBriefs(briefs, filePath)
  return briefs[index]
}

export function saveProjectBrief(brief: ProjectBrief, filePath = PROJECT_BRIEFS_FILE): ProjectBrief {
  const briefs = readProjectBriefs(filePath)
  const index = briefs.findIndex(item => item.id === brief.id)
  if (index >= 0) {
    briefs[index] = { ...brief, updatedAt: new Date().toISOString() }
  } else {
    briefs.unshift(brief)
  }
  writeProjectBriefs(briefs, filePath)
  return index >= 0 ? briefs[index] : brief
}

function deriveSearchTerms(input: IdeaIntakeInput): string[] {
  const words = [
    ...input.title.split(/\s+/),
    ...input.problemStatement.split(/\s+/),
    ...input.targetAudience.split(/\s+/),
  ]
    .map(word => word.replace(/[^A-Za-z0-9ÄÖÜäöüß-]/g, '').trim())
    .filter(word => word.length >= 4)

  return Array.from(new Set(words)).slice(0, 8)
}

function buildInitialRequirements(input: IdeaIntakeInput, briefId: string) {
  return [
    {
      id: `${briefId}-req-outcome`,
      briefId,
      type: 'functional' as const,
      title: 'Zielzustand erreichen',
      description: input.desiredOutcome.trim(),
      priority: 'must' as const,
      source: 'user_input' as const,
      findingIds: [],
      status: 'proposed' as const,
    },
    ...input.constraints.map((constraint, index) => ({
      id: `${briefId}-req-constraint-${index + 1}`,
      briefId,
      type: 'constraint' as const,
      title: `Constraint ${index + 1}`,
      description: constraint,
      priority: 'should' as const,
      source: 'user_input' as const,
      findingIds: [],
      status: 'proposed' as const,
    })),
  ]
}

function buildInitialRisks(input: IdeaIntakeInput, briefId: string) {
  return [
    {
      id: `${briefId}-risk-assumptions`,
      briefId,
      title: 'Ungeprüfte Annahmen',
      description: `Die Idee basiert aktuell auf Nutzerannahmen und sollte vor Umsetzung mit ${input.researchMode === 'quick' ? 'einer kurzen' : 'einer strukturierten'} Recherche validiert werden.`,
      probability: 'medium' as const,
      impact: input.scope === 'full' ? 'high' as const : 'medium' as const,
      mitigationIdea: 'Research Brief ausführen und Findings mit Quellen prüfen.',
      isOpenAssumption: true,
      findingIds: [],
    },
  ]
}

function buildPocFindings(brief: ProjectBrief, runId: string, sourceId: string): Finding[] {
  const base = [
    {
      id: `${runId}-finding-problem`,
      runId,
      claim: `Das Kernproblem ist: ${brief.problemStatement}`,
      summary: `Der ProjectBrief beschreibt als Ausgangspunkt ein konkretes Problem fuer ${brief.targetAudience}. Dieses Finding ist direkt aus dem Nutzerkontext abgeleitet und muss spaeter mit externen oder internen Quellen validiert werden.`,
      sourceIds: [sourceId],
      confidence: 'medium' as const,
      isContradicted: false,
      contradictionIds: [],
      isOpenAssumption: true,
      recommendationImpact: 'high' as const,
      tags: ['problem', 'scope'],
    },
    {
      id: `${runId}-finding-outcome`,
      runId,
      claim: `Der gewuenschte Zielzustand ist: ${brief.desiredOutcome}`,
      summary: 'Der Zielzustand kann als Grundlage fuer Must-have-Requirements genutzt werden.',
      sourceIds: [sourceId],
      confidence: 'medium' as const,
      isContradicted: false,
      contradictionIds: [],
      isOpenAssumption: false,
      recommendationImpact: 'high' as const,
      tags: ['outcome', 'requirements'],
    },
    {
      id: `${runId}-finding-audience`,
      runId,
      claim: `Die primaere Zielgruppe ist: ${brief.targetAudience}`,
      summary: 'Die Zielgruppe sollte in den naechsten Research-Schritten mit konkreten Jobs-to-be-done und Nutzenszenarien geschaerft werden.',
      sourceIds: [sourceId],
      confidence: 'medium' as const,
      isContradicted: false,
      contradictionIds: [],
      isOpenAssumption: true,
      recommendationImpact: 'medium' as const,
      tags: ['audience', 'validation'],
    },
  ]

  if (brief.constraints.length === 0) return base

  return [
    ...base,
    {
      id: `${runId}-finding-constraints`,
      runId,
      claim: `Die wichtigsten Constraints sind: ${brief.constraints.join(', ')}`,
      summary: 'Constraints beeinflussen Recherchemodus, Datenschutz, Ausfuehrungsweg und spaetere Architekturentscheidungen.',
      sourceIds: [sourceId],
      confidence: 'high' as const,
      isContradicted: false,
      contradictionIds: [],
      isOpenAssumption: false,
      recommendationImpact: 'critical' as const,
      tags: ['constraints', 'governance'],
    },
  ]
}

function renderFindingsSummary(findings: Finding[]): string {
  return findings
    .map(finding => `- ${finding.claim} (${finding.confidence}, impact: ${finding.recommendationImpact})`)
    .join('\n')
}

function renderProjectBriefDraft(brief: ProjectBrief, findings: Finding[]): string {
  return [
    `# ${brief.title}`,
    '',
    `## Problem`,
    brief.problemStatement,
    '',
    `## Zielgruppe`,
    brief.targetAudience,
    '',
    `## Zielzustand`,
    brief.desiredOutcome,
    '',
    `## Evidence`,
    renderFindingsSummary(findings),
  ].join('\n')
}

function renderRequirementsDraft(brief: ProjectBrief): string {
  return brief.requirements
    .map(requirement => `- [${requirement.priority}] ${requirement.title}: ${requirement.description}`)
    .join('\n')
}

function calculateConfidenceScore(findings: Finding[]): number {
  if (findings.length === 0) return 0
  const scores = findings.map(finding => {
    if (finding.confidence === 'high') return 90
    if (finding.confidence === 'medium') return 65
    if (finding.confidence === 'low') return 40
    return 20
  })
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
}

function budgetForMode(mode: ResearchMode, privacyMode: ResearchPrivacyMode): number {
  if (privacyMode === 'local') return 0
  if (mode === 'quick') return 0.5
  if (mode === 'standard') return 2
  return 5
}

function durationForMode(mode: ResearchMode): number {
  if (mode === 'quick') return 15
  if (mode === 'standard') return 45
  return 120
}
