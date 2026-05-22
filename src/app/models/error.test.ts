import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  createErrorInfo,
  storeErrorInfo,
  recordErrorInfo,
  listErrorInfo,
  getErrorInfo,
  _clearErrorStore,
} from './error'

let tmpFile: string

beforeEach(() => {
  tmpFile = path.join(os.tmpdir(), `err-${Date.now()}-${Math.random().toString(36).slice(2)}.json`)
})

afterEach(() => {
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile)
})

describe('createErrorInfo', () => {
  it('produces an id, ISO timestamp and default severity/source', () => {
    const e = createErrorInfo({ message: 'boom' })
    expect(e.id).toMatch(/^err-/)
    expect(e.occurredAt).toMatch(/T.+Z$/)
    expect(e.severity).toBe('medium')
    expect(e.source).toBe('unknown')
    expect(e.message).toBe('boom')
  })

  it('honors explicit severity, source and context', () => {
    const e = createErrorInfo({
      message: 'agent crashed',
      severity: 'high',
      source: 'agent',
      relatedId: 'agent-run-42',
      context: { model: 'claude-opus-4-7', retries: 2 },
    })
    expect(e.severity).toBe('high')
    expect(e.source).toBe('agent')
    expect(e.relatedId).toBe('agent-run-42')
    expect(e.context).toEqual({ model: 'claude-opus-4-7', retries: 2 })
  })

  it('omits optional fields when not provided', () => {
    const e = createErrorInfo({ message: 'plain' })
    expect(e.stack).toBeUndefined()
    expect(e.relatedId).toBeUndefined()
    expect(e.context).toBeUndefined()
  })
})

describe('storeErrorInfo', () => {
  it('persists an error and returns it', () => {
    const e = storeErrorInfo(createErrorInfo({ message: 'persisted' }), tmpFile)
    expect(fs.existsSync(tmpFile)).toBe(true)
    const persisted = listErrorInfo({}, tmpFile)
    expect(persisted).toHaveLength(1)
    expect(persisted[0].id).toBe(e.id)
    expect(persisted[0].message).toBe('persisted')
  })

  it('inserts newest-first', () => {
    storeErrorInfo(createErrorInfo({ message: 'first' }), tmpFile)
    storeErrorInfo(createErrorInfo({ message: 'second' }), tmpFile)
    const errors = listErrorInfo({}, tmpFile)
    expect(errors[0].message).toBe('second')
    expect(errors[1].message).toBe('first')
  })

  it('trims to MAX_ERRORS (500) entries — older ones drop off', () => {
    for (let i = 0; i < 510; i++) {
      storeErrorInfo(createErrorInfo({ message: `e-${i}` }), tmpFile)
    }
    const errors = listErrorInfo({}, tmpFile)
    expect(errors).toHaveLength(500)
    expect(errors[0].message).toBe('e-509')
    expect(errors[499].message).toBe('e-10')
  })
})

describe('recordErrorInfo', () => {
  it('builds and persists in one call', () => {
    const e = recordErrorInfo({ message: 'one-shot', severity: 'critical' }, tmpFile)
    expect(e.severity).toBe('critical')
    expect(getErrorInfo(e.id, tmpFile)?.message).toBe('one-shot')
  })
})

describe('listErrorInfo — filtering', () => {
  beforeEach(() => {
    recordErrorInfo({ message: 'a', source: 'agent', severity: 'high' }, tmpFile)
    recordErrorInfo({ message: 'b', source: 'agent', severity: 'low' }, tmpFile)
    recordErrorInfo({ message: 'c', source: 'delegation', severity: 'medium' }, tmpFile)
    recordErrorInfo({ message: 'd', source: 'webhook', severity: 'critical' }, tmpFile)
  })

  it('filters by source', () => {
    const agent = listErrorInfo({ source: 'agent' }, tmpFile)
    expect(agent).toHaveLength(2)
    expect(agent.every(e => e.source === 'agent')).toBe(true)
  })

  it('filters by severity', () => {
    const critical = listErrorInfo({ severity: 'critical' }, tmpFile)
    expect(critical).toHaveLength(1)
    expect(critical[0].message).toBe('d')
  })

  it('respects limit', () => {
    expect(listErrorInfo({ limit: 2 }, tmpFile)).toHaveLength(2)
  })

  it('filters by resolved flag', () => {
    const all = listErrorInfo({}, tmpFile)
    const target = all[0]
    storeErrorInfo({ ...target, resolved: true }, tmpFile)
    const open = listErrorInfo({ resolved: false }, tmpFile)
    expect(open.every(e => !(e.resolved ?? false))).toBe(true)
  })
})

describe('getErrorInfo', () => {
  it('returns the error by id', () => {
    const e = recordErrorInfo({ message: 'lookup' }, tmpFile)
    expect(getErrorInfo(e.id, tmpFile)?.message).toBe('lookup')
  })

  it('returns null for unknown id', () => {
    expect(getErrorInfo('does-not-exist', tmpFile)).toBeNull()
  })
})

describe('store recovery', () => {
  it('returns empty when the file is missing', () => {
    expect(listErrorInfo({}, '/nonexistent/path/err.json')).toEqual([])
  })

  it('returns empty when the file is malformed JSON', () => {
    fs.writeFileSync(tmpFile, '{not-json', 'utf-8')
    expect(listErrorInfo({}, tmpFile)).toEqual([])
  })
})

describe('_clearErrorStore', () => {
  it('removes all stored errors', () => {
    recordErrorInfo({ message: 'will be gone' }, tmpFile)
    _clearErrorStore(tmpFile)
    expect(listErrorInfo({}, tmpFile)).toEqual([])
  })
})
