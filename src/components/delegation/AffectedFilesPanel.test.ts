import { describe, it, expect } from 'vitest'
import { extractFilesFromLogs } from './AffectedFilesPanel'
import type { AgentLog } from '@/lib/models/delegation'

function makeLog(message: string, type: AgentLog['type'] = 'command'): AgentLog {
  return { message, type, timestamp: new Date().toISOString() }
}

describe('extractFilesFromLogs', () => {
  it('returns empty array for empty logs', () => {
    expect(extractFilesFromLogs([])).toEqual([])
  })

  it('extracts write_file as added', () => {
    const result = extractFilesFromLogs([makeLog('write_file: src/components/Todo.tsx')])
    expect(result).toHaveLength(1)
    expect(result[0].path).toBe('src/components/Todo.tsx')
    expect(result[0].kind).toBe('added')
  })

  it('extracts edit_file as modified', () => {
    const result = extractFilesFromLogs([makeLog('edit_file: src/app/page.tsx updated')])
    expect(result).toHaveLength(1)
    expect(result[0].kind).toBe('modified')
  })

  it('extracts delete_file as deleted', () => {
    const result = extractFilesFromLogs([makeLog('delete_file: src/old/legacy.ts')])
    expect(result).toHaveLength(1)
    expect(result[0].kind).toBe('deleted')
  })

  it('deduplicates paths across multiple logs', () => {
    const logs = [
      makeLog('write_file: src/foo.ts'),
      makeLog('write_file: src/foo.ts'),
    ]
    const result = extractFilesFromLogs(logs)
    expect(result).toHaveLength(1)
  })

  it('extracts multiple different files', () => {
    const logs = [
      makeLog('write_file: src/a.ts'),
      makeLog('edit_file: src/b.tsx'),
      makeLog('delete_file: src/old.ts'),
    ]
    const result = extractFilesFromLogs(logs)
    expect(result).toHaveLength(3)
  })

  it('strips trailing punctuation from path', () => {
    const result = extractFilesFromLogs([makeLog('write_file: src/foo.ts,')])
    expect(result[0].path).toBe('src/foo.ts')
  })

  it('handles Created variant', () => {
    const result = extractFilesFromLogs([makeLog('Created src/components/Button.tsx successfully')])
    expect(result[0].kind).toBe('added')
    expect(result[0].path).toContain('Button.tsx')
  })

  it('ignores logs with no file extensions', () => {
    const result = extractFilesFromLogs([makeLog('Running npm test')])
    expect(result).toHaveLength(0)
  })

  it('ignores thought logs with no file commands', () => {
    const result = extractFilesFromLogs([makeLog('I should think about the architecture', 'thought')])
    expect(result).toHaveLength(0)
  })

  it('preserves insertion order', () => {
    const logs = [
      makeLog('write_file: src/first.ts'),
      makeLog('edit_file: src/second.ts'),
    ]
    const result = extractFilesFromLogs(logs)
    expect(result[0].path).toBe('src/first.ts')
    expect(result[1].path).toBe('src/second.ts')
  })
})
