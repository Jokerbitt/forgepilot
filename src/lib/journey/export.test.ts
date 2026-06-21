import { describe, it, expect } from 'vitest'
import { buildRepoArchive, archiveFileName, type ArchiveRunner } from './export'

describe('buildRepoArchive', () => {
  it('returns the archive bytes from the runner', () => {
    const fake: ArchiveRunner = { archive: () => Buffer.from('PKzip') }
    const buf = buildRepoArchive('/repo', fake)
    expect(buf.toString()).toContain('PK')
  })
  it('passes the repo path to the runner', () => {
    let seen = ''
    const fake: ArchiveRunner = { archive: (p) => { seen = p; return Buffer.from('x') } }
    buildRepoArchive('/my/repo', fake)
    expect(seen).toBe('/my/repo')
  })
})

describe('archiveFileName', () => {
  it('builds a slugged, stamped zip name', () => {
    expect(archiveFileName('/Users/me/dev/My App', '20260620')).toBe('my-app-backup-20260620.zip')
  })
})
