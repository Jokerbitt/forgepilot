import { describe, it, expect } from 'vitest'
import { listSnapshots, createSnapshot, restoreSnapshot, type GitRunner } from './snapshot'

/** Records every git invocation and returns scripted outputs. */
function fakeGit(outputs: Record<string, string> = {}): { git: GitRunner; calls: string[][] } {
  const calls: string[][] = []
  const git: GitRunner = {
    run(_repo, args) {
      calls.push(args)
      const key = args.join(' ')
      for (const [match, out] of Object.entries(outputs)) {
        if (key.startsWith(match)) return out
      }
      return ''
    },
  }
  return { git, calls }
}

describe('listSnapshots', () => {
  it('parses tab-separated tag output', () => {
    const { git } = fakeGit({ 'tag -l fp-snap-*': 'fp-snap-2\tNach Login\t2026-06-20 10:00:00 +0000\nfp-snap-1\tStart\t2026-06-19 09:00:00 +0000' })
    const snaps = listSnapshots('/repo', git)
    expect(snaps).toHaveLength(2)
    expect(snaps[0]).toMatchObject({ ref: 'fp-snap-2', label: 'Nach Login' })
  })
  it('returns [] when there are no tags', () => {
    const { git } = fakeGit()
    expect(listSnapshots('/repo', git)).toEqual([])
  })
})

describe('createSnapshot', () => {
  it('adds, commits and tags with the next number', () => {
    const { git, calls } = fakeGit({ 'tag -l fp-snap-*': 'fp-snap-1\tStart\t2026-06-19 09:00:00 +0000' })
    const snap = createSnapshot('/repo', 'Nach Login', git)
    expect(snap.ref).toBe('fp-snap-2')
    expect(calls.some(c => c[0] === 'add' && c[1] === '-A')).toBe(true)
    expect(calls.some(c => c.includes('commit'))).toBe(true)
    expect(calls.some(c => c.includes('tag') && c.includes('fp-snap-2'))).toBe(true)
  })
  it('starts at fp-snap-1 for a fresh repo', () => {
    const { git } = fakeGit()
    expect(createSnapshot('/repo', 'Start', git).ref).toBe('fp-snap-1')
  })
})

describe('restoreSnapshot', () => {
  it('auto-backs-up then non-destructively checks out the target (no reset --hard)', () => {
    const { git, calls } = fakeGit()
    const res = restoreSnapshot('/repo', 'fp-snap-1', git)
    expect(res.restored).toBe('fp-snap-1')
    expect(res.backup.ref).toMatch(/^fp-snap-/)
    // checkout into working tree, never a hard reset
    expect(calls.some(c => c[0] === 'checkout' && c.includes('fp-snap-1'))).toBe(true)
    expect(calls.some(c => c.join(' ').includes('reset --hard'))).toBe(false)
  })
  it('rejects a non-snapshot ref', () => {
    const { git } = fakeGit()
    expect(() => restoreSnapshot('/repo', 'main', git)).toThrow()
  })
})
