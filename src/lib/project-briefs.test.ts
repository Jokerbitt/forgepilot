import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildResearchBriefFromProjectBrief,
  buildResearchRunPoc,
  buildProjectBrief,
  findProjectBriefById,
  readProjectBriefs,
  saveProjectBrief,
  splitConstraintLines,
  validateIdeaIntakeInput,
} from './project-briefs'
import type { IdeaIntakeInput } from './models/project-brief'

const tmpFiles: string[] = []

afterEach(() => {
  for (const file of tmpFiles.splice(0)) {
    if (fs.existsSync(file)) fs.unlinkSync(file)
  }
})

const validInput: IdeaIntakeInput = {
  title: 'Research-to-Blueprint Pipeline',
  rawIdea: 'ForgePilot soll aus einer Idee zuerst eine belastbare Recherche und danach einen Projektbrief erzeugen.',
  problemStatement: 'Projektideen starten heute ohne genug Kontext und belastbare Quellen.',
  targetAudience: 'KI-first Solo-Developer',
  desiredOutcome: 'Aus einer Idee entsteht ein prüfbarer ProjectBrief mit ersten Anforderungen.',
  constraints: ['local-first nutzbar', 'keine Web-Recherche im lokalen Modus'],
  scope: 'standard',
  researchMode: 'standard',
  privacyMode: 'local',
}

describe('validateIdeaIntakeInput', () => {
  it('accepts a complete idea intake payload', () => {
    expect(validateIdeaIntakeInput(validInput)).toEqual({})
  })

  it('returns field-level errors for weak ideas', () => {
    const errors = validateIdeaIntakeInput({
      ...validInput,
      title: '',
      rawIdea: 'zu kurz',
      problemStatement: '',
      desiredOutcome: '',
    })

    expect(errors.title).toBeDefined()
    expect(errors.rawIdea).toBeDefined()
    expect(errors.problemStatement).toBeDefined()
    expect(errors.desiredOutcome).toBeDefined()
  })
})

describe('buildProjectBrief', () => {
  it('creates an in-review project brief with a research brief draft', () => {
    const brief = buildProjectBrief(validInput, new Date('2026-05-16T10:00:00.000Z'), 'brief-1')

    expect(brief.id).toBe('brief-1')
    expect(brief.status).toBe('in_review')
    expect(brief.planningMode).toBe('beginner')
    expect(brief.requirements).toHaveLength(3)
    expect(brief.researchBriefDraft.preferredExecutor).toBe('agent')
    expect(brief.researchBriefDraft.preferredSourceTypes).toEqual(['obsidian', 'nas', 'docs', 'pdf'])
  })

  it('uses web-capable sources outside local privacy mode', () => {
    const brief = buildProjectBrief({ ...validInput, privacyMode: 'hybrid' }, new Date('2026-05-16T10:00:00.000Z'), 'brief-2')

    expect(brief.researchBriefDraft.preferredSourceTypes).toContain('web')
    expect(brief.researchBriefDraft.preferredSourceTypes).toContain('github')
  })

  it('keeps explicit expert architecture choices on the brief', () => {
    const brief = buildProjectBrief({
      ...validInput,
      planningMode: 'expert',
      targetPlatform: 'desktop',
      persistenceStrategy: 'sqlite',
    }, new Date('2026-05-16T10:00:00.000Z'), 'brief-expert')

    expect(brief.planningMode).toBe('expert')
    expect(brief.targetPlatform).toBe('desktop')
    expect(brief.persistenceStrategy).toBe('sqlite')
    expect(brief.platformGuidance).toContain('Desktop App')
    expect(brief.persistenceGuidance).toContain('SQLite')
  })
})

describe('buildResearchBriefFromProjectBrief', () => {
  it('creates an agent-ready research brief with strict POC outputs', () => {
    const projectBrief = buildProjectBrief(validInput, new Date('2026-05-16T10:00:00.000Z'), 'brief-4')
    const researchBrief = buildResearchBriefFromProjectBrief(projectBrief, new Date('2026-05-16T10:05:00.000Z'))

    expect(researchBrief.status).toBe('ready')
    expect(researchBrief.preferredExecutor).toBe('agent')
    expect(researchBrief.outputSchema.requiredOutputs).toEqual(['findings_summary', 'project_brief', 'requirements'])
    expect(researchBrief.outputSchema.optionalOutputs).toEqual(['use_cases'])
    expect(researchBrief.outputSchema.qualityGates).toContain('Keine Writebacks ohne Nutzerfreigabe.')
  })

  it('sets zero budget for local research mode', () => {
    const projectBrief = buildProjectBrief(validInput, new Date('2026-05-16T10:00:00.000Z'), 'brief-5')
    const researchBrief = buildResearchBriefFromProjectBrief(projectBrief)

    expect(researchBrief.maxBudgetUsd).toBe(0)
    expect(researchBrief.preferredSourceTypes).toEqual(['obsidian', 'nas', 'docs', 'pdf'])
  })
})

describe('buildResearchRunPoc', () => {
  it('creates a review-pending run with sources, findings and POC outputs', () => {
    const projectBrief = buildProjectBrief(validInput, new Date('2026-05-16T10:00:00.000Z'), 'brief-6')
    const researchBrief = buildResearchBriefFromProjectBrief(projectBrief, new Date('2026-05-16T10:05:00.000Z'))
    const run = buildResearchRunPoc(projectBrief, researchBrief, new Date('2026-05-16T10:10:00.000Z'), 'run-1')

    expect(run.status).toBe('review_pending')
    expect(run.sources).toHaveLength(1)
    expect(run.findings.length).toBeGreaterThanOrEqual(3)
    expect(run.outputs.map(output => output.type)).toEqual(['findings_summary', 'project_brief', 'requirements'])
    expect(run.findings.every(finding => finding.sourceIds.length > 0)).toBe(true)
    expect(run.actualCostUsd).toBe(0)
  })

  it('keeps open uncertainties explicit for unvalidated findings', () => {
    const projectBrief = buildProjectBrief(validInput, new Date('2026-05-16T10:00:00.000Z'), 'brief-7')
    const run = buildResearchRunPoc(projectBrief)

    expect(run.openUncertainties.length).toBeGreaterThan(0)
    expect(run.confidenceScore).toBeGreaterThan(0)
  })
})

describe('project brief persistence helpers', () => {
  it('saves and reads project briefs from a JSON file', () => {
    const file = path.join(os.tmpdir(), `forgepilot-project-briefs-${Date.now()}.json`)
    tmpFiles.push(file)

    const brief = buildProjectBrief(validInput, new Date('2026-05-16T10:00:00.000Z'), 'brief-3')
    saveProjectBrief(brief, file)

    expect(readProjectBriefs(file)).toHaveLength(1)
    expect(readProjectBriefs(file)[0].title).toBe(validInput.title)
    expect(findProjectBriefById('brief-3', file)?.id).toBe('brief-3')
  })
})

describe('splitConstraintLines', () => {
  it('splits newline and comma separated constraints', () => {
    expect(splitConstraintLines('local-first\nNAS speichern, Quellen verlinken')).toEqual([
      'local-first',
      'NAS speichern',
      'Quellen verlinken',
    ])
  })
})
