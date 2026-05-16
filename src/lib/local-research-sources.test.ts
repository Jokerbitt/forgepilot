import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { collectLocalResearchSources, getDefaultLocalResearchRoots } from './local-research-sources'

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
  }
})

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgepilot-local-sources-'))
  tempDirs.push(dir)
  return dir
}

describe('getDefaultLocalResearchRoots', () => {
  it('uses explicit semicolon-separated local research paths first', () => {
    expect(getDefaultLocalResearchRoots({ FORGEPILOT_LOCAL_RESEARCH_PATHS: 'A:\\One;B:\\Two' })).toEqual([
      'A:\\One',
      'B:\\Two',
    ])
  })

  it('falls back to known NAS and vault variables', () => {
    const roots = getDefaultLocalResearchRoots({ SECOND_BRAIN_PATH: 'Z:\\Vault' })
    expect(roots).toContain('Z:\\Vault')
    expect(roots).toContain('Z:\\NAS\\SecondBrain')
  })
})

describe('collectLocalResearchSources', () => {
  it('returns ranked SourceRecords with snippets for matching local files', () => {
    const root = makeTempDir()
    fs.writeFileSync(path.join(root, 'match.md'), [
      '# ForgePilot',
      'ForgePilot nutzt ProjectBrief und ResearchRun fuer lokale Quellen.',
      'Das SecondBrain dient als Wissensbasis.',
    ].join('\n'))
    fs.writeFileSync(path.join(root, 'miss.md'), 'Ein anderer Text ohne relevante Begriffe.')

    const sources = collectLocalResearchSources({
      runId: 'run-1',
      roots: [root],
      searchTerms: ['ForgePilot', 'ResearchRun'],
      retrievedAt: '2026-05-16T10:00:00.000Z',
    })

    expect(sources).toHaveLength(1)
    expect(sources[0].id).toBe('run-1-local-source-1')
    expect(sources[0].title).toBe('match.md')
    expect(sources[0].snippets.length).toBeGreaterThan(0)
    expect(sources[0].relevanceScore).toBeGreaterThan(50)
  })

  it('returns an empty list when no root exists or no terms are useful', () => {
    expect(collectLocalResearchSources({ runId: 'run-2', roots: ['X:\\missing'], searchTerms: ['ForgePilot'] })).toEqual([])
    expect(collectLocalResearchSources({ runId: 'run-3', roots: [makeTempDir()], searchTerms: ['AI'] })).toEqual([])
  })
})
