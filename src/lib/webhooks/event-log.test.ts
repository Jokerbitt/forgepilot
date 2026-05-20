import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  recordWebhookEvent,
  listWebhookEvents,
  getWebhookEvent,
  getWebhookStats,
  _clearWebhookLog,
} from './event-log'

let tmpFile: string

beforeEach(() => {
  tmpFile = path.join(os.tmpdir(), `whk-${Date.now()}-${Math.random().toString(36).slice(2)}.json`)
})

afterEach(() => {
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile)
})

describe('recordWebhookEvent', () => {
  it('persists an event with id and ISO receivedAt', () => {
    const e = recordWebhookEvent(
      { source: 'linear', status: 'processed', summary: 'JOK-1 created' },
      tmpFile,
    )
    expect(e.id).toMatch(/^whk-/)
    expect(e.receivedAt).toMatch(/T.+Z$/)
    expect(e.method).toBe('POST')

    const persisted = listWebhookEvents({}, tmpFile)
    expect(persisted).toHaveLength(1)
    expect(persisted[0].id).toBe(e.id)
  })

  it('inserts newest-first', () => {
    recordWebhookEvent({ source: 'linear', status: 'processed', summary: 'first' }, tmpFile)
    recordWebhookEvent({ source: 'intake', status: 'processed', summary: 'second' }, tmpFile)
    const events = listWebhookEvents({}, tmpFile)
    expect(events[0].summary).toBe('second')
    expect(events[1].summary).toBe('first')
  })

  it('truncates bodies larger than 64KB', () => {
    const huge = 'x'.repeat(70_000)
    const e = recordWebhookEvent(
      { source: 'github', status: 'processed', summary: 'big', rawBody: huge },
      tmpFile,
    )
    expect(e.rawBody!.length).toBeLessThan(huge.length)
    expect(e.rawBody!).toContain('[truncated')
  })

  it('only keeps allowlisted headers', () => {
    const e = recordWebhookEvent(
      {
        source: 'github',
        status: 'processed',
        summary: 'pr opened',
        headers: {
          'content-type': 'application/json',
          'x-github-event': 'pull_request',
          'authorization': 'Bearer SECRET',
          'cookie': 'session=SECRET',
        },
      },
      tmpFile,
    )
    expect(e.headers).toEqual({
      'content-type': 'application/json',
      'x-github-event': 'pull_request',
    })
    expect(e.headers).not.toHaveProperty('authorization')
    expect(e.headers).not.toHaveProperty('cookie')
  })

  it('omits empty optional fields', () => {
    const e = recordWebhookEvent(
      { source: 'other', status: 'processed', summary: 'plain' },
      tmpFile,
    )
    expect(e.errorMessage).toBeUndefined()
    expect(e.delegationId).toBeUndefined()
    expect(e.rawBody).toBeUndefined()
    expect(e.headers).toBeUndefined()
  })

  it('trims to MAX_EVENTS (500) entries — older ones are dropped', () => {
    for (let i = 0; i < 510; i++) {
      recordWebhookEvent({ source: 'linear', status: 'processed', summary: `e-${i}` }, tmpFile)
    }
    const events = listWebhookEvents({}, tmpFile)
    expect(events).toHaveLength(500)
    expect(events[0].summary).toBe('e-509')
    expect(events[499].summary).toBe('e-10')
  })
})

describe('listWebhookEvents — filtering', () => {
  beforeEach(() => {
    recordWebhookEvent({ source: 'linear', status: 'processed', summary: 'lp' }, tmpFile)
    recordWebhookEvent({ source: 'linear', status: 'ignored', summary: 'li' }, tmpFile)
    recordWebhookEvent({ source: 'intake', status: 'processed', summary: 'ip' }, tmpFile)
    recordWebhookEvent({ source: 'github', status: 'failed', summary: 'gf' }, tmpFile)
  })

  it('filters by source', () => {
    const linear = listWebhookEvents({ source: 'linear' }, tmpFile)
    expect(linear).toHaveLength(2)
    expect(linear.every(e => e.source === 'linear')).toBe(true)
  })

  it('filters by status', () => {
    const failed = listWebhookEvents({ status: 'failed' }, tmpFile)
    expect(failed).toHaveLength(1)
    expect(failed[0].summary).toBe('gf')
  })

  it('respects limit', () => {
    expect(listWebhookEvents({ limit: 2 }, tmpFile)).toHaveLength(2)
  })

  it('combines source + status', () => {
    const linearIgnored = listWebhookEvents({ source: 'linear', status: 'ignored' }, tmpFile)
    expect(linearIgnored).toHaveLength(1)
    expect(linearIgnored[0].summary).toBe('li')
  })

  it('filters by since (inclusive lower bound)', () => {
    const all = listWebhookEvents({}, tmpFile)
    const cutoff = all[1].receivedAt // 3rd-newest and before should drop
    const recent = listWebhookEvents({ since: cutoff }, tmpFile)
    expect(recent.length).toBeGreaterThanOrEqual(2)
    expect(recent.every(e => new Date(e.receivedAt).getTime() >= new Date(cutoff).getTime())).toBe(true)
  })
})

describe('getWebhookEvent', () => {
  it('returns the event by id', () => {
    const e = recordWebhookEvent(
      { source: 'linear', status: 'processed', summary: 'x' },
      tmpFile,
    )
    expect(getWebhookEvent(e.id, tmpFile)?.summary).toBe('x')
  })

  it('returns null for unknown id', () => {
    expect(getWebhookEvent('does-not-exist', tmpFile)).toBeNull()
  })
})

describe('getWebhookStats', () => {
  it('returns zeroed stats for an empty store', () => {
    const s = getWebhookStats(tmpFile)
    expect(s.total).toBe(0)
    expect(s.lastReceivedAt).toBeUndefined()
    expect(s.bySource.linear).toBe(0)
    expect(s.byStatus.processed).toBe(0)
  })

  it('counts by source + status and reports lastReceivedAt', () => {
    recordWebhookEvent({ source: 'linear', status: 'processed', summary: 'a' }, tmpFile)
    recordWebhookEvent({ source: 'linear', status: 'failed', summary: 'b' }, tmpFile)
    recordWebhookEvent({ source: 'intake', status: 'processed', summary: 'c' }, tmpFile)

    const s = getWebhookStats(tmpFile)
    expect(s.total).toBe(3)
    expect(s.bySource.linear).toBe(2)
    expect(s.bySource.intake).toBe(1)
    expect(s.byStatus.processed).toBe(2)
    expect(s.byStatus.failed).toBe(1)
    expect(s.lastReceivedAt).toBeDefined()
  })
})

describe('_clearWebhookLog', () => {
  it('removes all stored events', () => {
    recordWebhookEvent({ source: 'linear', status: 'processed', summary: 'will be gone' }, tmpFile)
    _clearWebhookLog(tmpFile)
    expect(listWebhookEvents({}, tmpFile)).toEqual([])
  })
})

describe('store recovery', () => {
  it('returns empty when the file is missing', () => {
    expect(listWebhookEvents({}, '/nonexistent/path/whk.json')).toEqual([])
  })

  it('returns empty when the file is malformed JSON', () => {
    fs.writeFileSync(tmpFile, '{not-json', 'utf-8')
    expect(listWebhookEvents({}, tmpFile)).toEqual([])
  })
})
