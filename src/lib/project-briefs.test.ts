import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildProjectBrief,
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
    expect(brief.requirements).toHaveLength(3)
    expect(brief.researchBriefDraft.preferredExecutor).toBe('agent')
    expect(brief.researchBriefDraft.preferredSourceTypes).toEqual(['obsidian', 'nas', 'docs', 'pdf'])
  })

  it('uses web-capable sources outside local privacy mode', () => {
    const brief = buildProjectBrief({ ...validInput, privacyMode: 'hybrid' }, new Date('2026-05-16T10:00:00.000Z'), 'brief-2')

    expect(brief.researchBriefDraft.preferredSourceTypes).toContain('web')
    expect(brief.researchBriefDraft.preferredSourceTypes).toContain('github')
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
